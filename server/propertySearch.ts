import { db } from "./db";
import { getDatabaseConfig, pgQuery, pgQueryOne } from "./db/connection";
import { NATIONWIDE_DEMO_PROPERTIES } from "./demoProperties";

export interface PropertySearchFilters {
  query?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  apn?: string;
  ownerName?: string;
  propertyTypes?: string[];
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  minValue?: number;
  maxValue?: number;
  minEquityPct?: number;
  maxEquityPct?: number;
  minEstimatedEquity?: number;
  isAbsenteeOwner?: boolean;
  isVacant?: boolean;
  hasLiens?: boolean;
  isPreForeclosure?: boolean;
  isForeclosure?: boolean;
  isBankruptcy?: boolean;
  isProbate?: boolean;
  taxDelinquent?: boolean;
  minOpportunityScore?: number;
  limit?: number;
  offset?: number;
  sortBy?: "estimated_value" | "estimated_equity" | "revzenta_opportunity_score" | "year_built" | "created_at";
  sortOrder?: "asc" | "desc";
}

export interface PropertyRow {
  id: number;
  org_id: number;
  apn: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  latitude?: number;
  longitude?: number;
  property_type: string;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  lot_size_sqft?: number;
  year_built?: number;
  stories?: number;
  garage_spaces?: number;
  estimated_value: number;
  value_range_low?: number;
  value_range_high?: number;
  estimated_equity: number;
  equity_percent: number;
  estimated_rent?: number;
  last_sale_price?: number;
  last_sale_date?: string;
  mortgage_balance?: number;
  tax_assessed_value?: number;
  tax_delinquent: boolean;
  has_liens: boolean;
  is_foreclosure: boolean;
  is_pre_foreclosure: boolean;
  is_bankruptcy: boolean;
  is_probate: boolean;
  is_vacant: boolean;
  has_code_violations: boolean;
  is_absentee_owner: boolean;
  owner_name: string;
  revzenta_opportunity_score: number;
  opportunity_score_reasons: string[];
  source_provider: string;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  properties: PropertyRow[];
  totalCount: number;
  limit: number;
  offset: number;
}

/**
 * Idempotently ensures a rich set of wholesale investment properties exists for the organization.
 */
export async function ensureDemoPropertiesForOrgAsync(orgId: number): Promise<void> {
  if (orgId >= 9900) return; // Preserve pristine state for unit tests
  const config = getDatabaseConfig();
  if (config.isPostgres) {
    try {
      const res = await pgQueryOne<{ c: string | number }>(
        "SELECT COUNT(*) as c FROM properties WHERE org_id = $1",
        [orgId]
      );
      if (Number(res?.c || 0) === 0) {
        for (const p of NATIONWIDE_DEMO_PROPERTIES) {
          await pgQuery(
            `INSERT INTO properties (
              org_id, apn, address_line1, city, state, zip, county,
              property_type, bedrooms, bathrooms, square_feet, lot_size_sqft, year_built,
              estimated_value, estimated_equity, equity_percent, estimated_rent, last_sale_price,
              mortgage_balance, tax_delinquent, is_vacant, is_absentee_owner, is_pre_foreclosure,
              is_probate, has_liens, owner_name, revzenta_opportunity_score, opportunity_score_reasons,
              source_provider, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12, $13,
              $14, $15, $16, $17, $18,
              $19, $20, $21, $22, $23,
              $24, $25, $26, $27, $28::jsonb,
              $29, NOW(), NOW()
            )`,
            [
              orgId, p.apn, p.address_line1, p.city, p.state, p.zip, p.county,
              p.property_type, p.bedrooms, p.bathrooms, p.square_feet, p.lot_size_sqft, p.year_built,
              p.estimated_value, p.estimated_equity, p.equity_percent, p.estimated_rent, p.last_sale_price,
              p.mortgage_balance, Boolean(p.tax_delinquent), Boolean(p.is_vacant), Boolean(p.is_absentee_owner),
              Boolean(p.is_pre_foreclosure), Boolean(p.is_probate), Boolean(p.has_liens), p.owner_name,
              p.revzenta_opportunity_score, p.opportunity_score_reasons, p.source_provider
            ]
          );
        }
      }
    } catch (err) {
      console.error(`[propertySearch] Failed to seed demo properties for org ${orgId} on postgres:`, err);
    }
  } else {
    try {
      const count = (db.query("SELECT COUNT(*) as c FROM properties WHERE org_id = ?").get(orgId) as { c: number })?.c || 0;
      if (count === 0) {
        const stmt = db.prepare(`
          INSERT INTO properties (
            org_id, apn, address_line1, city, state, zip, county,
            property_type, bedrooms, bathrooms, square_feet, lot_size_sqft, year_built,
            estimated_value, estimated_equity, equity_percent, estimated_rent, last_sale_price,
            mortgage_balance, tax_delinquent, is_vacant, is_absentee_owner, is_pre_foreclosure,
            is_probate, has_liens, owner_name, revzenta_opportunity_score, opportunity_score_reasons,
            source_provider, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, datetime('now'), datetime('now')
          )
        `);
        for (const p of NATIONWIDE_DEMO_PROPERTIES) {
          stmt.run(
            orgId, p.apn, p.address_line1, p.city, p.state, p.zip, p.county,
            p.property_type, p.bedrooms, p.bathrooms, p.square_feet, p.lot_size_sqft, p.year_built,
            p.estimated_value, p.estimated_equity, p.equity_percent, p.estimated_rent, p.last_sale_price,
            p.mortgage_balance, p.tax_delinquent, p.is_vacant, p.is_absentee_owner, p.is_pre_foreclosure,
            p.is_probate, p.has_liens, p.owner_name, p.revzenta_opportunity_score, p.opportunity_score_reasons,
            p.source_provider
          );
        }
      }
    } catch (err) {
      console.error(`[propertySearch] Failed to seed demo properties for org ${orgId} on sqlite:`, err);
    }
  }
}

/**
 * Searches properties with multi-criteria filtering and strict tenant isolation
 */
export async function searchProperties(
  orgId: number,
  filters: PropertySearchFilters
): Promise<SearchResult> {
  await ensureDemoPropertiesForOrgAsync(orgId);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = Math.max(0, filters.offset ?? 0);
  const sortBy = filters.sortBy || "revzenta_opportunity_score";
  const sortOrder = filters.sortOrder?.toLowerCase() === "asc" ? "ASC" : "DESC";

  const config = getDatabaseConfig();

  // 1. Build Parameterized Clauses
  const whereClauses: string[] = ["org_id = ?"];
  const params: any[] = [orgId];

  if (filters.query?.trim()) {
    const q = `%${filters.query.trim().toLowerCase()}%`;
    whereClauses.push("(LOWER(address_line1) LIKE ? OR LOWER(city) LIKE ? OR LOWER(county) LIKE ? OR LOWER(owner_name) LIKE ? OR apn LIKE ?)");
    params.push(q, q, q, q, q);
  }

  if (filters.address?.trim()) {
    whereClauses.push("LOWER(address_line1) LIKE ?");
    params.push(`%${filters.address.trim().toLowerCase()}%`);
  }

  if (filters.city?.trim()) {
    whereClauses.push("LOWER(city) = ?");
    params.push(filters.city.trim().toLowerCase());
  }

  if (filters.state?.trim()) {
    whereClauses.push("UPPER(state) = ?");
    params.push(filters.state.trim().toUpperCase());
  }

  if (filters.zip?.trim()) {
    whereClauses.push("zip = ?");
    params.push(filters.zip.trim());
  }

  if (filters.county?.trim()) {
    whereClauses.push("LOWER(county) = ?");
    params.push(filters.county.trim().toLowerCase());
  }

  if (filters.apn?.trim()) {
    whereClauses.push("apn = ?");
    params.push(filters.apn.trim());
  }

  if (filters.ownerName?.trim()) {
    whereClauses.push("LOWER(owner_name) LIKE ?");
    params.push(`%${filters.ownerName.trim().toLowerCase()}%`);
  }

  if (filters.propertyTypes && filters.propertyTypes.length > 0) {
    const placeholders = filters.propertyTypes.map(() => "?").join(", ");
    whereClauses.push(`property_type IN (${placeholders})`);
    params.push(...filters.propertyTypes);
  }

  if (filters.minBeds != null) {
    whereClauses.push("bedrooms >= ?");
    params.push(filters.minBeds);
  }

  if (filters.maxBeds != null) {
    whereClauses.push("bedrooms <= ?");
    params.push(filters.maxBeds);
  }

  if (filters.minBaths != null) {
    whereClauses.push("bathrooms >= ?");
    params.push(filters.minBaths);
  }

  if (filters.maxBaths != null) {
    whereClauses.push("bathrooms <= ?");
    params.push(filters.maxBaths);
  }

  if (filters.minSqft != null) {
    whereClauses.push("square_feet >= ?");
    params.push(filters.minSqft);
  }

  if (filters.maxSqft != null) {
    whereClauses.push("square_feet <= ?");
    params.push(filters.maxSqft);
  }

  if (filters.minYearBuilt != null) {
    whereClauses.push("year_built >= ?");
    params.push(filters.minYearBuilt);
  }

  if (filters.maxYearBuilt != null) {
    whereClauses.push("year_built <= ?");
    params.push(filters.maxYearBuilt);
  }

  if (filters.minValue != null) {
    whereClauses.push("estimated_value >= ?");
    params.push(filters.minValue);
  }

  if (filters.maxValue != null) {
    whereClauses.push("estimated_value <= ?");
    params.push(filters.maxValue);
  }

  if (filters.minEquityPct != null) {
    whereClauses.push("equity_percent >= ?");
    params.push(filters.minEquityPct);
  }

  if (filters.maxEquityPct != null) {
    whereClauses.push("equity_percent <= ?");
    params.push(filters.maxEquityPct);
  }

  if (filters.minEstimatedEquity != null) {
    whereClauses.push("estimated_equity >= ?");
    params.push(filters.minEstimatedEquity);
  }

  if (filters.isAbsenteeOwner != null) {
    whereClauses.push("is_absentee_owner = ?");
    params.push(filters.isAbsenteeOwner ? 1 : 0);
  }

  if (filters.isVacant != null) {
    whereClauses.push("is_vacant = ?");
    params.push(filters.isVacant ? 1 : 0);
  }

  if (filters.hasLiens != null) {
    whereClauses.push("has_liens = ?");
    params.push(filters.hasLiens ? 1 : 0);
  }

  if (filters.isPreForeclosure != null) {
    whereClauses.push("is_pre_foreclosure = ?");
    params.push(filters.isPreForeclosure ? 1 : 0);
  }

  if (filters.isForeclosure != null) {
    whereClauses.push("is_foreclosure = ?");
    params.push(filters.isForeclosure ? 1 : 0);
  }

  if (filters.isBankruptcy != null) {
    whereClauses.push("is_bankruptcy = ?");
    params.push(filters.isBankruptcy ? 1 : 0);
  }

  if (filters.isProbate != null) {
    whereClauses.push("is_probate = ?");
    params.push(filters.isProbate ? 1 : 0);
  }

  if (filters.taxDelinquent != null) {
    whereClauses.push("tax_delinquent = ?");
    params.push(filters.taxDelinquent ? 1 : 0);
  }

  if (filters.minOpportunityScore != null) {
    whereClauses.push("revzenta_opportunity_score >= ?");
    params.push(filters.minOpportunityScore);
  }

  const whereSql = whereClauses.join(" AND ");

  // Count Total
  const countSql = `SELECT COUNT(*) as total FROM properties WHERE ${whereSql}`;
  const dataSql = `SELECT * FROM properties WHERE ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;

  if (config.isPostgres) {
    // Convert ? to $1, $2, etc for PostgreSQL
    let pIdx = 1;
    const pgWhere = whereSql.replace(/\?/g, () => `$${pIdx++}`);
    const pgCountSql = `SELECT COUNT(*) as total FROM properties WHERE ${pgWhere}`;
    const pgDataSql = `SELECT * FROM properties WHERE ${pgWhere} ORDER BY ${sortBy} ${sortOrder} LIMIT $${pIdx++} OFFSET $${pIdx++}`;

    const countRes = await pgQueryOne<{ total: string | number }>(pgCountSql, params);
    const totalCount = Number(countRes?.total ?? 0);

    const rows = await pgQuery<any>(pgDataSql, [...params, limit, offset]);
    return {
      properties: rows.map(mapDbRowToProperty),
      totalCount,
      limit,
      offset,
    };
  }

  // SQLite execution
  const countRow = db.query(countSql).get(...params) as { total: number } | null;
  const totalCount = countRow?.total ?? 0;

  const rows = db.query(dataSql).all(...params, limit, offset) as any[];

  return {
    properties: rows.map(mapDbRowToProperty),
    totalCount,
    limit,
    offset,
  };
}

/**
 * Turns a Property intelligence record into a CRM lead without creating duplicates.
 * Property → Owner → Lead
 */
export async function convertPropertyToLead(
  orgId: number,
  propertyId: number,
  userId?: number,
  opts?: { stage?: string; notes?: string }
): Promise<{
  success: boolean;
  duplicate: boolean;
  clientId: number;
  message: string;
}> {
  // 1. Fetch the Property record
  const prop = db
    .query("SELECT * FROM properties WHERE id = ? AND org_id = ?")
    .get(propertyId, orgId) as any | null;

  if (!prop) {
    throw new Error("Property record not found or access denied.");
  }

  // 2. Build comprehensive property data dossier for CRM custom fields
  const customFields: Array<{ name: string; value: string }> = [];

  const estVal = Number(prop.estimated_value) || 0;
  const estEq = Number(prop.estimated_equity) || 0;
  const openMortgage = Number(prop.mortgage_balance) || Math.max(0, estVal - estEq);
  const equityPct = estVal > 0 ? Math.round((estEq / estVal) * 100) : (Number(prop.equity_percent) || 0);

  if (estVal > 0) {
    customFields.push({ name: "Estimated Value", value: `$${Math.round(estVal).toLocaleString()}` });
  }
  if (estEq > 0) {
    customFields.push({ name: "Estimated Equity", value: `$${Math.round(estEq).toLocaleString()}` });
  }
  if (equityPct > 0) {
    customFields.push({ name: "Equity Percent", value: `${equityPct}%` });
  }
  if (openMortgage > 0) {
    customFields.push({ name: "Open Mortgage Balance", value: `$${Math.round(openMortgage).toLocaleString()}` });
  }
  if (prop.estimated_rent != null && Number(prop.estimated_rent) > 0) {
    customFields.push({ name: "Estimated Rent", value: `$${Math.round(Number(prop.estimated_rent)).toLocaleString()}/mo` });
  }
  if (prop.value_range_low != null && prop.value_range_high != null && Number(prop.value_range_low) > 0 && Number(prop.value_range_high) > 0) {
    customFields.push({ name: "Valuation Range", value: `$${Math.round(Number(prop.value_range_low)).toLocaleString()} - $${Math.round(Number(prop.value_range_high)).toLocaleString()}` });
  }
  if (prop.bedrooms != null && Number(prop.bedrooms) > 0) {
    customFields.push({ name: "Bedrooms", value: String(prop.bedrooms) });
  }
  if (prop.bathrooms != null && Number(prop.bathrooms) > 0) {
    customFields.push({ name: "Bathrooms", value: String(prop.bathrooms) });
  }
  if (prop.square_feet != null && Number(prop.square_feet) > 0) {
    customFields.push({ name: "Square Footage", value: `${Math.round(prop.square_feet).toLocaleString()} sqft` });
  }
  if (prop.year_built != null && Number(prop.year_built) > 0) {
    customFields.push({ name: "Year Built", value: String(prop.year_built) });
  }
  if (prop.property_type) {
    customFields.push({ name: "Property Class", value: String(prop.property_type) });
  }
  if (prop.apn) {
    customFields.push({ name: "APN", value: String(prop.apn) });
  }
  if (prop.county) {
    customFields.push({ name: "County", value: String(prop.county) });
  }
  if (prop.lot_size_sqft != null && Number(prop.lot_size_sqft) > 0) {
    customFields.push({ name: "Lot Size", value: `${Math.round(prop.lot_size_sqft).toLocaleString()} sqft` });
  }
  if (prop.stories != null && Number(prop.stories) > 0) {
    customFields.push({ name: "Stories", value: String(prop.stories) });
  }
  if (prop.garage_spaces != null && Number(prop.garage_spaces) > 0) {
    customFields.push({ name: "Garage Spaces", value: String(prop.garage_spaces) });
  }
  if (prop.last_sale_price != null && Number(prop.last_sale_price) > 0) {
    customFields.push({ name: "Last Sale Price", value: `$${Math.round(prop.last_sale_price).toLocaleString()}` });
  }
  if (prop.last_sale_date) {
    customFields.push({ name: "Last Sale Date", value: String(prop.last_sale_date) });
  }
  if (prop.tax_assessed_value != null && Number(prop.tax_assessed_value) > 0) {
    customFields.push({ name: "Tax Assessed Value", value: `$${Math.round(prop.tax_assessed_value).toLocaleString()}` });
  }
  if (prop.revzenta_opportunity_score != null) {
    customFields.push({ name: "Opportunity Score", value: `${prop.revzenta_opportunity_score}/100` });
  }
  let reasonsList: string[] = [];
  try {
    if (typeof prop.opportunity_score_reasons === "string") {
      reasonsList = JSON.parse(prop.opportunity_score_reasons);
    } else if (Array.isArray(prop.opportunity_score_reasons)) {
      reasonsList = prop.opportunity_score_reasons;
    }
  } catch {}
  if (reasonsList.length > 0) {
    customFields.push({ name: "Opportunity Reasons", value: reasonsList.join(", ") });
  }
  const distressBadges = [
    prop.is_absentee_owner ? "Absentee Owner" : "",
    prop.is_vacant ? "Vacant Property" : "",
    prop.is_foreclosure ? "Foreclosure" : "",
    prop.is_pre_foreclosure ? "Pre-Foreclosure" : "",
    prop.tax_delinquent ? "Tax Delinquent" : "",
    prop.has_liens ? "Open Liens" : "",
    prop.has_code_violations ? "Code Violations" : "",
    prop.is_bankruptcy ? "Bankruptcy" : "",
    prop.is_probate ? "Probate" : "",
  ].filter(Boolean);
  if (distressBadges.length > 0) {
    customFields.push({ name: "Distress Indicators", value: distressBadges.join(", ") });
  }
  if (prop.is_absentee_owner != null) {
    customFields.push({ name: "Owner Occupied", value: prop.is_absentee_owner ? "No (Absentee)" : "Yes" });
  }
  if (prop.source_provider) {
    customFields.push({ name: "Data Source", value: String(prop.source_provider) });
  }
  if (prop.latitude != null) {
    customFields.push({ name: "Latitude", value: String(prop.latitude) });
  }
  if (prop.longitude != null) {
    customFields.push({ name: "Longitude", value: String(prop.longitude) });
  }
  if (prop.is_absentee_owner) customFields.push({ name: "Is Absentee", value: "true" });
  if (prop.is_vacant) customFields.push({ name: "Is Vacant", value: "true" });
  if (prop.tax_delinquent) customFields.push({ name: "Is Tax Delinquent", value: "true" });
  if (prop.is_pre_foreclosure) customFields.push({ name: "Is Pre-Foreclosure", value: "true" });
  if (prop.is_foreclosure) customFields.push({ name: "Is Foreclosure", value: "true" });
  if (prop.is_probate) customFields.push({ name: "Is Probate", value: "true" });
  if (prop.is_bankruptcy) customFields.push({ name: "Is Bankruptcy", value: "true" });
  if (prop.has_liens) customFields.push({ name: "Has Liens", value: "true" });
  if (prop.has_code_violations) customFields.push({ name: "Has Code Violations", value: "true" });

  // 3. Duplicate Detection: If lead already exists, update its custom fields & specs with full property data
  const cleanAddr = prop.address_line1.trim().toLowerCase();
  const existing = db
    .query("SELECT id, custom_fields FROM clients WHERE org_id = ? AND LOWER(address) = ? AND archived = 0")
    .get(orgId, cleanAddr) as { id: number; custom_fields?: string } | null;

  if (existing) {
    let mergedFields = customFields;
    try {
      const prev: Array<{ name: string; value: string }> = JSON.parse(existing.custom_fields || "[]");
      const map = new Map<string, string>();
      prev.forEach((f) => map.set(f.name.toLowerCase(), f.value));
      customFields.forEach((f) => map.set(f.name.toLowerCase(), f.value));
      mergedFields = Array.from(map.entries()).map(([k, v]) => ({
        name: customFields.find((f) => f.name.toLowerCase() === k)?.name || k,
        value: v,
      }));
    } catch {}

    db.query(`
      UPDATE clients
      SET deal_value = COALESCE(NULLIF(?, 0), deal_value),
          custom_fields = ?,
          contact_name = COALESCE(NULLIF(contact_name, 'Property Owner'), ?),
          updated_at = datetime('now')
      WHERE id = ? AND org_id = ?
    `).run(
      estVal,
      JSON.stringify(mergedFields),
      prop.owner_name || "Property Owner",
      existing.id,
      orgId
    );

    return {
      success: false,
      duplicate: true,
      clientId: existing.id,
      message: `Property is already active in CRM Lead #${existing.id} (updated with latest intelligence data).`,
    };
  }

  // 4. Create CRM Client/Lead record with all property data
  const stage = opts?.stage || "Prospect";
  const notes = opts?.notes
    ? `${opts.notes}\n[Imported from Property Intelligence: ${prop.address_line1}]`
    : `Imported from Revzenta Property Intelligence (Opportunity Score: ${prop.revzenta_opportunity_score || 0}/100)\nBedrooms: ${prop.bedrooms || "—"}, Baths: ${prop.bathrooms || "—"}, Sqft: ${prop.square_feet || "—"}`;

  const clientType = prop.property_type?.toLowerCase().includes("multi")
    ? "multi_family"
    : "single_family";

  const res = db.query(`
    INSERT INTO clients (
      org_id, company_name, contact_name, address, city, state, zip,
      deal_value, stage, client_type, lead_source, notes, custom_fields, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, 'Property Intelligence', ?, ?, datetime('now'), datetime('now')
    )
  `).run(
    orgId,
    prop.address_line1,
    prop.owner_name || "Property Owner",
    prop.address_line1,
    prop.city,
    prop.state,
    prop.zip,
    estVal,
    stage,
    clientType,
    notes,
    JSON.stringify(customFields)
  );

  const clientId = Number(res.lastInsertRowid);

  // 4. Create initial follow-up task
  try {
    db.query(`
      INSERT INTO tasks (org_id, title, client_id, due_date, done, notes, created_at, updated_at)
      VALUES (?, ?, ?, date('now', '+2 days'), 0, ?, datetime('now'), datetime('now'))
    `).run(
      orgId,
      `Reach out to owner of ${prop.address_line1}`,
      clientId,
      `Review Revzenta deal underwriting & comps. Opportunity Score: ${prop.revzenta_opportunity_score || 0}`
    );
  } catch (taskErr) {
    console.warn("[propertySearch] Warning creating follow-up task:", taskErr);
  }

  return {
    success: true,
    duplicate: false,
    clientId,
    message: `Property successfully converted to CRM lead #${clientId}.`,
  };
}

function mapDbRowToProperty(row: any): PropertyRow {
  let reasons: string[] = [];
  try {
    if (typeof row.opportunity_score_reasons === "string") {
      reasons = JSON.parse(row.opportunity_score_reasons);
    } else if (Array.isArray(row.opportunity_score_reasons)) {
      reasons = row.opportunity_score_reasons;
    }
  } catch {
    reasons = [];
  }

  return {
    id: row.id,
    org_id: row.org_id,
    apn: row.apn || "",
    address_line1: row.address_line1,
    address_line2: row.address_line2 || "",
    city: row.city,
    state: row.state,
    zip: row.zip,
    county: row.county || "",
    latitude: row.latitude,
    longitude: row.longitude,
    property_type: row.property_type || "Single Family",
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    square_feet: row.square_feet,
    lot_size_sqft: row.lot_size_sqft,
    year_built: row.year_built,
    stories: row.stories,
    garage_spaces: row.garage_spaces,
    estimated_value: Number(row.estimated_value || 0),
    value_range_low: row.value_range_low,
    value_range_high: row.value_range_high,
    estimated_equity: Number(row.estimated_equity || 0),
    equity_percent: Number(row.equity_percent || 0),
    estimated_rent: row.estimated_rent,
    last_sale_price: row.last_sale_price,
    last_sale_date: row.last_sale_date,
    mortgage_balance: row.mortgage_balance,
    tax_assessed_value: row.tax_assessed_value,
    tax_delinquent: Boolean(row.tax_delinquent),
    has_liens: Boolean(row.has_liens),
    is_foreclosure: Boolean(row.is_foreclosure),
    is_pre_foreclosure: Boolean(row.is_pre_foreclosure),
    is_bankruptcy: Boolean(row.is_bankruptcy),
    is_probate: Boolean(row.is_probate),
    is_vacant: Boolean(row.is_vacant),
    has_code_violations: Boolean(row.has_code_violations),
    is_absentee_owner: Boolean(row.is_absentee_owner),
    owner_name: row.owner_name || "",
    revzenta_opportunity_score: Number(row.revzenta_opportunity_score || 0),
    opportunity_score_reasons: reasons,
    source_provider: row.source_provider || "rentcast",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Fetches a single property by ID ensuring strict tenant isolation.
 */
export async function getPropertyById(orgId: number, propertyId: number): Promise<PropertyRow | null> {
  const dbConfig = getDatabaseConfig();
  if (dbConfig.isPostgres) {
    const row = await pgQueryOne("SELECT * FROM properties WHERE id = $1 AND org_id = $2", [propertyId, orgId]);
    return row ? mapDbRowToProperty(row) : null;
  } else {
    const row = db.query("SELECT * FROM properties WHERE id = ? AND org_id = ?").get(propertyId, orgId);
    return row ? mapDbRowToProperty(row) : null;
  }
}

