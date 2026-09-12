import type {
  NormalizedPropertyRecord,
  NormalizedValuation,
  SourceTrackedValue,
  SaleTransaction,
  MortgageRecord,
  PublicRecordIndicators,
} from "./types";

/**
 * Resolves valuation discrepancies deterministically without overwriting raw source data.
 */
export function resolveValuation(
  sources: SourceTrackedValue<number>[]
): NormalizedValuation {
  if (sources.length === 0) {
    return {};
  }

  if (sources.length === 1) {
    const s = sources[0];
    return {
      estimatedValue: s.value,
      valueRangeLow: Math.round(s.value * 0.95),
      valueRangeHigh: Math.round(s.value * 1.05),
      sourceValues: [s],
      spreadPct: 0,
    };
  }

  // Multi-source conflict resolution: weighted average by confidence score
  let weightedSum = 0;
  let totalConfidence = 0;
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (const s of sources) {
    const conf = Math.max(0.1, s.confidence || 0.5);
    weightedSum += s.value * conf;
    totalConfidence += conf;
    if (s.value < minVal) minVal = s.value;
    if (s.value > maxVal) maxVal = s.value;
  }

  const compositeEstimate = totalConfidence > 0 ? Math.round(weightedSum / totalConfidence) : sources[0].value;
  const avg = (minVal + maxVal) / 2;
  const spreadPct = avg > 0 ? Number((((maxVal - minVal) / avg) * 100).toFixed(1)) : 0;

  return {
    estimatedValue: compositeEstimate,
    valueRangeLow: minVal,
    valueRangeHigh: maxVal,
    sourceValues: sources,
    spreadPct,
  };
}

/**
 * Merges property intelligence records from multiple providers deterministically.
 */
export function mergePropertyRecords(
  records: NormalizedPropertyRecord[]
): NormalizedPropertyRecord | null {
  if (!records || records.length === 0) return null;
  if (records.length === 1) return records[0];

  // Base record: take the one with highest overall confidence
  const sorted = [...records].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const primary = sorted[0];

  // 1. Merge Valuations
  const valuationSources: SourceTrackedValue<number>[] = [];
  for (const r of records) {
    if (r.valuation?.estimatedValue != null) {
      valuationSources.push({
        source: r.primarySource,
        value: r.valuation.estimatedValue,
        confidence: r.confidenceScore,
        retrievedAt: r.retrievedAt,
      });
    }
  }
  const resolvedValuation = resolveValuation(valuationSources);

  // 2. Merge Specs (fill in blanks from lower-priority providers)
  const mergedSpecs = { ...primary.specs };
  for (const r of sorted.slice(1)) {
    if (mergedSpecs.bedrooms == null && r.specs.bedrooms != null) mergedSpecs.bedrooms = r.specs.bedrooms;
    if (mergedSpecs.bathrooms == null && r.specs.bathrooms != null) mergedSpecs.bathrooms = r.specs.bathrooms;
    if (mergedSpecs.squareFootage == null && r.specs.squareFootage != null) mergedSpecs.squareFootage = r.specs.squareFootage;
    if (mergedSpecs.lotSizeSqft == null && r.specs.lotSizeSqft != null) mergedSpecs.lotSizeSqft = r.specs.lotSizeSqft;
    if (mergedSpecs.yearBuilt == null && r.specs.yearBuilt != null) mergedSpecs.yearBuilt = r.specs.yearBuilt;
    if (mergedSpecs.stories == null && r.specs.stories != null) mergedSpecs.stories = r.specs.stories;
    if (!mergedSpecs.propertyType && r.specs.propertyType) mergedSpecs.propertyType = r.specs.propertyType;
  }

  // 3. Deduplicate Sales History
  const salesMap = new Map<string, SaleTransaction>();
  for (const r of records) {
    for (const s of r.salesHistory || []) {
      const key = `${s.saleDate}_${s.salePrice}`;
      if (!salesMap.has(key)) {
        salesMap.set(key, s);
      }
    }
  }
  const mergedSales = Array.from(salesMap.values()).sort(
    (a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
  );

  // 4. Deduplicate Mortgage History
  const mortgageMap = new Map<string, MortgageRecord>();
  for (const r of records) {
    for (const m of r.mortgageHistory || []) {
      const key = `${m.recordingDate}_${m.loanAmount}`;
      if (!mortgageMap.has(key)) {
        mortgageMap.set(key, m);
      }
    }
  }
  const mergedMortgages = Array.from(mortgageMap.values()).sort(
    (a, b) => new Date(b.recordingDate).getTime() - new Date(a.recordingDate).getTime()
  );

  // 5. Aggregate Public Records / Distress Signals
  const distressSet = new Set<string>();
  let hasLiens = false;
  let isPreForeclosure = false;
  let isForeclosure = false;
  let isBankruptcy = false;
  let isProbate = false;
  let isVacant = false;
  let hasCodeViolations = false;
  let totalLienAmount = 0;

  for (const r of records) {
    const pr = r.publicRecords;
    if (pr) {
      if (pr.hasLiens) hasLiens = true;
      if (pr.isPreForeclosure) isPreForeclosure = true;
      if (pr.isForeclosure) isForeclosure = true;
      if (pr.isBankruptcy) isBankruptcy = true;
      if (pr.isProbate) isProbate = true;
      if (pr.isVacant) isVacant = true;
      if (pr.hasCodeViolations) hasCodeViolations = true;
      if (pr.totalLienAmount && pr.totalLienAmount > totalLienAmount) totalLienAmount = pr.totalLienAmount;
      for (const sig of pr.distressSignals || []) {
        distressSet.add(sig);
      }
    }
  }

  const mergedPublicRecords: PublicRecordIndicators = {
    hasLiens,
    totalLienAmount: totalLienAmount || undefined,
    isPreForeclosure,
    isForeclosure,
    isBankruptcy,
    isProbate,
    isVacant,
    hasCodeViolations,
    distressSignals: Array.from(distressSet),
  };

  return {
    ...primary,
    specs: mergedSpecs,
    valuation: resolvedValuation,
    salesHistory: mergedSales,
    mortgageHistory: mergedMortgages,
    publicRecords: mergedPublicRecords,
    message: `Merged data from ${records.length} providers (${records.map((r) => r.primarySource).join(", ")})`,
  };
}
