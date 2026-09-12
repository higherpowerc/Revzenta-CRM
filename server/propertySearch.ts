import { db } from "./db";
import { getDatabaseConfig, pgQuery, pgQueryOne } from "./db/connection";

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
 * Searches properties with multi-criteria filtering and strict tenant isolation
 */
export async function searchProperties(
  orgId: number,
  filters: PropertySearchFilters
): Promise<SearchResult> {
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

  // 2. Duplicate Detection: Check if client already exists with matching address in this org
  const cleanAddr = prop.address_line1.trim().toLowerCase();
  const existing = db
    .query("SELECT id FROM clients WHERE org_id = ? AND LOWER(address) = ? AND archived = 0")
    .get(orgId, cleanAddr) as { id: number } | null;

  if (existing) {
    return {
      success: false,
      duplicate: true,
      clientId: existing.id,
      message: `Property is already in your CRM pipeline (Lead #${existing.id}).`,
    };
  }

  // 3. Create CRM Client/Lead record
  const stage = opts?.stage || "Prospect";
  const notes = opts?.notes
    ? `${opts.notes}\n[Imported from Property Intelligence: ${prop.address_line1}]`
    : `Imported from Revzenta Property Intelligence (Opportunity Score: ${prop.revzenta_opportunity_score || 0}/100)`;

  const clientType = prop.property_type?.toLowerCase().includes("multi")
    ? "multi_family"
    : "single_family";

  const res = db.query(`
    INSERT INTO clients (
      org_id, company_name, contact_name, address, city, state, zip,
      deal_value, stage, client_type, lead_source, notes, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, 'Property Intelligence', ?, datetime('now'), datetime('now')
    )
  `).run(
    orgId,
    prop.address_line1,
    prop.owner_name || "Property Owner",
    prop.address_line1,
    prop.city,
    prop.state,
    prop.zip,
    prop.estimated_value || 0,
    stage,
    clientType,
    notes
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

