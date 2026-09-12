import { describe, it, expect, beforeEach } from "bun:test";
import {
  getGeminiStatus,
  maskApiKey,
  getGeminiClient,
  resetGeminiTelemetry,
  recordGeminiRequest,
} from "../server/ai/geminiClient";
import {
  parseQueryDeterministically,
  translateNaturalLanguageSearch,
} from "../server/ai/queryTranslator";
import {
  calculateOpportunityBreakdown,
  explainPropertyDeal,
  explainDealDeterministically,
} from "../server/ai/dealExplainer";
import {
  getDevCommandCenterStatus,
  sanitizeSecrets,
  analyzeDevQuery,
} from "../server/ai/devCommandCenter";
import type { PropertyRow } from "../server/propertySearch";

describe("Gemini AI & Deal Intelligence Architecture", () => {
  beforeEach(() => {
    resetGeminiTelemetry();
  });

  describe("Gemini Client & Secret Protection", () => {
    it("safely detects unconfigured environment without crashing", () => {
      const { client, isConfigured, model } = getGeminiClient();
      expect(model).toBeDefined();
      if (!process.env.GEMINI_API_KEY) {
        expect(isConfigured).toBe(false);
        expect(client).toBeNull();
      }
    });

    it("masks API keys properly to prevent credential leaks", () => {
      expect(maskApiKey("AIzaSyD1234567890abcdef1234")).toBe("AIza...1234");
      expect(maskApiKey("short")).toBe("********");
      expect(maskApiKey(undefined)).toBe("NOT_CONFIGURED");
      expect(maskApiKey("")).toBe("NOT_CONFIGURED");
    });

    it("tracks request and error telemetry for Dev Command Center", () => {
      recordGeminiRequest(true);
      recordGeminiRequest(false);
      const status = getGeminiStatus();
      expect(status.requestsTotal).toBe(2);
      expect(status.errorsTotal).toBe(1);
      expect(status.lastUsedAt).toBeDefined();
    });
  });

  describe("Natural Language Search Translation", () => {
    it("translates complex real-estate query: absentee + Maricopa + $300k-$600k + >40% equity", async () => {
      const prompt = "Find absentee owners in Maricopa County with properties worth $300k-$600k and >40% equity";
      const result = await translateNaturalLanguageSearch(prompt);

      expect(result.rawPrompt).toBe(prompt);
      expect(result.filters.county).toBe("Maricopa");
      expect(result.filters.state).toBe("AZ");
      expect(result.filters.minValue).toBe(300000);
      expect(result.filters.maxValue).toBe(600000);
      expect(result.filters.minEquityPct).toBe(40);
      expect(result.filters.isAbsenteeOwner).toBe(true);
      expect(result.filters.sortBy).toBe("revzenta_opportunity_score");
      expect(result.filters.sortOrder).toBe("desc");
      expect(result.interpretation).toContain("absentee");
      expect(result.interpretation).toContain("Maricopa County");
      expect(result.detectedEntities.geography?.county).toBe("Maricopa");
      expect(result.detectedEntities.priceRange?.min).toBe(300000);
      expect(result.detectedEntities.priceRange?.max).toBe(600000);
    });

    it("parses multiple distress motivations: vacant + tax delinquent in Florida under $250k", () => {
      const prompt = "Vacant houses with back taxes in Florida under $250k";
      const result = parseQueryDeterministically(prompt);

      expect(result.filters.isVacant).toBe(true);
      expect(result.filters.taxDelinquent).toBe(true);
      expect(result.filters.state).toBe("FL");
      expect(result.filters.maxValue).toBe(250000);
      expect(result.detectedEntities.distressSignals).toContain("Vacant");
      expect(result.detectedEntities.distressSignals).toContain("Tax Delinquent");
    });

    it("parses property specs: 3+ beds, 2+ baths single family in Texas with high equity", () => {
      const prompt = "3+ bed 2+ bath single family homes with high equity in Texas";
      const result = parseQueryDeterministically(prompt);

      expect(result.filters.minBeds).toBe(3);
      expect(result.filters.minBaths).toBe(2);
      expect(result.filters.state).toBe("TX");
      expect(result.filters.propertyTypes).toEqual(["Single Family"]);
      expect(result.filters.minEquityPct).toBe(40);
    });

    it("handles pre-foreclosures, probate, and 5-digit zip codes", () => {
      const prompt = "Pre-foreclosure or probate properties in 85001 with over $100k equity";
      const result = parseQueryDeterministically(prompt);

      expect(result.filters.isPreForeclosure).toBe(true);
      expect(result.filters.isProbate).toBe(true);
      expect(result.filters.zip).toBe("85001");
      expect(result.detectedEntities.geography?.zip).toBe("85001");
    });
  });

  describe("Property Deal Explainer & Opportunity Scoring", () => {
    const mockProperty: PropertyRow = {
      id: 101,
      org_id: 1,
      apn: "123-45-678",
      address_line1: "742 Evergreen Terrace",
      city: "Phoenix",
      state: "AZ",
      zip: "85004",
      county: "Maricopa",
      property_type: "Single Family",
      bedrooms: 4,
      bathrooms: 2.5,
      square_feet: 2200,
      year_built: 1988,
      estimated_value: 450000,
      value_range_low: 410000,
      value_range_high: 495000,
      estimated_equity: 240000,
      equity_percent: 53.3,
      is_absentee_owner: true,
      is_vacant: true,
      tax_delinquent: true,
      is_pre_foreclosure: false,
      is_foreclosure: false,
      is_bankruptcy: false,
      is_probate: false,
      has_liens: false,
      has_code_violations: false,
      revzenta_opportunity_score: 82,
      opportunity_score_reasons: ["Absentee Owner", "Vacant", "Tax Delinquent", "Strong Equity Cushion"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("calculates transparent Opportunity Score breakdown without data fabrication", () => {
      const breakdown = calculateOpportunityBreakdown(mockProperty);

      expect(breakdown.totalScore).toBeGreaterThanOrEqual(50);
      expect(breakdown.totalScore).toBeLessThanOrEqual(100);
      expect(breakdown.equityScore).toBeGreaterThan(0);
      expect(breakdown.distressScore).toBeGreaterThan(0);
      expect(breakdown.spreadScore).toBeGreaterThan(0);
      expect(breakdown.explanation).toContain("Equity Cushion");
      expect(breakdown.explanation).toContain("Distress Factors");
    });

    it("generates structured wholesale deal explanation with strategies and disclaimers", async () => {
      const explanation = await explainPropertyDeal(mockProperty);

      expect(explanation.propertyId).toBe(101);
      expect(explanation.headline).toContain("Phoenix");
      expect(explanation.summary).toBeDefined();
      expect(explanation.keyStrengths.length).toBeGreaterThan(0);
      expect(explanation.riskFactors.length).toBeGreaterThan(0);
      expect(explanation.recommendedStrategies.length).toBeGreaterThan(0);

      // Verify authentic data disclaimer is present
      expect(explanation.dataDisclaimer).toContain("Estimates generated for underwriting assistance");
      expect(explanation.dataDisclaimer).toContain("independently verified");

      // Verify wholesale strategy suitability scoring
      const topStrategy = explanation.recommendedStrategies[0];
      expect(topStrategy.strategy).toBeDefined();
      expect(topStrategy.suitabilityScore).toBeGreaterThan(50);
      expect(topStrategy.rationale).toBeDefined();
    });
  });

  describe("Dev Command Center & Observability", () => {
    it("sanitizes secrets and credentials from nested objects recursively", () => {
      const sensitiveConfig = {
        app_name: "Revzenta",
        port: 3001,
        GEMINI_API_KEY: "AIzaSySecretApiKey123456789",
        DATABASE_URL: "postgres://user:super_secret_pw@host:5432/crm",
        nested: {
          client_secret: "shhh_super_secret",
          stripe_token: "tok_1234567890",
          public_info: "visible",
        },
        list: [
          { auth_bearer: "eyJh...sensitive" },
          { harmless: "ok" },
        ],
      };

      const sanitized = sanitizeSecrets(sensitiveConfig);

      expect(sanitized.app_name).toBe("Revzenta");
      expect(sanitized.port).toBe(3001);
      expect(sanitized.GEMINI_API_KEY).not.toBe("AIzaSySecretApiKey123456789");
      expect(sanitized.GEMINI_API_KEY).toContain("AIza...");
      expect(sanitized.DATABASE_URL).toContain("post...");
      expect(sanitized.nested.client_secret).toContain("shhh...");
      expect(sanitized.nested.public_info).toBe("visible");
      expect(sanitized.list[0].auth_bearer).toContain("eyJh...");
      expect(sanitized.list[1].harmless).toBe("ok");
    });

    it("retrieves system status and telemetry cleanly", async () => {
      const status = await getDevCommandCenterStatus();

      expect(status.timestamp).toBeDefined();
      expect(status.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(status.memoryUsage.rssMb).toBeGreaterThan(0);
      expect(["postgres", "sqlite"]).toContain(status.database.driver);
      expect(status.database.isHealthy).toBe(true);
      expect(status.geminiAi).toBeDefined();
      expect(status.security.secretsSanitized).toBe(true);
      expect(status.security.strictTenantIsolationEnforced).toBe(true);
    });

    it("allows read-only SELECT queries and strictly rejects destructive SQL", async () => {
      // 1. Valid read-only query
      const selectResult = await analyzeDevQuery("SELECT 1 as test");
      expect(selectResult.allowed).toBe(true);
      expect(selectResult.rowCount).toBe(1);

      // 2. Non-SELECT query rejected: DROP
      const dropResult = await analyzeDevQuery("DROP TABLE properties");
      expect(dropResult.allowed).toBe(false);
      expect(dropResult.error).toContain("read-only SELECT");

      // 3. Destructive query rejected: DELETE
      const deleteResult = await analyzeDevQuery("DELETE FROM users WHERE id = 1");
      expect(deleteResult.allowed).toBe(false);
      expect(deleteResult.error).toContain("read-only SELECT");

      // 4. Forbidden keyword in query: UPDATE or DROP embedded
      const updateResult = await analyzeDevQuery("SELECT * FROM properties; UPDATE properties SET estimated_value = 0");
      expect(updateResult.allowed).toBe(false);
      expect(updateResult.error).toContain("UPDATE");
    });
  });
});
