import { Type } from "@google/genai";
import { getGeminiClient, recordGeminiRequest } from "./geminiClient";
import type { PropertySearchFilters } from "../propertySearch";

export interface DetectedSearchEntities {
  geography?: {
    state?: string;
    county?: string;
    city?: string;
    zip?: string;
  };
  priceRange?: {
    min?: number;
    max?: number;
  };
  equityRange?: {
    minPct?: number;
    maxPct?: number;
  };
  distressSignals?: string[];
  propertyTypes?: string[];
  ownerStatus?: string;
}

export interface TranslatedSearchQuery {
  rawPrompt: string;
  filters: PropertySearchFilters;
  interpretation: string;
  confidence: number;
  detectedEntities: DetectedSearchEntities;
  usedAI: boolean;
  model?: string;
}

const US_STATES: Record<string, string> = {
  arizona: "AZ",
  az: "AZ",
  florida: "FL",
  fl: "FL",
  texas: "TX",
  tx: "TX",
  california: "CA",
  ca: "CA",
  georgia: "GA",
  ga: "GA",
  ohio: "OH",
  oh: "OH",
  pennsylvania: "PA",
  pa: "PA",
  "north carolina": "NC",
  nc: "NC",
  tennessee: "TN",
  tn: "TN",
  nevada: "NV",
  nv: "NV",
  colorado: "CO",
  co: "CO",
  illinois: "IL",
  il: "IL",
  michigan: "MI",
  mi: "MI",
  washington: "WA",
  wa: "WA",
  virginia: "VA",
  va: "VA",
  missouri: "MO",
  mo: "MO",
  indiana: "IN",
  in: "IN",
};

/**
 * Deterministic rule-based query parser.
 * Always works without external dependencies, offline, and serves as instant fallback.
 */
export function parseQueryDeterministically(prompt: string): TranslatedSearchQuery {
  const p = prompt.trim();
  const lower = p.toLowerCase();
  const filters: PropertySearchFilters = {};
  const distressSignals: string[] = [];
  const detected: DetectedSearchEntities = {};

  // 1. County extraction (e.g. "Maricopa County", "Cook County")
  const countyMatch = p.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+County\b/i);
  if (countyMatch) {
    let rawCounty = countyMatch[1].trim();
    // Strip common prepositions
    rawCounty = rawCounty.replace(/^(?:in|at|near|within|for|of)\s+/i, "").trim();
    // Normalize casing
    const county = rawCounty.charAt(0).toUpperCase() + rawCounty.slice(1).toLowerCase();
    filters.county = county;
    detected.geography = { ...detected.geography, county };
  }

  // 2. State extraction
  // First check if known county implies state
  const KNOWN_COUNTY_STATES: Record<string, string> = {
    maricopa: "AZ",
    pima: "AZ",
    cook: "IL",
    harris: "TX",
    dallas: "TX",
    tarrant: "TX",
    bexar: "TX",
    travis: "TX",
    "miami-dade": "FL",
    broward: "FL",
    hillsborough: "FL",
    orange: "FL",
    pinellas: "FL",
    fulton: "GA",
    clark: "NV",
    "los angeles": "CA",
    "san diego": "CA",
    king: "WA",
    wayne: "MI",
    cuyahoga: "OH",
    franklin: "OH",
    allegheny: "PA",
    philadelphia: "PA",
  };

  if (filters.county && KNOWN_COUNTY_STATES[filters.county.toLowerCase()]) {
    const stateCode = KNOWN_COUNTY_STATES[filters.county.toLowerCase()];
    filters.state = stateCode;
    detected.geography = { ...detected.geography, state: stateCode };
  }

  // Check full state names case-insensitively
  for (const [name, code] of Object.entries(US_STATES)) {
    if (name.length > 2) {
      const regex = new RegExp(`\\b${name}\\b`, "i");
      if (regex.test(lower)) {
        filters.state = code;
        detected.geography = { ...detected.geography, state: code };
        break;
      }
    }
  }

  // Check explicit 2-letter uppercase state codes (e.g. "AZ", "TX", "FL", or ", AZ")
  if (!filters.state) {
    const uppercaseCodeMatch = p.match(/\b([A-Z]{2})\b/);
    if (uppercaseCodeMatch) {
      const candidate = uppercaseCodeMatch[1];
      // Exclude common English 2-letter uppercase words unless preceded by comma
      const commonWords = new Set(["IN", "OR", "ME", "ON", "AT", "TO", "BY", "IF", "AS", "SO", "NO", "DO"]);
      const isPrecededByComma = new RegExp(`,\\s*${candidate}\\b`).test(p);
      if (Object.values(US_STATES).includes(candidate) && (!commonWords.has(candidate) || isPrecededByComma)) {
        filters.state = candidate;
        detected.geography = { ...detected.geography, state: candidate };
      }
    }
  }

  // 3. 5-digit ZIP code
  const zipMatch = p.match(/\b(\d{5})\b/);
  if (zipMatch) {
    filters.zip = zipMatch[1];
    detected.geography = { ...detected.geography, zip: zipMatch[1] };
  }

  // Helper to parse numbers like $300k, $1.2M, $450,000, 300000
  const parseVal = (numStr: string, multiplierStr: string = ""): number => {
    let clean = numStr.replace(/[$,]/g, "");
    let val = parseFloat(clean);
    const m = multiplierStr.toLowerCase();
    if (m === "k") val *= 1_000;
    else if (m === "m") val *= 1_000_000;
    return Math.round(val);
  };

  // 4. Price range: "$300k-$600k", "$300k to $600k", "$300,000 - $600,000"
  const rangeMatch = p.match(/\$?(\d+(?:\.\d+)?)\s*([kKmM]?)\s*(?:-|to)\s*\$?(\d+(?:\.\d+)?)\s*([kKmM]?)/i);
  if (rangeMatch) {
    const mult1 = rangeMatch[2] || rangeMatch[4]; // if "$300 - 600k", both are k
    const mult2 = rangeMatch[4] || rangeMatch[2];
    const min = parseVal(rangeMatch[1], mult1);
    const max = parseVal(rangeMatch[3], mult2);
    if (min > 0 && max > min) {
      filters.minValue = min;
      filters.maxValue = max;
      detected.priceRange = { min, max };
    }
  } else {
    // Under / Less than
    const underMatch = p.match(/(?:under|less than|max(?:imum)?)\s*\$?(\d+(?:\.\d+)?)\s*([kKmM]?)/i);
    if (underMatch) {
      const max = parseVal(underMatch[1], underMatch[2]);
      filters.maxValue = max;
      detected.priceRange = { max };
    }
    // Over / More than
    const overMatch = p.match(/(?:over|more than|min(?:imum)?)\s*\$?(\d+(?:\.\d+)?)\s*([kKmM]?)/i);
    if (overMatch) {
      const min = parseVal(overMatch[1], overMatch[2]);
      filters.minValue = min;
      detected.priceRange = { min };
    }
  }

  // 5. Equity percentage: ">40% equity", "40%+ equity", "at least 50% equity"
  const equityMatch = p.match(/(?:>|greater than|at least|min(?:imum)?|\+)?\s*(\d{1,2})%\s*(?:equity|\+)/i);
  if (equityMatch) {
    const eq = parseInt(equityMatch[1], 10);
    if (!isNaN(eq) && eq > 0) {
      filters.minEquityPct = eq;
      detected.equityRange = { minPct: eq };
    }
  } else if (/high\s+equity/i.test(lower)) {
    filters.minEquityPct = 40;
    detected.equityRange = { minPct: 40 };
  } else if (/free\s+and\s+clear/i.test(lower)) {
    filters.minEquityPct = 90;
    detected.equityRange = { minPct: 90 };
  }

  // 6. Distress & Motivations
  if (/absentee|out\s+of\s+state|non-owner\s+occupied/i.test(lower)) {
    filters.isAbsenteeOwner = true;
    distressSignals.push("Absentee Owner");
    detected.ownerStatus = "Absentee Owner";
  }
  if (/vacant|unoccupied|empty/i.test(lower)) {
    filters.isVacant = true;
    distressSignals.push("Vacant");
  }
  if (/tax\s+delinquent|back\s+taxes|unpaid\s+taxes|tax\s+lien/i.test(lower)) {
    filters.taxDelinquent = true;
    distressSignals.push("Tax Delinquent");
  }
  if (/pre-?foreclosure|notice\s+of\s+default/i.test(lower)) {
    filters.isPreForeclosure = true;
    distressSignals.push("Pre-Foreclosure");
  }
  if (/\bforeclosure\b|\breo\b|bank\s+owned/i.test(lower)) {
    filters.isForeclosure = true;
    distressSignals.push("Foreclosure / Bank Owned");
  }
  if (/probate|inherited|estate\s+sale/i.test(lower)) {
    filters.isProbate = true;
    distressSignals.push("Probate / Estate");
  }
  if (/bankruptcy/i.test(lower)) {
    filters.isBankruptcy = true;
    distressSignals.push("Bankruptcy");
  }
  if (/liens?/i.test(lower)) {
    filters.hasLiens = true;
    distressSignals.push("Recorded Liens");
  }

  // 7. Property specs
  const bedsMatch = p.match(/(\d+)\+?\s*(?:beds?|bedrooms?)/i);
  if (bedsMatch) {
    filters.minBeds = parseInt(bedsMatch[1], 10);
  }
  const bathsMatch = p.match(/(\d+(?:\.\d+)?)\+?\s*(?:baths?|bathrooms?)/i);
  if (bathsMatch) {
    filters.minBaths = parseFloat(bathsMatch[1]);
  }
  if (/single\s+family|single-family|\bsfr\b/i.test(lower)) {
    filters.propertyTypes = ["Single Family"];
    detected.propertyTypes = ["Single Family"];
  } else if (/multi-?family|duplex|triplex|fourplex/i.test(lower)) {
    filters.propertyTypes = ["Multi-Family"];
    detected.propertyTypes = ["Multi-Family"];
  }

  // Set default sorting by Revzenta Opportunity Score
  filters.sortBy = "revzenta_opportunity_score";
  filters.sortOrder = "desc";

  if (distressSignals.length > 0) {
    detected.distressSignals = distressSignals;
  }

  // Build human-friendly interpretation
  const parts: string[] = [];
  if (filters.isAbsenteeOwner) parts.push("absentee-owned");
  if (filters.isVacant) parts.push("vacant");
  if (filters.taxDelinquent) parts.push("tax delinquent");
  if (filters.isPreForeclosure) parts.push("pre-foreclosure");
  if (filters.isProbate) parts.push("probate");

  let loc = "";
  if (filters.county) loc += `${filters.county} County`;
  if (filters.state) loc += loc ? `, ${filters.state}` : filters.state;

  let interpretation = `Searching for ${parts.length ? parts.join(", ") + " " : ""}properties`;
  if (loc) interpretation += ` in ${loc}`;
  if (filters.minValue && filters.maxValue) {
    interpretation += ` valued between $${filters.minValue.toLocaleString()} and $${filters.maxValue.toLocaleString()}`;
  } else if (filters.minValue) {
    interpretation += ` valued over $${filters.minValue.toLocaleString()}`;
  } else if (filters.maxValue) {
    interpretation += ` valued under $${filters.maxValue.toLocaleString()}`;
  }
  if (filters.minEquityPct) {
    interpretation += ` with at least ${filters.minEquityPct}% equity`;
  }
  interpretation += " ranked by Revzenta Opportunity Score.";

  return {
    rawPrompt: prompt,
    filters,
    interpretation,
    confidence: 0.95,
    detectedEntities: detected,
    usedAI: false,
  };
}

/**
 * Translates natural language search queries into structured PropertySearchFilters.
 * Utilizes Gemini 2.5 Flash with structured JSON output when configured,
 * and gracefully falls back to deterministic parsing if offline or rate limited.
 */
export async function translateNaturalLanguageSearch(
  prompt: string
): Promise<TranslatedSearchQuery> {
  if (!prompt || !prompt.trim()) {
    return {
      rawPrompt: "",
      filters: { sortBy: "revzenta_opportunity_score", sortOrder: "desc" },
      interpretation: "Empty search query. Showing top wholesale opportunities.",
      confidence: 1.0,
      detectedEntities: {},
      usedAI: false,
    };
  }

  const { client, model, isConfigured } = getGeminiClient();

  // If Gemini API is not configured, use robust deterministic engine immediately
  if (!client || !isConfigured) {
    return parseQueryDeterministically(prompt);
  }

  const systemPrompt = `You are the Revzenta Real Estate Query Intelligence engine.
Your mission is to translate natural language property investor search queries into a precise structured JSON search filter object.

Supported property search criteria:
- state: 2-letter uppercase US state code (e.g. "AZ", "FL", "TX")
- county: county name without the word 'County' (e.g. "Maricopa", "Harris", "Cook")
- city: city name
- zip: 5-digit postal code
- minValue: minimum estimated property value (integer in USD)
- maxValue: maximum estimated property value (integer in USD)
- minEquityPct: minimum equity percentage as an integer between 0 and 100 (e.g. 40 for >40% equity)
- maxEquityPct: maximum equity percentage (0-100)
- minBeds: minimum bedroom count
- minBaths: minimum bathroom count
- minSqft: minimum square footage
- maxSqft: maximum square footage
- propertyTypes: array of property types (e.g. ["Single Family", "Multi-Family", "Condo"])
- isAbsenteeOwner: boolean, true if query mentions absentee, out of state, or non-owner occupied
- isVacant: boolean, true if query mentions vacant or unoccupied
- taxDelinquent: boolean, true if query mentions tax delinquent, back taxes, or tax liens
- isPreForeclosure: boolean, true if query mentions pre-foreclosure or default
- isForeclosure: boolean, true if query mentions foreclosure or REO
- isProbate: boolean, true if query mentions probate or inherited
- minOpportunityScore: minimum Revzenta Opportunity Score (0-100)

Never fabricate geographic boundaries or criteria that the user did not state or strongly imply.
Explain your understanding clearly in 'interpretation'.`;

  try {
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\nUser Query: "${prompt}"\n\nGenerate structured search parameters adhering to the schema.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            filters: {
              type: Type.OBJECT,
              properties: {
                state: { type: Type.STRING, description: "2-letter uppercase state code" },
                county: { type: Type.STRING, description: "County name without 'County'" },
                city: { type: Type.STRING },
                zip: { type: Type.STRING },
                minValue: { type: Type.NUMBER },
                maxValue: { type: Type.NUMBER },
                minEquityPct: { type: Type.NUMBER },
                maxEquityPct: { type: Type.NUMBER },
                minBeds: { type: Type.NUMBER },
                minBaths: { type: Type.NUMBER },
                minSqft: { type: Type.NUMBER },
                maxSqft: { type: Type.NUMBER },
                propertyTypes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                isAbsenteeOwner: { type: Type.BOOLEAN },
                isVacant: { type: Type.BOOLEAN },
                taxDelinquent: { type: Type.BOOLEAN },
                isPreForeclosure: { type: Type.BOOLEAN },
                isForeclosure: { type: Type.BOOLEAN },
                isProbate: { type: Type.BOOLEAN },
                minOpportunityScore: { type: Type.NUMBER },
              },
            },
            interpretation: {
              type: Type.STRING,
              description: "Clear, transparent summary of how the query was understood",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence score between 0.0 and 1.0",
            },
            detectedEntities: {
              type: Type.OBJECT,
              properties: {
                geography: {
                  type: Type.OBJECT,
                  properties: {
                    state: { type: Type.STRING },
                    county: { type: Type.STRING },
                    city: { type: Type.STRING },
                    zip: { type: Type.STRING },
                  },
                },
                priceRange: {
                  type: Type.OBJECT,
                  properties: {
                    min: { type: Type.NUMBER },
                    max: { type: Type.NUMBER },
                  },
                },
                equityRange: {
                  type: Type.OBJECT,
                  properties: {
                    minPct: { type: Type.NUMBER },
                    maxPct: { type: Type.NUMBER },
                  },
                },
                distressSignals: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                propertyTypes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                ownerStatus: { type: Type.STRING },
              },
            },
          },
          required: ["filters", "interpretation", "confidence"],
        },
      },
    });

    recordGeminiRequest(true);

    const jsonText = response.text || "";
    const parsed = JSON.parse(jsonText);

    // Merge default sort parameters
    const filters: PropertySearchFilters = {
      ...parsed.filters,
      sortBy: parsed.filters?.sortBy || "revzenta_opportunity_score",
      sortOrder: parsed.filters?.sortOrder || "desc",
    };

    return {
      rawPrompt: prompt,
      filters,
      interpretation: parsed.interpretation || "Parsed search query with Revzenta AI.",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
      detectedEntities: parsed.detectedEntities || {},
      usedAI: true,
      model,
    };
  } catch (err) {
    recordGeminiRequest(false);
    console.warn("[QueryTranslator] Gemini AI query translation error, falling back to deterministic parser:", err);
    const fallback = parseQueryDeterministically(prompt);
    fallback.interpretation += " (Processed via deterministic NLP engine)";
    return fallback;
  }
}
