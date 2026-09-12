import { Type } from "@google/genai";
import { getGeminiClient, recordGeminiRequest } from "./geminiClient";
import type { PropertyRow } from "../propertySearch";

export interface OpportunityScoreBreakdown {
  totalScore: number;
  equityScore: number; // 0 - 35 pts
  distressScore: number; // 0 - 40 pts
  spreadScore: number; // 0 - 25 pts
  explanation: string;
}

export interface WholesaleStrategyRecommendation {
  strategy: "Cash Wholesale" | "Wholetail" | "Subject-To" | "Seller Financing" | "Novation";
  suitabilityScore: number; // 0 - 100
  rationale: string;
}

export interface PropertyDealExplanation {
  propertyId: number;
  headline: string;
  summary: string;
  opportunityScoreBreakdown: OpportunityScoreBreakdown;
  keyStrengths: string[];
  riskFactors: string[];
  recommendedStrategies: WholesaleStrategyRecommendation[];
  dataDisclaimer: string;
  isAiGenerated: boolean;
  model?: string;
}

/**
 * Calculates explainable Revzenta Opportunity Score components strictly from data.
 * Zero fabrication, completely deterministic and mathematically transparent.
 */
export function calculateOpportunityBreakdown(property: PropertyRow): OpportunityScoreBreakdown {
  let equityScore = 0;
  let distressScore = 0;
  let spreadScore = 0;

  // 1. Equity Score (0 - 35 points)
  const equityPct = property.estimated_value > 0
    ? (property.estimated_equity / property.estimated_value) * 100
    : 0;

  if (equityPct >= 70) equityScore = 35;
  else if (equityPct >= 50) equityScore = 28;
  else if (equityPct >= 40) equityScore = 20;
  else if (equityPct >= 25) equityScore = 12;
  else equityScore = Math.max(0, Math.round((equityPct / 100) * 20));

  // 2. Distress Score (0 - 40 points)
  if (property.is_vacant) distressScore += 15;
  if (property.tax_delinquent) distressScore += 12;
  if (property.is_pre_foreclosure) distressScore += 15;
  if (property.is_foreclosure) distressScore += 18;
  if (property.is_probate) distressScore += 12;
  if (property.is_absentee_owner) distressScore += 8;
  if (property.is_bankruptcy) distressScore += 10;
  if (property.has_liens) distressScore += 8;
  distressScore = Math.min(40, distressScore);

  // 3. Valuation Spread & Size Potential (0 - 25 points)
  if (property.value_range_high && property.value_range_low && property.estimated_value > 0) {
    const spread = (property.value_range_high - property.value_range_low) / property.estimated_value;
    if (spread >= 0.25) spreadScore = 20;
    else if (spread >= 0.15) spreadScore = 15;
    else spreadScore = 10;
  } else {
    spreadScore = 12; // Standard default baseline
  }

  const totalScore = Math.min(100, Math.round(equityScore + distressScore + spreadScore));

  const explanation = `Total Score ${totalScore}/100 composed of ${equityScore}/35 Equity Cushion (${Math.round(equityPct)}% equity), ${distressScore}/40 Motivation & Distress Factors, and ${spreadScore}/25 Valuation Spread.`;

  return {
    totalScore,
    equityScore,
    distressScore,
    spreadScore,
    explanation,
  };
}

/**
 * Deterministic Deal Explainer when Gemini is absent or during fast offline queries.
 */
export function explainDealDeterministically(property: PropertyRow): PropertyDealExplanation {
  const breakdown = calculateOpportunityBreakdown(property);
  const strengths: string[] = [];
  const risks: string[] = [];
  const strategies: WholesaleStrategyRecommendation[] = [];

  const equityPct = property.estimated_value > 0
    ? (property.estimated_equity / property.estimated_value) * 100
    : 0;

  // Strengths
  if (equityPct >= 40) {
    strengths.push(`Substantial equity cushion of ${Math.round(equityPct)}% ($${Math.round(property.estimated_equity).toLocaleString()}) offers strong discount margin.`);
  }
  if (property.is_absentee_owner) {
    strengths.push("Absentee owner indicates potential fatigue or willingness to negotiate off-market terms.");
  }
  if (property.is_vacant) {
    strengths.push("Vacant property presents holding cost pain for the owner and allows immediate walkthroughs/access.");
  }
  if (property.tax_delinquent) {
    strengths.push("Tax delinquency signals urgent seller timeline and acute financial motivation.");
  }
  if (property.square_feet && property.square_feet > 1800) {
    strengths.push(`Generous living area of ${property.square_feet.toLocaleString()} sqft provides versatile buyer resale appeal.`);
  }

  // Risks
  if (equityPct < 25) {
    risks.push("Thin equity margin limits traditional cash wholesale spread; creative financing may be required.");
  }
  if (property.year_built && property.year_built < 1975) {
    risks.push(`Built in ${property.year_built}; inspect for aging electrical, galvanized plumbing, and lead paint.`);
  }
  if (property.has_liens) {
    risks.push("Recorded liens on title must be audited for payoff amounts prior to contract execution.");
  }
  if (property.is_pre_foreclosure) {
    risks.push("Pre-foreclosure auction timelines restrict closing windows; requires fast lender communication.");
  }

  // Strategies
  if (equityPct >= 40 && (property.is_absentee_owner || property.is_vacant || property.tax_delinquent)) {
    strategies.push({
      strategy: "Cash Wholesale",
      suitabilityScore: 92,
      rationale: "Strong equity coupled with verified motivation allows securing deep contract discount for quick assignment fee.",
    });
  }
  if (equityPct >= 60) {
    strategies.push({
      strategy: "Seller Financing",
      suitabilityScore: 85,
      rationale: "High equity enables offering owner monthly interest cashflow with little to no underlying mortgage wrap.",
    });
  }
  if (equityPct < 35 && !property.is_vacant) {
    strategies.push({
      strategy: "Subject-To",
      suitabilityScore: 78,
      rationale: "Low equity can be acquired by taking over existing low-rate mortgage payments with minimal cash to close.",
    });
  }

  if (strategies.length === 0) {
    strategies.push({
      strategy: "Cash Wholesale",
      suitabilityScore: 65,
      rationale: "Standard assignment candidate contingent on securing 70% of After Repair Value minus rehab.",
    });
  }

  const headline = `${property.property_type || "Single Family"} in ${property.city}, ${property.state} — Score ${breakdown.totalScore}/100`;
  const summary = `Property features an estimated value of $${property.estimated_value.toLocaleString()} with ${Math.round(equityPct)}% estimated equity. ${strengths[0] || "Viable investment opportunity with multiple exit strategies."}`;

  return {
    propertyId: property.id,
    headline,
    summary,
    opportunityScoreBreakdown: breakdown,
    keyStrengths: strengths.length ? strengths : ["Stable asset with predictable market comps."],
    riskFactors: risks.length ? risks : ["Verify structural condition and municipal code compliance."],
    recommendedStrategies: strategies,
    dataDisclaimer: "Estimates generated for underwriting assistance. Public records, titles, and liens must be independently verified.",
    isAiGenerated: false,
  };
}

/**
 * Explains a property deal using Gemini AI reasoning with deterministic verification.
 */
export async function explainPropertyDeal(
  property: PropertyRow
): Promise<PropertyDealExplanation> {
  const breakdown = calculateOpportunityBreakdown(property);
  const baseline = explainDealDeterministically(property);

  const { client, model, isConfigured } = getGeminiClient();
  if (!client || !isConfigured) {
    return baseline;
  }

  const systemPrompt = `You are the Revzenta Real Estate Deal Intelligence analyst.
Analyze the following property data for a professional real estate investor / wholesaler.
Highlight key deal strengths, risks, explain why the Revzenta Opportunity Score is ${breakdown.totalScore}/100, and evaluate the best investment angle (Cash Wholesale, Seller Financing, SubTo, Wholetail).

CRITICAL RULES:
- Never fabricate mortgage balances, interest rates, or owner names.
- Do not claim absolute certainty. Mark valuations as estimates.
- Base your analysis directly on the provided data attributes.`;

  const propertyPayload = JSON.stringify({
    address: `${property.address_line1}, ${property.city}, ${property.state} ${property.zip}`,
    county: property.county,
    propertyType: property.property_type,
    beds: property.bedrooms,
    baths: property.bathrooms,
    sqft: property.square_feet,
    yearBuilt: property.year_built,
    estimatedValue: property.estimated_value,
    estimatedEquity: property.estimated_equity,
    equityPercent: property.estimated_value > 0 ? Math.round((property.estimated_equity / property.estimated_value) * 100) : 0,
    isAbsenteeOwner: property.is_absentee_owner,
    isVacant: property.is_vacant,
    taxDelinquent: property.tax_delinquent,
    isPreForeclosure: property.is_pre_foreclosure,
    opportunityScoreBreakdown: breakdown,
  }, null, 2);

  try {
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\nProperty Details:\n${propertyPayload}\n\nGenerate structured deal analysis adhering to the JSON schema.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyStrengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            riskFactors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recommendedStrategies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  strategy: {
                    type: Type.STRING,
                    description: "Cash Wholesale, Wholetail, Subject-To, Seller Financing, or Novation",
                  },
                  suitabilityScore: { type: Type.NUMBER },
                  rationale: { type: Type.STRING },
                },
                required: ["strategy", "suitabilityScore", "rationale"],
              },
            },
          },
          required: ["headline", "summary", "keyStrengths", "riskFactors", "recommendedStrategies"],
        },
      },
    });

    recordGeminiRequest(true);

    const jsonText = response.text || "";
    const parsed = JSON.parse(jsonText);

    return {
      propertyId: property.id,
      headline: parsed.headline || baseline.headline,
      summary: parsed.summary || baseline.summary,
      opportunityScoreBreakdown: breakdown,
      keyStrengths: Array.isArray(parsed.keyStrengths) && parsed.keyStrengths.length > 0 ? parsed.keyStrengths : baseline.keyStrengths,
      riskFactors: Array.isArray(parsed.riskFactors) && parsed.riskFactors.length > 0 ? parsed.riskFactors : baseline.riskFactors,
      recommendedStrategies: Array.isArray(parsed.recommendedStrategies) && parsed.recommendedStrategies.length > 0 ? parsed.recommendedStrategies : baseline.recommendedStrategies,
      dataDisclaimer: "Estimates generated for underwriting assistance. Public records, titles, and liens must be independently verified.",
      isAiGenerated: true,
      model,
    };
  } catch (err) {
    recordGeminiRequest(false);
    console.warn("[DealExplainer] Gemini AI deal explanation failed, falling back to deterministic analysis:", err);
    return baseline;
  }
}
