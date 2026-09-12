import { db } from "./db";
import { searchProperties, type PropertySearchFilters, type SearchResult } from "./propertySearch";

export interface SavedSearchRecord {
  id: number;
  org_id: number;
  user_id: number | null;
  name: string;
  natural_language_query: string;
  filters: PropertySearchFilters;
  auto_refresh: boolean;
  alert_enabled: boolean;
  matching_count: number;
  last_executed_at: string | null;
  created_at: string;
}

export function createSavedSearch(
  orgId: number,
  userId: number | null,
  name: string,
  filters: PropertySearchFilters,
  naturalLanguageQuery = "",
  alertEnabled = false
): SavedSearchRecord {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error("Search name is required.");
  }

  const filtersJson = JSON.stringify(filters);

  const res = db.query(`
    INSERT INTO saved_searches (
      org_id, user_id, name, natural_language_query, filters,
      auto_refresh, alert_enabled, matching_count, last_executed_at, created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      0, ?, 0, datetime('now'), datetime('now')
    )
  `).run(orgId, userId, cleanName, naturalLanguageQuery, filtersJson, alertEnabled ? 1 : 0);

  const id = Number(res.lastInsertRowid);
  return getSavedSearchById(id, orgId)!;
}

export function listSavedSearches(orgId: number): SavedSearchRecord[] {
  const rows = db.query(`
    SELECT * FROM saved_searches
    WHERE org_id = ?
    ORDER BY id DESC
  `).all(orgId) as any[];

  return rows.map(mapSavedSearchRow);
}

export function getSavedSearchById(id: number, orgId: number): SavedSearchRecord | null {
  const row = db.query(`
    SELECT * FROM saved_searches
    WHERE id = ? AND org_id = ?
  `).get(id, orgId) as any | null;

  return row ? mapSavedSearchRow(row) : null;
}

export async function executeSavedSearch(
  id: number,
  orgId: number
): Promise<{ savedSearch: SavedSearchRecord; results: SearchResult }> {
  const search = getSavedSearchById(id, orgId);
  if (!search) {
    throw new Error("Saved search not found or access denied.");
  }

  const results = await searchProperties(orgId, search.filters);

  // Update last_executed_at and matching_count
  db.query(`
    UPDATE saved_searches
    SET last_executed_at = datetime('now'),
        matching_count = ?
    WHERE id = ? AND org_id = ?
  `).run(results.totalCount, id, orgId);

  const updatedSearch = getSavedSearchById(id, orgId)!;
  return { savedSearch: updatedSearch, results };
}

export function deleteSavedSearch(id: number, orgId: number): boolean {
  const res = db.query("DELETE FROM saved_searches WHERE id = ? AND org_id = ?").run(id, orgId);
  return res.changes > 0;
}

export function toggleSavedSearchAlert(
  id: number,
  orgId: number,
  enabled?: boolean
): SavedSearchRecord {
  const current = getSavedSearchById(id, orgId);
  if (!current) {
    throw new Error("Saved search not found or access denied.");
  }
  const nextVal = enabled !== undefined ? (enabled ? 1 : 0) : (current.alert_enabled ? 0 : 1);
  db.query(`
    UPDATE saved_searches
    SET alert_enabled = ?
    WHERE id = ? AND org_id = ?
  `).run(nextVal, id, orgId);

  return getSavedSearchById(id, orgId)!;
}

function mapSavedSearchRow(row: any): SavedSearchRecord {
  let filters: PropertySearchFilters = {};
  try {
    if (typeof row.filters === "string") {
      filters = JSON.parse(row.filters);
    } else if (typeof row.filters === "object" && row.filters) {
      filters = row.filters;
    }
  } catch {
    filters = {};
  }

  return {
    id: row.id,
    org_id: row.org_id,
    user_id: row.user_id,
    name: row.name,
    natural_language_query: row.natural_language_query || "",
    filters,
    auto_refresh: Boolean(row.auto_refresh),
    alert_enabled: Boolean(row.alert_enabled),
    matching_count: Number(row.matching_count || 0),
    last_executed_at: row.last_executed_at,
    created_at: row.created_at,
  };
}
