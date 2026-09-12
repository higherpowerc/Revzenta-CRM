import { db } from "../db";
import { searchProperties } from "../propertySearch";
import { listSavedSearches, type SavedSearchRecord } from "../savedSearches";

export type DistressSeverity = "low" | "medium" | "high" | "urgent";

export interface DistressAlert {
  id: number;
  org_id: number;
  saved_search_id: number | null;
  property_id: number | null;
  alert_type: string;
  severity: DistressSeverity;
  headline: string;
  details: Record<string, any>;
  is_read: boolean;
  created_at: string;
  property?: {
    id: number;
    address_line1: string;
    city: string;
    state: string;
    zip: string;
    county: string;
    estimated_value: number;
    estimated_equity: number;
    revzenta_opportunity_score: number;
    is_pre_foreclosure: boolean;
    tax_delinquent: boolean;
    is_vacant: boolean;
    is_absentee_owner: boolean;
  } | null;
}

export interface DistressCheckResult {
  scannedSearches: number;
  scannedProperties: number;
  newAlertsCreated: number;
  alerts: DistressAlert[];
  executionTimeMs: number;
}

let monitorIntervalId: any = null;
let isScanInProgress = false;

/**
 * Executes an automated property distress check for an organization or all organizations.
 * Evaluates saved searches with alerts enabled or scans properties exhibiting severe distress signals.
 */
export async function runDistressCheck(targetOrgId?: number): Promise<DistressCheckResult> {
  const startTime = Date.now();
  let scannedSearches = 0;
  let scannedProperties = 0;
  let newAlertsCreated = 0;
  const createdAlerts: DistressAlert[] = [];

  // Determine which orgs to scan
  let orgIds: number[] = [];
  if (targetOrgId) {
    orgIds = [targetOrgId];
  } else {
    try {
      const rows = db.query("SELECT id FROM orgs WHERE status = 'active'").all() as any[];
      orgIds = rows.map((r) => r.id);
    } catch {
      orgIds = [1];
    }
  }

  for (const orgId of orgIds) {
    const savedSearches = listSavedSearches(orgId);
    const alertSearches = savedSearches.filter((s) => Boolean(s.alert_enabled));
    scannedSearches += alertSearches.length;

    if (alertSearches.length > 0) {
      // Evaluate each alert-enabled saved search
      for (const search of alertSearches) {
        const searchResults = await searchProperties(orgId, {
          ...search.filters,
          limit: 50,
          offset: 0,
        });

        scannedProperties += searchResults.properties.length;

        // Update matching count and last executed
        try {
          db.query(`
            UPDATE saved_searches
            SET matching_count = ?, last_executed_at = datetime('now')
            WHERE id = ? AND org_id = ?
          `).run(searchResults.totalCount, search.id, orgId);
        } catch {
          /* ignore */
        }

        for (const prop of searchResults.properties) {
          const alertInfo = evaluatePropertyDistress(prop, search);
          if (alertInfo) {
            const created = createDistressAlertIfNew(orgId, search.id, prop.id, alertInfo);
            if (created) {
              newAlertsCreated++;
              createdAlerts.push(created);
            }
          }
        }
      }
    } else {
      // If no alert-enabled saved searches exist for this org, scan for high-priority distress properties directly
      const highDistressResults = await searchProperties(orgId, {
        limit: 50,
        minEquityPct: 30,
        sortBy: "revzenta_opportunity_score",
        sortOrder: "desc",
      });

      scannedProperties += highDistressResults.properties.length;

      for (const prop of highDistressResults.properties) {
        const alertInfo = evaluatePropertyDistress(prop);
        if (alertInfo) {
          const created = createDistressAlertIfNew(orgId, null, prop.id, alertInfo);
          if (created) {
            newAlertsCreated++;
            createdAlerts.push(created);
          }
        }
      }
    }
  }

  return {
    scannedSearches,
    scannedProperties,
    newAlertsCreated,
    alerts: createdAlerts,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Determines whether a property exhibits actionable distress signals and formats alert metadata.
 */
function evaluatePropertyDistress(
  prop: any,
  search?: SavedSearchRecord
): {
  alert_type: string;
  severity: DistressSeverity;
  headline: string;
  details: Record<string, any>;
} | null {
  const isPreForeclosure = Boolean(prop.is_pre_foreclosure);
  const isTaxDelinquent = Boolean(prop.tax_delinquent);
  const isVacant = Boolean(prop.is_vacant);
  const isAbsentee = Boolean(prop.is_absentee_owner);
  const isProbate = Boolean(prop.is_probate);
  const score = prop.revzenta_opportunity_score || 0;

  let alert_type = "";
  let severity: DistressSeverity = "medium";
  let headline = "";

  if (isPreForeclosure) {
    alert_type = "pre_foreclosure";
    severity = "urgent";
    headline = `Pre-Foreclosure Notice: ${prop.address_line1}, ${prop.city}`;
  } else if (isProbate) {
    alert_type = "probate";
    severity = "high";
    headline = `Probate Estate Lead: ${prop.address_line1}, ${prop.city}`;
  } else if (isTaxDelinquent && (isVacant || isAbsentee)) {
    alert_type = "tax_delinquent_vacant";
    severity = "high";
    headline = `Delinquent & Absentee Property: ${prop.address_line1}, ${prop.city}`;
  } else if (isTaxDelinquent) {
    alert_type = "tax_delinquent";
    severity = "medium";
    headline = `Tax Delinquent Opportunity: ${prop.address_line1}, ${prop.city}`;
  } else if (score >= 80) {
    alert_type = "high_opportunity_score";
    severity = "high";
    headline = `High Opportunity Match (${score}/100): ${prop.address_line1}, ${prop.city}`;
  } else if (search && search.name) {
    alert_type = "saved_search_match";
    severity = "low";
    headline = `New Match for "${search.name}": ${prop.address_line1}, ${prop.city}`;
  } else {
    return null;
  }

  const details = {
    address: `${prop.address_line1}, ${prop.city}, ${prop.state} ${prop.zip}`,
    estimated_value: prop.estimated_value || 0,
    estimated_equity: prop.estimated_equity || 0,
    opportunity_score: score,
    reasons: prop.opportunity_score_reasons || [],
    distress_indicators: {
      pre_foreclosure: isPreForeclosure,
      tax_delinquent: isTaxDelinquent,
      vacant: isVacant,
      absentee: isAbsentee,
      probate: isProbate,
    },
    saved_search_name: search?.name || undefined,
  };

  return {
    alert_type,
    severity,
    headline,
    details,
  };
}

/**
 * Creates a distress alert record only if one has not already been created
 * for the same property and alert type within the last 7 days (deduplication).
 */
export function createDistressAlertIfNew(
  orgId: number,
  savedSearchId: number | null,
  propertyId: number,
  alertInfo: {
    alert_type: string;
    severity: DistressSeverity;
    headline: string;
    details: Record<string, any>;
  }
): DistressAlert | null {
  try {
    // Deduplication check: exists within last 7 days?
    const existing = db.query(`
      SELECT id FROM property_distress_alerts
      WHERE org_id = ?
        AND property_id = ?
        AND alert_type = ?
        AND created_at > datetime('now', '-7 days')
      LIMIT 1
    `).get(orgId, propertyId, alertInfo.alert_type) as any | null;

    if (existing) {
      return null; // Already alerted recently
    }

    const detailsJson = JSON.stringify(alertInfo.details);

    const res = db.query(`
      INSERT INTO property_distress_alerts (
        org_id, saved_search_id, property_id, alert_type, severity, headline, details, is_read, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, 0, datetime('now')
      )
    `).run(
      orgId,
      savedSearchId,
      propertyId,
      alertInfo.alert_type,
      alertInfo.severity,
      alertInfo.headline,
      detailsJson
    );

    const alertId = Number(res.lastInsertRowid);
    return getDistressAlertById(alertId, orgId);
  } catch (err) {
    console.error("[distress-monitor] Error inserting distress alert:", err);
    return null;
  }
}

/**
 * Retrieves a single distress alert by ID and organization.
 */
export function getDistressAlertById(id: number, orgId: number): DistressAlert | null {
  const row = db.query(`
    SELECT a.*,
           p.address_line1, p.city, p.state, p.zip, p.county,
           p.estimated_value, p.estimated_equity, p.revzenta_opportunity_score,
           p.is_pre_foreclosure, p.tax_delinquent, p.is_vacant, p.is_absentee_owner
    FROM property_distress_alerts a
    LEFT JOIN properties p ON a.property_id = p.id
    WHERE a.id = ? AND a.org_id = ?
  `).get(id, orgId) as any | null;

  return row ? mapDistressAlertRow(row) : null;
}

/**
 * Lists distress alerts for an organization with optional unread filtering.
 */
export function listDistressAlerts(
  orgId: number,
  options?: { unreadOnly?: boolean; limit?: number; offset?: number }
): { alerts: DistressAlert[]; total: number; unreadCount: number } {
  const limit = Math.min(Math.max(Number(options?.limit) || 20, 1), 100);
  const offset = Math.max(Number(options?.offset) || 0, 0);
  const unreadOnly = Boolean(options?.unreadOnly);

  let whereClause = "WHERE a.org_id = ?";
  const params: any[] = [orgId];

  if (unreadOnly) {
    whereClause += " AND a.is_read = 0";
  }

  const rows = db.query(`
    SELECT a.*,
           p.address_line1, p.city, p.state, p.zip, p.county,
           p.estimated_value, p.estimated_equity, p.revzenta_opportunity_score,
           p.is_pre_foreclosure, p.tax_delinquent, p.is_vacant, p.is_absentee_owner
    FROM property_distress_alerts a
    LEFT JOIN properties p ON a.property_id = p.id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  const countRow = db.query(`
    SELECT COUNT(*) as total FROM property_distress_alerts a ${whereClause}
  `).get(...params) as any;

  const unreadCountRow = db.query(`
    SELECT COUNT(*) as unread FROM property_distress_alerts WHERE org_id = ? AND is_read = 0
  `).get(orgId) as any;

  return {
    alerts: rows.map(mapDistressAlertRow),
    total: Number(countRow?.total || 0),
    unreadCount: Number(unreadCountRow?.unread || 0),
  };
}

/**
 * Marks one or more alerts as read.
 */
export function markAlertsRead(orgId: number, alertIds?: number[]): { updatedCount: number } {
  if (alertIds && alertIds.length > 0) {
    const placeholders = alertIds.map(() => "?").join(",");
    const res = db.query(`
      UPDATE property_distress_alerts
      SET is_read = 1
      WHERE org_id = ? AND id IN (${placeholders})
    `).run(orgId, ...alertIds);
    return { updatedCount: res.changes };
  } else {
    const res = db.query(`
      UPDATE property_distress_alerts
      SET is_read = 1
      WHERE org_id = ? AND is_read = 0
    `).run(orgId);
    return { updatedCount: res.changes };
  }
}

/**
 * Helper to map SQL row to DistressAlert interface.
 */
function mapDistressAlertRow(row: any): DistressAlert {
  let details: any = {};
  try {
    if (typeof row.details === "string") details = JSON.parse(row.details);
    else if (typeof row.details === "object" && row.details) details = row.details;
  } catch {
    details = {};
  }

  let property: any = null;
  if (row.property_id && row.address_line1) {
    property = {
      id: row.property_id,
      address_line1: row.address_line1,
      city: row.city || "",
      state: row.state || "",
      zip: row.zip || "",
      county: row.county || "",
      estimated_value: Number(row.estimated_value || 0),
      estimated_equity: Number(row.estimated_equity || 0),
      revzenta_opportunity_score: Number(row.revzenta_opportunity_score || 0),
      is_pre_foreclosure: Boolean(row.is_pre_foreclosure),
      tax_delinquent: Boolean(row.tax_delinquent),
      is_vacant: Boolean(row.is_vacant),
      is_absentee_owner: Boolean(row.is_absentee_owner),
    };
  }

  return {
    id: row.id,
    org_id: row.org_id,
    saved_search_id: row.saved_search_id ?? null,
    property_id: row.property_id ?? null,
    alert_type: row.alert_type,
    severity: (row.severity || "medium") as DistressSeverity,
    headline: row.headline,
    details,
    is_read: Boolean(row.is_read),
    created_at: row.created_at,
    property,
  };
}

/**
 * Starts the recurring distress monitor background worker.
 */
export function startDistressMonitor(intervalMs = 15 * 60 * 1000): void {
  if (monitorIntervalId) return;

  console.log(`[distress-monitor] Starting automated property distress monitor (interval: ${Math.round(intervalMs / 1000)}s)...`);

  monitorIntervalId = setInterval(async () => {
    if (isScanInProgress) return;
    isScanInProgress = true;
    try {
      const res = await runDistressCheck();
      if (res.newAlertsCreated > 0) {
        console.log(`[distress-monitor] Scan complete: ${res.newAlertsCreated} new distress alerts created across ${res.scannedSearches} saved searches.`);
      }
    } catch (err) {
      console.error("[distress-monitor] Periodic scan error:", err);
    } finally {
      isScanInProgress = false;
    }
  }, intervalMs);

  // Unref in environments that support it so the background timer won't block process exit during tests
  if (monitorIntervalId && typeof monitorIntervalId.unref === "function") {
    monitorIntervalId.unref();
  }
}

/**
 * Stops the distress monitor timer.
 */
export function stopDistressMonitor(): void {
  if (monitorIntervalId) {
    clearInterval(monitorIntervalId);
    monitorIntervalId = null;
    console.log("[distress-monitor] Distress monitor stopped.");
  }
}
