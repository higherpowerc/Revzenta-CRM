import type {
  IPropertyDataProvider,
  IOwnerDataProvider,
  ISalesDataProvider,
  ITaxDataProvider,
  IMortgageDataProvider,
  IPublicRecordsProvider,
  NormalizedPropertyRecord,
  ProviderQueryOptions,
} from "./types";
import { rentcastProvider } from "./rentcastProvider";
import { attomProvider } from "./attomProvider";
import { mergePropertyRecords } from "./conflictResolver";
import { extractAddressFromUrl, normalizeAddressForCache } from "../propertyEnrichment";
import { db } from "../db";

export class ProviderRegistry {
  private propertyProviders: Map<string, IPropertyDataProvider> = new Map();
  private ownerProviders: Map<string, IOwnerDataProvider> = new Map();
  private salesProviders: Map<string, ISalesDataProvider> = new Map();
  private taxProviders: Map<string, ITaxDataProvider> = new Map();
  private mortgageProviders: Map<string, IMortgageDataProvider> = new Map();
  private publicRecordsProviders: Map<string, IPublicRecordsProvider> = new Map();

  constructor() {
    // Register default providers
    this.registerPropertyProvider(rentcastProvider);
    this.registerSalesProvider(rentcastProvider);

    this.registerPropertyProvider(attomProvider);
    this.registerOwnerProvider(attomProvider);
    this.registerSalesProvider(attomProvider);
    this.registerTaxProvider(attomProvider);
    this.registerMortgageProvider(attomProvider);
    this.registerPublicRecordsProvider(attomProvider);
  }

  registerPropertyProvider(provider: IPropertyDataProvider): void {
    this.propertyProviders.set(provider.providerId, provider);
  }

  registerOwnerProvider(provider: IOwnerDataProvider): void {
    this.ownerProviders.set(provider.providerId, provider);
  }

  registerSalesProvider(provider: ISalesDataProvider): void {
    this.salesProviders.set(provider.providerId, provider);
  }

  registerTaxProvider(provider: ITaxDataProvider): void {
    this.taxProviders.set(provider.providerId, provider);
  }

  registerMortgageProvider(provider: IMortgageDataProvider): void {
    this.mortgageProviders.set(provider.providerId, provider);
  }

  registerPublicRecordsProvider(provider: IPublicRecordsProvider): void {
    this.publicRecordsProviders.set(provider.providerId, provider);
  }

  getPropertyProvider(id: string): IPropertyDataProvider | undefined {
    return this.propertyProviders.get(id);
  }

  listProviders(): Array<{ id: string; name: string; types: string[] }> {
    const map = new Map<string, { id: string; name: string; types: Set<string> }>();

    for (const [id, p] of this.propertyProviders) {
      if (!map.has(id)) map.set(id, { id, name: p.providerName, types: new Set() });
      map.get(id)!.types.add("property");
    }
    for (const [id, p] of this.salesProviders) {
      if (!map.has(id)) map.set(id, { id, name: id, types: new Set() });
      map.get(id)!.types.add("sales");
    }

    return Array.from(map.values()).map((item) => ({
      id: item.id,
      name: item.name,
      types: Array.from(item.types),
    }));
  }

  /**
   * Dispatches lookup across available providers, checks cache, and resolves conflicts.
   */
  async lookupProperty(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<NormalizedPropertyRecord | null> {
    const cleanAddr = extractAddressFromUrl(address);
    if (!cleanAddr) return null;

    const cacheKey = normalizeAddressForCache(cleanAddr);

    // 1. Check local persistent cache
    if (!options?.forceRefresh) {
      try {
        const cached = db
          .query(
            "SELECT data FROM property_enrichment_cache WHERE normalized_address = ? AND expires_at > datetime('now')"
          )
          .get(cacheKey) as { data: string } | null;

        if (cached && cached.data) {
          const parsed = JSON.parse(cached.data);
          return {
            ...parsed,
            message: "✓ Loaded from verified local property intelligence cache (0 API calls)",
          };
        }
      } catch (err) {
        console.warn("[provider-registry] Cache read warning:", err);
      }
    }

    // 2. Query available providers
    const responses: NormalizedPropertyRecord[] = [];
    for (const provider of this.propertyProviders.values()) {
      try {
        const available = await provider.isAvailable(options?.orgId);
        if (!available) continue;

        const record = await provider.getProperty(cleanAddr, options);
        if (record) {
          responses.push(record);
        }
      } catch (providerErr) {
        console.warn(`[provider-registry] Error querying provider ${provider.providerId}:`, providerErr);
      }
    }

    if (responses.length === 0) {
      return null;
    }

    // 3. Resolve multi-provider conflicts deterministically
    const merged = mergePropertyRecords(responses);
    if (!merged) return null;

    // 4. Cache merged result in SQLite property_enrichment_cache
    try {
      db.query(`
        INSERT INTO property_enrichment_cache (normalized_address, data, source, created_at, expires_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now', '+60 days'))
        ON CONFLICT(normalized_address) DO UPDATE SET
          data = excluded.data,
          source = excluded.source,
          created_at = datetime('now'),
          expires_at = datetime('now', '+60 days')
      `).run(cacheKey, JSON.stringify(merged), merged.primarySource);
    } catch (cacheWriteErr) {
      console.warn("[provider-registry] Cache write warning:", cacheWriteErr);
    }

    return merged;
  }
}

export const providerRegistry = new ProviderRegistry();
