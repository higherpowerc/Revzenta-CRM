import { describe, it, expect } from "bun:test";
import { attomProvider } from "../server/providers/attomProvider";
import { providerRegistry } from "../server/providers/providerRegistry";
import { enrichProperty, getRegisteredProvidersStatus } from "../server/providers/enrichmentWorker";
import type { IPropertyDataProvider, NormalizedPropertyRecord } from "../server/providers/types";

describe("Multi-Provider Data Ingestion & Enrichment Pipeline", () => {
  describe("AttomProvider", () => {
    it("initializes with correct provider metadata", () => {
      expect(attomProvider.providerId).toBe("attom");
      expect(attomProvider.providerName).toBe("Attom Data Solutions");
    });

    it("reports unavailable when ATTOM_API_KEY is unset without throwing", async () => {
      if (!process.env.ATTOM_API_KEY) {
        const available = await attomProvider.isAvailable();
        expect(available).toBe(false);

        const prop = await attomProvider.getProperty("123 Main St, Phoenix, AZ 85001");
        expect(prop).toBeNull();
      }
    });
  });

  describe("ProviderRegistry Integration", () => {
    it("registers default RentCast and Attom providers in the registry", () => {
      const providers = providerRegistry.listProviders();
      const ids = providers.map((p) => p.id);
      expect(ids).toContain("rentcast");
      expect(ids).toContain("attom");
    });

    it("retrieves provider statuses across registered adapters", async () => {
      const statuses = await getRegisteredProvidersStatus();
      expect(statuses.length).toBeGreaterThanOrEqual(2);
      const attomStatus = statuses.find((s) => s.id === "attom");
      expect(attomStatus).toBeDefined();
      expect(attomStatus?.name).toBe("Attom Data Solutions");
      expect(typeof attomStatus?.isAvailable).toBe("boolean");
    });
  });

  describe("Enrichment Worker", () => {
    it("gracefully handles property lookups when providers are unconfigured", async () => {
      const res = await enrichProperty("9999 Nonexistent Blvd, Nowhere, ZZ 00000");
      expect(res.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(res.sources).toBeDefined();
    });

    it("enriches property using mock provider and computes Opportunity Score", async () => {
      // Register temporary mock provider
      const testMockProvider: IPropertyDataProvider = {
        providerId: "test_mock_provider",
        providerName: "Test Mock MLS Provider",
        isAvailable: async () => true,
        getProperty: async (addr: string): Promise<NormalizedPropertyRecord | null> => ({
          formattedAddress: addr,
          addressLine1: "1000 E University Dr",
          city: "Tempe",
          state: "AZ",
          zipCode: "85281",
          county: "Maricopa",
          specs: {
            propertyType: "Single Family",
            bedrooms: 3,
            bathrooms: 2,
            squareFootage: 1850,
            lotSizeSqft: 7500,
            yearBuilt: 1995,
          },
          valuation: {
            estimatedValue: 500000,
            valueRangeLow: 470000,
            valueRangeHigh: 530000,
            sourceValues: [
              {
                source: "test_mock_provider",
                value: 500000,
                confidence: 0.95,
                retrievedAt: new Date().toISOString(),
              },
            ],
            spreadPct: 12,
          },
          owner: {
            ownerName: "Jane Doe",
            occupancyStatus: "absentee_out_of_state",
          },
          salesHistory: [],
          taxInfo: {
            source: "test_mock_provider",
            isDelinquent: false,
          },
          mortgageHistory: [],
          publicRecords: {
            isVacant: true,
            distressSignals: ["Absentee Owner", "Vacant"],
          },
          primarySource: "test_mock_provider",
          confidenceScore: 0.95,
          retrievedAt: new Date().toISOString(),
        }),
      };

      providerRegistry.registerPropertyProvider(testMockProvider);

      const result = await enrichProperty("999 Mock Innovation Way, Testville, AZ 85001", {
        orgId: 1,
      });

      expect(result.success).toBe(true);
      expect(result.property).toBeDefined();
      expect(result.property?.valuation.estimatedValue).toBeGreaterThan(0);
      expect(result.property?.owner?.occupancyStatus).toBe("absentee_out_of_state");
      expect(result.property?.publicRecords?.isVacant).toBe(true);
      expect(result.sources).toContain("test_mock_provider");
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
