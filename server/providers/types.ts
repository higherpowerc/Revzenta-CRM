/**
 * Revzenta Data Provider Abstraction Architecture
 * Standardized interfaces for multi-source property intelligence,
 * source tracking, and normalization.
 */

export interface SourceMetadata {
  source: string; // e.g. "rentcast", "attom", "first_american", "county_records"
  recordId?: string;
  retrievedAt: string; // ISO 8601
  confidence: number; // 0.0 to 1.0
}

export interface SourceTrackedValue<T> extends SourceMetadata {
  value: T;
}

export interface NormalizedPhysicalSpecs {
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSizeSqft?: number;
  yearBuilt?: number;
  stories?: number;
  garageSpaces?: number;
  constructionType?: string;
}

export interface NormalizedValuation {
  estimatedValue?: number;
  valueRangeLow?: number;
  valueRangeHigh?: number;
  estimatedRent?: number;
  sourceValues?: SourceTrackedValue<number>[];
  spreadPct?: number; // Discrepancy % between differing sources
}

export interface SaleTransaction {
  saleDate: string;
  salePrice: number;
  buyerName?: string;
  sellerName?: string;
  deedType?: string;
  source: string;
}

export interface TaxAssessment {
  taxYear?: number;
  assessedValue?: number;
  annualTaxAmount?: number;
  isDelinquent?: boolean;
  delinquentAmount?: number;
  source: string;
}

export interface MortgageRecord {
  recordingDate: string;
  loanAmount: number;
  lenderName?: string;
  loanType?: string;
  interestRate?: number;
  estimatedBalance?: number;
  source: string;
}

export interface PublicRecordIndicators {
  hasLiens?: boolean;
  totalLienAmount?: number;
  isPreForeclosure?: boolean;
  isForeclosure?: boolean;
  isBankruptcy?: boolean;
  isProbate?: boolean;
  isVacant?: boolean;
  hasCodeViolations?: boolean;
  distressSignals: string[];
}

export interface NormalizedOwnerProfile {
  ownerName?: string;
  entityName?: string;
  isCorporateOwner?: boolean;
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  occupancyStatus?: "owner_occupied" | "absentee_in_state" | "absentee_out_of_state" | "unknown";
  ownershipYears?: number;
  purchaseDate?: string;
  phones?: string[];
  emails?: string[];
}

export interface NormalizedPropertyRecord {
  // Identity
  formattedAddress: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  apn?: string;
  latitude?: number;
  longitude?: number;

  // Characteristics
  specs: NormalizedPhysicalSpecs;

  // Valuation
  valuation: NormalizedValuation;

  // Ownership
  owner: NormalizedOwnerProfile;

  // Financial & Tax History
  salesHistory: SaleTransaction[];
  taxInfo: TaxAssessment;
  mortgageHistory: MortgageRecord[];

  // Signals
  publicRecords: PublicRecordIndicators;

  // Comps
  comps?: Array<{
    address: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    distanceMiles: number;
  }>;

  // Source Provenance
  primarySource: string;
  confidenceScore: number;
  retrievedAt: string;
  message?: string;
}

/**
 * Standard Provider Query Options
 */
export interface ProviderQueryOptions {
  orgId?: number;
  forceRefresh?: boolean;
  includeComps?: boolean;
  includeSalesHistory?: boolean;
  includeMortgage?: boolean;
}

/**
 * Property Data Provider Interface
 */
export interface IPropertyDataProvider {
  readonly providerId: string;
  readonly providerName: string;

  isAvailable(orgId?: number): Promise<boolean>;

  getProperty(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<NormalizedPropertyRecord | null>;

  searchProperties?(
    query: Record<string, any>,
    options?: ProviderQueryOptions
  ): Promise<NormalizedPropertyRecord[]>;
}

/**
 * Owner Data Provider Interface
 */
export interface IOwnerDataProvider {
  readonly providerId: string;
  getOwner(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<NormalizedOwnerProfile | null>;
}

/**
 * Sales Data Provider Interface
 */
export interface ISalesDataProvider {
  readonly providerId: string;
  getSalesHistory(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<SaleTransaction[]>;
}

/**
 * Tax Data Provider Interface
 */
export interface ITaxDataProvider {
  readonly providerId: string;
  getTaxInformation(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<TaxAssessment | null>;
}

/**
 * Mortgage Data Provider Interface
 */
export interface IMortgageDataProvider {
  readonly providerId: string;
  getMortgageHistory(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<MortgageRecord[]>;
}

/**
 * Public Records Provider Interface
 */
export interface IPublicRecordsProvider {
  readonly providerId: string;
  getPublicRecords(
    address: string,
    options?: ProviderQueryOptions
  ): Promise<PublicRecordIndicators | null>;
}
