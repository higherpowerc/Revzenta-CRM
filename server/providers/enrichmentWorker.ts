import { providerRegistry } from "./providerRegistry";
import type { NormalizedPropertyRecord, ProviderQueryOptions } from "./types";
import { getDatabaseConfig, pgQuery } from "../db/connection";
import { db } from "../db";
import { calculateOpportunityBreakdown } from "../ai/dealExplainer";

export interface EnrichmentResult {
  success: boolean;
  property: NormalizedPropertyRecord | null;
  savedPropertyId?: number;
  sources: string[];
  executionTimeMs: number;
  message?: string;
}

/**
 * Enriches a property across all available registered data providers,
 * applies deterministic conflict resolution, calculates Opportunity Scores,
 * and synchronizes the unified record to the database with strict tenant isolation.
 */
export async function enrichProperty(
  address: string,
  options?: ProviderQueryOptions & { propertyId?: number }
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const orgId = options?.orgId || 1;

  try {
    // 1. Query unified property data across providers with conflict resolution
    const unifiedRecord = await providerRegistry.lookupProperty(address, options);
    if (!unifiedRecord) {
      return {
        success: false,
        property: null,
        sources: [],
        executionTimeMs: Date.now() - startTime,
        message: "No data could be retrieved from configured providers for this address.",
      };
    }

    const sources = (unifiedRecord.valuation.sourceValues || []).map((s: any) => s.source);
    if (!sources.includes(unifiedRecord.primarySource)) {
      sources.push(unifiedRecord.primarySource);
    }

    // 2. Compute Revzenta Opportunity Score deterministically
    const estVal = unifiedRecord.valuation.estimatedValue || 0;
    const mortgageBal = unifiedRecord.mortgageHistory?.[0]?.loanAmount || 0;
    const estEquity = Math.max(0, estVal - mortgageBal);
    const equityPct = estVal > 0 ? (estEquity / estVal) * 100 : 0;

    const isAbsentee = Boolean(unifiedRecord.owner?.occupancyStatus?.includes("absentee"));
    const isVacant = Boolean(unifiedRecord.publicRecords?.isVacant);
    const taxDelinquent = Boolean(unifiedRecord.taxInfo?.isDelinquent);
    const isPreForeclosure = Boolean(unifiedRecord.publicRecords?.isPreForeclosure);
    const isForeclosure = Boolean(unifiedRecord.publicRecords?.isForeclosure);

    const distressReasons: string[] = [];
    if (isAbsentee) distressReasons.push("Absentee Owner");
    if (isVacant) distressReasons.push("Vacant");
    if (taxDelinquent) distressReasons.push("Tax Delinquent");
    if (isPreForeclosure) distressReasons.push("Pre-Foreclosure");
    if (isForeclosure) distressReasons.push("Foreclosure");
    if (equityPct >= 40) distressReasons.push("Strong Equity Cushion");

    const breakdown = calculateOpportunityBreakdown({
      id: options?.propertyId || 0,
      org_id: orgId,
      apn: unifiedRecord.apn || "",
      address_line1: unifiedRecord.addressLine1,
      city: unifiedRecord.city,
      state: unifiedRecord.state,
      zip: unifiedRecord.zipCode,
      county: unifiedRecord.county || "",
      property_type: unifiedRecord.specs.propertyType || "Single Family",
      estimated_value: estVal,
      estimated_equity: estEquity,
      equity_percent: equityPct,
      is_absentee_owner: isAbsentee,
      is_vacant: isVacant,
      tax_delinquent: taxDelinquent,
      is_pre_foreclosure: isPreForeclosure,
      is_foreclosure: isForeclosure,
      is_probate: false,
      is_bankruptcy: false,
      has_liens: Boolean(unifiedRecord.publicRecords?.hasLiens),
      has_code_violations: false,
      owner_name: unifiedRecord.owner?.ownerName || "Property Owner",
      revzenta_opportunity_score: 0,
      opportunity_score_reasons: [],
      source_provider: unifiedRecord.primarySource || "rentcast",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      value_range_high: unifiedRecord.valuation.valueRangeHigh,
      value_range_low: unifiedRecord.valuation.valueRangeLow,
    });
    const score = breakdown.totalScore;

    // 3. Persist / Update database record (PostgreSQL or SQLite)
    const dbConfig = getDatabaseConfig();
    let savedPropertyId = options?.propertyId;

    if (savedPropertyId) {
      // Update existing property record
      if (dbConfig.isPostgres) {
        await pgQuery(
          `UPDATE properties SET
            bedrooms = COALESCE($1, bedrooms),
            bathrooms = COALESCE($2, bathrooms),
            square_feet = COALESCE($3, square_feet),
            lot_size_sqft = COALESCE($4, lot_size_sqft),
            year_built = COALESCE($5, year_built),
            estimated_value = COALESCE($6, estimated_value),
            value_range_low = COALESCE($7, value_range_low),
            value_range_high = COALESCE($8, value_range_high),
            estimated_equity = COALESCE($9, estimated_equity),
            equity_percent = COALESCE($10, equity_percent),
            is_absentee_owner = COALESCE($11, is_absentee_owner),
            is_vacant = COALESCE($12, is_vacant),
            tax_delinquent = COALESCE($13, tax_delinquent),
            is_pre_foreclosure = COALESCE($14, is_pre_foreclosure),
            revzenta_opportunity_score = $15,
            opportunity_score_reasons = $16,
            updated_at = NOW()
          WHERE id = $17 AND org_id = $18`,
          [
            unifiedRecord.specs.bedrooms,
            unifiedRecord.specs.bathrooms,
            unifiedRecord.specs.squareFootage,
            unifiedRecord.specs.lotSizeSqft,
            unifiedRecord.specs.yearBuilt,
            estVal,
            unifiedRecord.valuation.valueRangeLow,
            unifiedRecord.valuation.valueRangeHigh,
            estEquity,
            equityPct,
            isAbsentee,
            isVacant,
            taxDelinquent,
            isPreForeclosure,
            score,
            JSON.stringify(distressReasons),
            savedPropertyId,
            orgId,
          ]
        );
      } else {
        db.query(
          `UPDATE properties SET
            bedrooms = COALESCE(?, bedrooms),
            bathrooms = COALESCE(?, bathrooms),
            square_feet = COALESCE(?, square_feet),
            lot_size_sqft = COALESCE(?, lot_size_sqft),
            year_built = COALESCE(?, year_built),
            estimated_value = COALESCE(?, estimated_value),
            value_range_low = COALESCE(?, value_range_low),
            value_range_high = COALESCE(?, value_range_high),
            estimated_equity = COALESCE(?, estimated_equity),
            equity_percent = COALESCE(?, equity_percent),
            is_absentee_owner = COALESCE(?, is_absentee_owner),
            is_vacant = COALESCE(?, is_vacant),
            tax_delinquent = COALESCE(?, taxDelinquent),
            is_pre_foreclosure = COALESCE(?, is_pre_foreclosure),
            revzenta_opportunity_score = ?,
            opportunity_score_reasons = ?,
            updated_at = datetime('now')
          WHERE id = ? AND org_id = ?`
        ).run(
          unifiedRecord.specs.bedrooms ?? null,
          unifiedRecord.specs.bathrooms ?? null,
          unifiedRecord.specs.squareFootage ?? null,
          unifiedRecord.specs.lotSizeSqft ?? null,
          unifiedRecord.specs.yearBuilt ?? null,
          estVal || null,
          unifiedRecord.valuation.valueRangeLow ?? null,
          unifiedRecord.valuation.valueRangeHigh ?? null,
          estEquity || null,
          equityPct || null,
          isAbsentee ? 1 : 0,
          isVacant ? 1 : 0,
          taxDelinquent ? 1 : 0,
          isPreForeclosure ? 1 : 0,
          score,
          JSON.stringify(distressReasons),
          savedPropertyId,
          orgId
        );
      }
    }

    return {
      success: true,
      property: unifiedRecord,
      savedPropertyId,
      sources,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      success: false,
      property: null,
      sources: [],
      executionTimeMs: Date.now() - startTime,
      message: err.message || "Enrichment pipeline failure.",
    };
  }
}

/**
 * Returns list and live readiness of all registered data providers.
 */
export async function getRegisteredProvidersStatus(orgId?: number): Promise<
  Array<{
    id: string;
    name: string;
    types: string[];
    isAvailable: boolean;
  }>
> {
  const providers = providerRegistry.listProviders();
  const statuses = await Promise.all(
    providers.map(async (p) => {
      const propProvider = providerRegistry.getPropertyProvider(p.id);
      const isAvailable = propProvider ? await propProvider.isAvailable(orgId) : false;
      return {
        id: p.id,
        name: p.name,
        types: p.types,
        isAvailable,
      };
    })
  );
  return statuses;
}
