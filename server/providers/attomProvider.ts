import type {
  IPropertyDataProvider,
  IOwnerDataProvider,
  ISalesDataProvider,
  ITaxDataProvider,
  IMortgageDataProvider,
  IPublicRecordsProvider,
  NormalizedPropertyRecord,
  ProviderQueryOptions,
  SaleTransaction,
  MortgageRecord,
  TaxAssessment,
  PublicRecordIndicators,
  NormalizedOwnerProfile,
} from "./types";
import { parseAddressString, extractAddressFromUrl } from "../propertyEnrichment";

export class AttomProvider
  implements
    IPropertyDataProvider,
    IOwnerDataProvider,
    ISalesDataProvider,
    ITaxDataProvider,
    IMortgageDataProvider,
    IPublicRecordsProvider
{
  readonly providerId = "attom";
  readonly providerName = "Attom Data Solutions";

  private getApiKey(orgId?: number): string | undefined {
    return process.env.ATTOM_API_KEY?.trim() || undefined;
  }

  async isAvailable(orgId?: number): Promise<boolean> {
    const key = this.getApiKey(orgId);
    return Boolean(key && key !== "mock" && key !== "demo");
  }

  async getProperty(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<NormalizedPropertyRecord | null> {
    const cleanAddr = extractAddressFromUrl(address);
    if (!cleanAddr) return null;

    const apiKey = this.getApiKey(options?.orgId);
    if (!apiKey) {
      return null;
    }

    const parsed = parseAddressString(cleanAddr);
    if (!parsed.addressLine1 || (!parsed.city && !parsed.zipCode)) {
      return null;
    }

    try {
      const address2 = parsed.city && parsed.state ? `${parsed.city}, ${parsed.state}` : parsed.zipCode || "";
      const url = new URL("https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail");
      url.searchParams.set("address1", parsed.addressLine1);
      url.searchParams.set("address2", address2);

      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          apikey: apiKey,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        console.warn(`[AttomProvider] API call failed with status ${res.status}`);
        return null;
      }

      const data: any = await res.json();
      const prop = data?.property?.[0];
      if (!prop) return null;

      return this.mapAttomToNormalized(prop, cleanAddr, parsed);
    } catch (err: any) {
      console.warn(`[AttomProvider] Error looking up address "${cleanAddr}":`, err.message);
      return null;
    }
  }

  async getOwner(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<NormalizedOwnerProfile | null> {
    const rec = await this.getProperty(address, options);
    return rec?.owner || null;
  }

  async getSalesHistory(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<SaleTransaction[]> {
    const rec = await this.getProperty(address, options);
    return rec?.salesHistory || [];
  }

  async getTaxInformation(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<TaxAssessment | null> {
    const rec = await this.getProperty(address, options);
    return rec?.taxInfo || null;
  }

  async getMortgageHistory(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<MortgageRecord[]> {
    const rec = await this.getProperty(address, options);
    return rec?.mortgageHistory || [];
  }

  async getPublicRecords(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<PublicRecordIndicators | null> {
    const rec = await this.getProperty(address, options);
    return rec?.publicRecords || null;
  }

  private mapAttomToNormalized(
    attom: any,
    cleanAddr: string,
    parsed: { addressLine1: string; city: string; state: string; zipCode: string }
  ): NormalizedPropertyRecord {
    const addr = attom.address || {};
    const building = attom.building || {};
    const rooms = building.rooms || {};
    const size = building.size || {};
    const summary = building.summary || {};
    const avm = attom.assessment?.market?.mktTtlValue || attom.avm?.amount?.value;
    const low = attom.avm?.amount?.low;
    const high = attom.avm?.amount?.high;
    const assessment = attom.assessment || {};
    const taxObj = assessment.tax || {};

    const salesHistory: SaleTransaction[] = [];
    if (attom.sale?.saleTransDate && attom.sale?.amount?.saleAmt) {
      salesHistory.push({
        saleDate: attom.sale.saleTransDate,
        salePrice: Number(attom.sale.amount.saleAmt),
        buyerName: attom.sale.buyerName,
        sellerName: attom.sale.sellerName,
        source: "attom",
      });
    }

    const mortgageHistory: MortgageRecord[] = [];
    if (Array.isArray(attom.mortgage)) {
      for (const m of attom.mortgage) {
        if (m.amount) {
          mortgageHistory.push({
            recordingDate: m.recordingDate || new Date().toISOString().split("T")[0],
            loanAmount: Number(m.amount),
            lenderName: m.lender?.name || "Private Lender",
            loanType: m.loanType,
            interestRate: m.interestRate ? Number(m.interestRate) : undefined,
            source: "attom",
          });
        }
      }
    }

    const distressSignalsList: string[] = [];
    const isPreForeclosure = Boolean(attom.foreclosure?.foreclosureActivity === "Y" || attom.foreclosure?.defaultNotice);
    const isForeclosure = Boolean(attom.foreclosure?.reo || attom.foreclosure?.auctionDate);
    const taxDelinquent = Boolean(taxObj.delinquentYear || taxObj.taxDelinquentFlag === "Y");
    const isVacant = Boolean(attom.vintage?.occupancyIndicator === "V" || attom.occupancy?.vacant);
    const isAbsentee = Boolean(attom.vintage?.absenteeIndicator === "Y" || attom.occupancy?.absentee);

    if (isPreForeclosure) distressSignalsList.push("Pre-Foreclosure");
    if (isForeclosure) distressSignalsList.push("Foreclosure / Bank Owned");
    if (taxDelinquent) distressSignalsList.push("Tax Delinquent");
    if (isVacant) distressSignalsList.push("Vacant");
    if (isAbsentee) distressSignalsList.push("Absentee Owner");

    const publicRecords: PublicRecordIndicators = {
      isPreForeclosure,
      isForeclosure,
      isVacant,
      hasLiens: Boolean(attom.liens?.count && Number(attom.liens.count) > 0),
      totalLienAmount: attom.liens?.totalAmount ? Number(attom.liens.totalAmount) : undefined,
      distressSignals: distressSignalsList,
    };

    const taxInfo: TaxAssessment = {
      assessedValue: assessment.total?.assdTotalValue ? Number(assessment.total.assdTotalValue) : undefined,
      annualTaxAmount: taxObj.taxAmt ? Number(taxObj.taxAmt) : undefined,
      taxYear: taxObj.taxYear ? Number(taxObj.taxYear) : undefined,
      isDelinquent: taxDelinquent,
      source: "attom",
    };

    const owner: NormalizedOwnerProfile = {
      ownerName: attom.owners?.[0]?.name?.fullName || attom.owners?.[0]?.name?.corpName,
      entityName: attom.owners?.[0]?.name?.corpName,
      isCorporateOwner: Boolean(attom.owners?.[0]?.name?.corpName),
      occupancyStatus: isAbsentee ? "absentee_out_of_state" : "owner_occupied",
    };

    return {
      apn: attom.identifier?.apn || attom.identifier?.attomId?.toString(),
      formattedAddress: addr.oneLine || cleanAddr,
      addressLine1: addr.line1 || parsed.addressLine1,
      city: addr.locality || parsed.city,
      state: addr.countrySubd || parsed.state,
      zipCode: addr.postal1 || parsed.zipCode,
      county: attom.area?.countrySecSubd || attom.area?.county,
      latitude: attom.location?.latitude ? Number(attom.location.latitude) : undefined,
      longitude: attom.location?.longitude ? Number(attom.location.longitude) : undefined,
      specs: {
        propertyType: summary.propClass || "Single Family",
        bedrooms: rooms.beds ? Number(rooms.beds) : undefined,
        bathrooms: rooms.bathsTotal ? Number(rooms.bathsTotal) : undefined,
        squareFootage: size.grossSizeCalc ? Number(size.grossSizeCalc) : size.bldgSize ? Number(size.bldgSize) : undefined,
        lotSizeSqft: attom.lot?.lotSize1 ? Math.round(Number(attom.lot.lotSize1) * 43560) : undefined,
        yearBuilt: summary.yearBuilt ? Number(summary.yearBuilt) : undefined,
        stories: summary.stories ? Number(summary.stories) : undefined,
      },
      valuation: {
        estimatedValue: avm ? Number(avm) : undefined,
        valueRangeLow: low ? Number(low) : undefined,
        valueRangeHigh: high ? Number(high) : undefined,
        sourceValues: avm
          ? [
              {
                source: "attom",
                value: Number(avm),
                confidence: 0.92,
                retrievedAt: new Date().toISOString(),
              },
            ]
          : [],
        spreadPct: low && high && avm ? ((high - low) / avm) * 100 : 0,
      },
      owner,
      taxInfo,
      mortgageHistory,
      salesHistory,
      publicRecords,
      primarySource: "attom",
      confidenceScore: 0.92,
      retrievedAt: new Date().toISOString(),
    };
  }
}

export const attomProvider = new AttomProvider();
