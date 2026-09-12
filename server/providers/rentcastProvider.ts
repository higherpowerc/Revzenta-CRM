import type {
  IPropertyDataProvider,
  ISalesDataProvider,
  NormalizedPropertyRecord,
  ProviderQueryOptions,
  SaleTransaction,
} from "./types";
import { lookupPropertyData, parseAddressString, extractAddressFromUrl } from "../propertyEnrichment";
import { db, getRentcastUsage } from "../db";

export class RentCastProvider implements IPropertyDataProvider, ISalesDataProvider {
  readonly providerId = "rentcast";
  readonly providerName = "RentCast Data Services";

  async isAvailable(orgId?: number): Promise<boolean> {
    let key = process.env.RENTCAST_API_KEY?.trim();
    if (orgId) {
      const org = db.query("SELECT rentcast_api_key FROM orgs WHERE id = ?").get(orgId) as {
        rentcast_api_key?: string;
      } | null;
      if (org?.rentcast_api_key?.trim()) {
        key = org.rentcast_api_key.trim();
      }

      const usage = getRentcastUsage(orgId);
      if (usage.isBlocked) return false;
    }
    return Boolean(key && key !== "mock" && key !== "demo");
  }

  async getProperty(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<NormalizedPropertyRecord | null> {
    const cleanAddr = extractAddressFromUrl(address);
    if (!cleanAddr) return null;

    let orgApiKey: string | undefined;
    if (options?.orgId) {
      const org = db.query("SELECT rentcast_api_key FROM orgs WHERE id = ?").get(options.orgId) as {
        rentcast_api_key?: string;
      } | null;
      orgApiKey = org?.rentcast_api_key?.trim() || undefined;
    }

    const raw = await lookupPropertyData(cleanAddr, orgApiKey, {
      forceRefresh: options?.forceRefresh,
      orgId: options?.orgId,
    });

    if (raw.source === "not_found" || raw.source === "unconfigured") {
      return null;
    }

    const parsed = parseAddressString(cleanAddr);

    const salesHistory: SaleTransaction[] = [];
    if (raw.lastSaleDate && raw.lastSalePrice) {
      salesHistory.push({
        saleDate: raw.lastSaleDate,
        salePrice: raw.lastSalePrice,
        source: "rentcast",
      });
    }

    return {
      formattedAddress: raw.formattedAddress || cleanAddr,
      addressLine1: raw.addressLine1 || parsed.addressLine1,
      city: raw.city || parsed.city,
      state: raw.state || parsed.state,
      zipCode: raw.zipCode || parsed.zipCode,
      county: raw.county,
      specs: {
        propertyType: raw.propertyType,
        bedrooms: raw.bedrooms,
        bathrooms: raw.bathrooms,
        squareFootage: raw.squareFootage,
        lotSizeSqft: raw.lotSize,
        yearBuilt: raw.yearBuilt,
      },
      valuation: {
        estimatedValue: raw.estimatedValue,
        valueRangeLow: raw.valueRangeLow,
        valueRangeHigh: raw.valueRangeHigh,
        estimatedRent: raw.estimatedRent,
        sourceValues: raw.estimatedValue
          ? [
              {
                source: "rentcast",
                value: raw.estimatedValue,
                confidence: 0.9,
                retrievedAt: new Date().toISOString(),
              },
            ]
          : [],
        spreadPct: 0,
      },
      owner: {
        ownerName: raw.ownerName,
      },
      salesHistory,
      taxInfo: {
        assessedValue: raw.taxAssessedValue,
        source: "rentcast",
      },
      mortgageHistory: [],
      publicRecords: {
        distressSignals: [],
      },
      comps: raw.comps,
      primarySource: "rentcast",
      confidenceScore: 0.9,
      retrievedAt: new Date().toISOString(),
      message: raw.message,
    };
  }

  async getSalesHistory(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<SaleTransaction[]> {
    const prop = await this.getProperty(address, options);
    return prop?.salesHistory || [];
  }
}

export const rentcastProvider = new RentCastProvider();
