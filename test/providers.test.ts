import { describe, expect, it } from "bun:test";
import { resolveValuation, mergePropertyRecords } from "../server/providers/conflictResolver";
import { ProviderRegistry } from "../server/providers/providerRegistry";
import type {
  IPropertyDataProvider,
  NormalizedPropertyRecord,
  ProviderQueryOptions,
  SourceTrackedValue,
} from "../server/providers/types";

describe("Data Provider Abstraction & Conflict Resolution", () => {
  describe("resolveValuation", () => {
    it("handles single-source valuation cleanly", () => {
      const sources: SourceTrackedValue<number>[] = [
        {
          source: "rentcast",
          value: 425000,
          confidence: 0.9,
          retrievedAt: "2026-09-11T12:00:00Z",
        },
      ];

      const res = resolveValuation(sources);
      expect(res.estimatedValue).toBe(425000);
      expect(res.spreadPct).toBe(0);
      expect(res.sourceValues?.length).toBe(1);
    });

    it("resolves multi-source valuation discrepancies deterministically", () => {
      // Provider A: $425,000 (conf: 0.8)
      // Provider B: $438,000 (conf: 0.9)
      const sources: SourceTrackedValue<number>[] = [
        {
          source: "provider_a",
          value: 425000,
          confidence: 0.8,
          retrievedAt: "2026-09-11T10:00:00Z",
        },
        {
          source: "provider_b",
          value: 438000,
          confidence: 0.9,
          retrievedAt: "2026-09-11T11:00:00Z",
        },
      ];

      const res = resolveValuation(sources);

      // Weighted avg: (425000*0.8 + 438000*0.9) / (0.8 + 0.9) = (340000 + 394200) / 1.7 = 734200 / 1.7 ~= 431882
      expect(res.estimatedValue).toBeGreaterThan(425000);
      expect(res.estimatedValue).toBeLessThan(438000);
      expect(res.valueRangeLow).toBe(425000);
      expect(res.valueRangeHigh).toBe(438000);
      expect(res.spreadPct).toBeGreaterThan(0);
      expect(res.sourceValues?.length).toBe(2);
      expect(res.sourceValues?.[0].source).toBe("provider_a");
      expect(res.sourceValues?.[1].source).toBe("provider_b");
    });
  });

  describe("mergePropertyRecords", () => {
    it("merges records across providers without blind overwriting", () => {
      const recordA: NormalizedPropertyRecord = {
        formattedAddress: "123 Main St, Phoenix, AZ 85001",
        addressLine1: "123 Main St",
        city: "Phoenix",
        state: "AZ",
        zipCode: "85001",
        specs: {
          bedrooms: 3,
          bathrooms: 2,
          squareFootage: 1800,
          // Missing yearBuilt
        },
        valuation: {
          estimatedValue: 420000,
        },
        owner: {
          ownerName: "John Doe",
        },
        salesHistory: [
          { saleDate: "2021-05-15", salePrice: 350000, source: "provider_a" },
        ],
        taxInfo: { assessedValue: 380000, source: "provider_a" },
        mortgageHistory: [],
        publicRecords: {
          hasLiens: false,
          distressSignals: ["Probate"],
        },
        primarySource: "provider_a",
        confidenceScore: 0.85,
        retrievedAt: "2026-09-11T10:00:00Z",
      };

      const recordB: NormalizedPropertyRecord = {
        formattedAddress: "123 Main St, Phoenix, AZ 85001",
        addressLine1: "123 Main St",
        city: "Phoenix",
        state: "AZ",
        zipCode: "85001",
        specs: {
          bedrooms: 3,
          bathrooms: 2,
          yearBuilt: 1988, // Supplementary data
        },
        valuation: {
          estimatedValue: 430000,
        },
        owner: {
          ownerName: "John Doe",
        },
        salesHistory: [
          { saleDate: "2021-05-15", salePrice: 350000, source: "provider_b" }, // Duplicate sale
          { saleDate: "2015-02-10", salePrice: 280000, source: "provider_b" }, // Older sale
        ],
        taxInfo: { assessedValue: 385000, source: "provider_b" },
        mortgageHistory: [
          { recordingDate: "2021-05-16", loanAmount: 280000, lenderName: "Wells Fargo", source: "provider_b" },
        ],
        publicRecords: {
          hasLiens: true,
          totalLienAmount: 4500,
          distressSignals: ["Tax Delinquent"],
        },
        primarySource: "provider_b",
        confidenceScore: 0.9,
        retrievedAt: "2026-09-11T11:00:00Z",
      };

      const merged = mergePropertyRecords([recordA, recordB]);
      expect(merged).not.toBeNull();

      if (merged) {
        // Primary record chosen by highest confidence (provider_b, 0.9)
        expect(merged.primarySource).toBe("provider_b");
        // Specs merged: got yearBuilt from B, squareFootage from A
        expect(merged.specs.yearBuilt).toBe(1988);
        expect(merged.specs.squareFootage).toBe(1800);
        // Sales deduplicated: 2 unique sales total
        expect(merged.salesHistory.length).toBe(2);
        // Mortgage history merged
        expect(merged.mortgageHistory.length).toBe(1);
        expect(merged.mortgageHistory[0].lenderName).toBe("Wells Fargo");
        // Distress signals merged
        expect(merged.publicRecords.hasLiens).toBe(true);
        expect(merged.publicRecords.totalLienAmount).toBe(4500);
        expect(merged.publicRecords.distressSignals).toContain("Probate");
        expect(merged.publicRecords.distressSignals).toContain("Tax Delinquent");
      }
    });
  });

  describe("ProviderRegistry", () => {
    it("registers and lists active data providers", () => {
      const registry = new ProviderRegistry();
      const list = registry.listProviders();
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((p) => p.id === "rentcast")).toBe(true);
    });

    it("supports registering dynamic mock providers", async () => {
      const registry = new ProviderRegistry();

      const mockProvider: IPropertyDataProvider = {
        providerId: "mock_provider",
        providerName: "Mock Test Provider",
        isAvailable: async () => true,
        getProperty: async (addr: string) => ({
          formattedAddress: addr,
          addressLine1: addr,
          city: "Scottsdale",
          state: "AZ",
          zipCode: "85251",
          specs: { bedrooms: 4, bathrooms: 3, squareFootage: 2400 },
          valuation: { estimatedValue: 650000 },
          owner: { ownerName: "Alice Walker" },
          salesHistory: [],
          taxInfo: { source: "mock_provider" },
          mortgageHistory: [],
          publicRecords: { distressSignals: [] },
          primarySource: "mock_provider",
          confidenceScore: 0.95,
          retrievedAt: new Date().toISOString(),
        }),
      };

      registry.registerPropertyProvider(mockProvider);

      const result = await registry.lookupProperty("789 Mockingbird Ln, Scottsdale, AZ 85251", {
        forceRefresh: true,
      });

      expect(result).not.toBeNull();
      expect(result?.specs.bedrooms).toBe(4);
      expect(result?.owner.ownerName).toBe("Alice Walker");
    });
  });
});
