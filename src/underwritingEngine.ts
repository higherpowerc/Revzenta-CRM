export type RateType = "fixed" | "arm" | "unknown";
export type LienPosition = "first" | "second" | "other" | "unknown";

export interface NormalizedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  oneLine: string;
}

export interface VoluntaryMortgage {
  id: string;
  originalLoanAmount: number;
  recordingDate: string;
  termMonths: number;
  interestRate: number;
  rateType: RateType;
  lienPosition: LienPosition;
  lienType: string;
  currentBalance?: number;
}

export interface InvoluntaryEncumbrances {
  delinquentPropertyTaxes: number;
  hoaLiens: number;
  mechanicsLiens: number;
  lisPendens: boolean;
  noticeOfDefault: boolean;
  other: string[];
}

export interface UnifiedPropertyFinancialProfile {
  address: NormalizedAddress;
  voluntaryMortgages: VoluntaryMortgage[];
  involuntary: InvoluntaryEncumbrances;
  annualPropertyTax: number;
  estimatedMonthlyInsurance: number;
  estimatedMarketValue: number;
  fairMarketRent: number;
  source: "cotality" | "manual" | "unknown";
  warnings: string[];
}

export interface FieldOverride<T> {
  enabled: boolean;
  value: T;
}

export interface UnderwritingOverrides {
  currentBalance?: FieldOverride<number>;
  interestRate?: FieldOverride<number>;
  annualPropertyTax?: FieldOverride<number>;
  monthlyInsurance?: FieldOverride<number>;
  estimatedMarketValue?: FieldOverride<number>;
  fairMarketRent?: FieldOverride<number>;
}

export interface ActiveLoanState {
  originalLoanAmount: number;
  elapsedMonths: number;
  monthlyPrincipalAndInterest: number;
  unpaidPrincipalBalance: number;
  interestRate: number;
  termMonths: number;
  recordingDate: string;
  rateType: RateType;
  lienPosition: LienPosition;
  lienType: string;
}

export interface UnderlyingPiti {
  monthlyPrincipalAndInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  totalMonthlyPiti: number;
}

export interface SubjectToStructure {
  equitySpread: number;
  cashToSeller: number;
  sellerCarrybackPrincipal: number;
  sellerCarrybackMonthlyPayment: number;
  buyerTotalMonthlyOutlay: number;
  activeFirstMortgage: ActiveLoanState | null;
}

export interface SellerFinancingStructure {
  eligible: boolean;
  sellerEquity: number;
  downPayment: number;
  sellerPrincipalLoanAmount: number;
  monthlyPrincipalAndInterest: number;
  balloonBalance: number;
  balloonPaymentMonth: number;
}

export interface WrapStructure {
  wrapLoanAmount: number;
  monthlyPrincipalAndInterest: number;
  underlyingPiti: number;
  wrapSpread: number;
}

export interface UnderwritingResult {
  profile: UnifiedPropertyFinancialProfile;
  activeLoans: ActiveLoanState[];
  underlyingPiti: UnderlyingPiti;
  subjectTo: SubjectToStructure;
  sellerFinancing: SellerFinancingStructure;
  wrap: WrapStructure;
  dscr: number;
  dscrStatus: "pass" | "warning" | "fail";
  warnings: string[];
}

function numberValue(...values: unknown[]): number {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function textValue(...values: unknown[]): string {
  return values.find((value) => typeof value === "string" && value.trim() !== "")?.toString().trim() ?? "";
}

function boolValue(...values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string" && /^(true|yes|y)$/i.test(value.trim())) return true;
  }
  return false;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function firstArray(payload: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key] as unknown[];
  }
  return [];
}

export function normalizeAddress(input: Partial<NormalizedAddress> | string): NormalizedAddress {
  if (typeof input === "string") {
    const parts = input.split(",").map((part) => part.trim()).filter(Boolean);
    const last = parts.at(-1) ?? "";
    const stateZip = last.match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
    const state = stateZip?.[1]?.toUpperCase() ?? "";
    const zip = stateZip?.[2] ?? "";
    const city = parts.length > 2 ? parts.at(-2) ?? "" : parts.length === 2 && !state ? parts[1] : "";
    const street = parts.slice(0, stateZip ? -2 : -1).join(", ") || (parts[0] ?? "");
    return normalizeAddress({ street, city, state, zip });
  }
  const street = textValue(input.street);
  const city = textValue(input.city);
  const state = textValue(input.state).toUpperCase();
  const zip = textValue(input.zip);
  return {
    street,
    city,
    state,
    zip,
    oneLine: [street, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
  };
}

export function mapCotalityPayload(payload: unknown, address: Partial<NormalizedAddress> | string): UnifiedPropertyFinancialProfile {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root.property ?? root.result ?? root);
  const mortgageItems = firstArray(data, ["voluntaryMortgages", "voluntaryLiens", "mortgages", "liens"]);
  const warnings: string[] = [];
  const voluntaryMortgages = mortgageItems.map((item, index): VoluntaryMortgage => {
    const lien = asRecord(item);
    const lienType = textValue(lien.lienType, lien.type, lien.instrumentType) || "Mortgage";
    if (/heloc|home equity/i.test(lienType)) {
      warnings.push("HELOC identified. Balance reflects maximum credit limit, not current draw. Verify via bank statement.");
    }
    const positionText = textValue(lien.lienPosition, lien.position, lien.priority).toLowerCase();
    return {
      id: textValue(lien.id, lien.instrumentNumber, lien.documentNumber) || `lien-${index + 1}`,
      originalLoanAmount: numberValue(lien.originalLoanAmount, lien.originalAmount, lien.loanAmount, lien.amount),
      recordingDate: textValue(lien.recordingDate, lien.recordedDate, lien.recordDate),
      termMonths: Math.max(0, numberValue(lien.termMonths, lien.term, lien.amortizationMonths)),
      interestRate: Math.max(0, numberValue(lien.interestRate, lien.rate, lien.noteRate)),
      rateType: /arm|adjustable/i.test(textValue(lien.rateType, lien.loanType)) ? "arm" : /fixed/i.test(textValue(lien.rateType, lien.loanType)) ? "fixed" : "unknown",
      lienPosition: /first|1st|senior/i.test(positionText) ? "first" : /second|2nd/i.test(positionText) ? "second" : positionText ? "other" : "unknown",
      lienType,
      currentBalance: numberValue(lien.currentBalance, lien.unpaidPrincipalBalance, lien.balance) || undefined,
    };
  });
  const encumbrances = asRecord(data.involuntaryEncumbrances ?? data.involuntary ?? data.encumbrances);
  const annualPropertyTax = numberValue(data.annualPropertyTax, data.propertyTaxAmount, data.taxAmount, asRecord(data.taxes).annual);
  const profile: UnifiedPropertyFinancialProfile = {
    address: normalizeAddress(address),
    voluntaryMortgages,
    involuntary: {
      delinquentPropertyTaxes: numberValue(encumbrances.delinquentPropertyTaxes, data.delinquentPropertyTaxes),
      hoaLiens: numberValue(encumbrances.hoaLiens, data.hoaLiens),
      mechanicsLiens: numberValue(encumbrances.mechanicsLiens, data.mechanicsLiens),
      lisPendens: boolValue(encumbrances.lisPendens, data.lisPendens),
      noticeOfDefault: boolValue(encumbrances.noticeOfDefault, data.noticeOfDefault),
      other: Array.isArray(encumbrances.other) ? encumbrances.other.map(String) : [],
    },
    annualPropertyTax,
    estimatedMonthlyInsurance: numberValue(data.estimatedMonthlyInsurance, data.monthlyInsurance, asRecord(data.insurance).monthly),
    estimatedMarketValue: numberValue(data.estimatedMarketValue, data.marketValue, data.avm, data.valuation),
    fairMarketRent: numberValue(data.fairMarketRent, data.marketRent, data.rentEstimate),
    source: "cotality",
    warnings: [...new Set(warnings)],
  };
  if (profile.involuntary.lisPendens) profile.warnings.push("Lis Pendens identified. Review title and litigation status before closing.");
  if (profile.involuntary.noticeOfDefault) profile.warnings.push("Notice of Default identified. Verify reinstatement amount and foreclosure timeline.");
  return profile;
}

export function applyOverrides(profile: UnifiedPropertyFinancialProfile, overrides: UnderwritingOverrides): UnifiedPropertyFinancialProfile {
  const next = structuredClone(profile);
  const first = next.voluntaryMortgages[0];
  if (first && overrides.currentBalance?.enabled) first.currentBalance = Math.max(0, overrides.currentBalance.value);
  if (first && overrides.interestRate?.enabled) first.interestRate = Math.max(0, overrides.interestRate.value);
  if (overrides.annualPropertyTax?.enabled) next.annualPropertyTax = Math.max(0, overrides.annualPropertyTax.value);
  if (overrides.monthlyInsurance?.enabled) next.estimatedMonthlyInsurance = Math.max(0, overrides.monthlyInsurance.value);
  if (overrides.estimatedMarketValue?.enabled) next.estimatedMarketValue = Math.max(0, overrides.estimatedMarketValue.value);
  if (overrides.fairMarketRent?.enabled) next.fairMarketRent = Math.max(0, overrides.fairMarketRent.value);
  return next;
}

export function elapsedCalendarMonths(recordingDate: string, asOf = new Date()): number {
  const recorded = new Date(`${recordingDate}T00:00:00`);
  if (!Number.isFinite(recorded.getTime()) || recorded > asOf) return 0;
  const months = (asOf.getFullYear() - recorded.getFullYear()) * 12 + asOf.getMonth() - recorded.getMonth();
  return Math.max(0, months - (asOf.getDate() < recorded.getDate() ? 1 : 0));
}

export function monthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  const p = Math.max(0, principal);
  const n = Math.max(1, Math.floor(termMonths));
  const r = Math.max(0, annualRate) / 100 / 12;
  if (p === 0) return 0;
  if (r === 0) return p / n;
  const compound = Math.pow(1 + r, n);
  return p * (r * compound) / (compound - 1);
}

export function unpaidPrincipalBalance(principal: number, annualRate: number, termMonths: number, elapsedMonths: number): number {
  const p = Math.max(0, principal);
  const n = Math.max(1, Math.floor(termMonths));
  const t = Math.min(n, Math.max(0, Math.floor(elapsedMonths)));
  const r = Math.max(0, annualRate) / 100 / 12;
  if (p === 0 || t >= n) return t >= n ? 0 : p;
  if (r === 0) return Math.max(0, p * (1 - t / n));
  const compound = Math.pow(1 + r, n);
  return Math.max(0, p * (compound - Math.pow(1 + r, t)) / (compound - 1));
}

export function reconstructLoan(mortgage: VoluntaryMortgage, asOf = new Date()): ActiveLoanState {
  const elapsedMonths = elapsedCalendarMonths(mortgage.recordingDate, asOf);
  const balance = mortgage.currentBalance ?? unpaidPrincipalBalance(mortgage.originalLoanAmount, mortgage.interestRate, mortgage.termMonths, elapsedMonths);
  return {
    originalLoanAmount: mortgage.originalLoanAmount,
    elapsedMonths,
    monthlyPrincipalAndInterest: monthlyPayment(mortgage.originalLoanAmount, mortgage.interestRate, mortgage.termMonths),
    unpaidPrincipalBalance: balance,
    interestRate: mortgage.interestRate,
    termMonths: mortgage.termMonths,
    recordingDate: mortgage.recordingDate,
    rateType: mortgage.rateType,
    lienPosition: mortgage.lienPosition,
    lienType: mortgage.lienType,
  };
}

export function calculateUnderwriting(input: {
  profile: UnifiedPropertyFinancialProfile;
  purchasePrice: number;
  cashToSeller: number;
  carrybackRate: number;
  carrybackTermMonths: number;
  sellerFinanceDownPayment: number;
  sellerFinanceRate: number;
  sellerFinanceAmortizationMonths: number;
  sellerFinanceBalloonPaymentMonth: number;
  wrapLoanAmount: number;
  wrapRate: number;
  wrapTermMonths: number;
  dscrThreshold?: number;
  asOf?: Date;
}): UnderwritingResult {
  const profile = input.profile;
  const activeLoans = profile.voluntaryMortgages.map((mortgage) => reconstructLoan(mortgage, input.asOf));
  const first = activeLoans.find((loan) => loan.lienPosition === "first") ?? activeLoans[0] ?? null;
  const monthlyTax = Math.max(0, profile.annualPropertyTax / 12);
  const underlyingPiti: UnderlyingPiti = {
    monthlyPrincipalAndInterest: activeLoans.reduce((sum, loan) => sum + loan.monthlyPrincipalAndInterest, 0),
    monthlyTax,
    monthlyInsurance: Math.max(0, profile.estimatedMonthlyInsurance),
    totalMonthlyPiti: 0,
  };
  underlyingPiti.totalMonthlyPiti = underlyingPiti.monthlyPrincipalAndInterest + monthlyTax + underlyingPiti.monthlyInsurance;

  const price = Math.max(0, input.purchasePrice);
  const equitySpread = price - (first?.unpaidPrincipalBalance ?? 0);
  const cashToSeller = Math.max(0, input.cashToSeller);
  const carrybackPrincipal = equitySpread - cashToSeller;
  const subjectTo: SubjectToStructure = {
    equitySpread,
    cashToSeller,
    sellerCarrybackPrincipal: carrybackPrincipal,
    sellerCarrybackMonthlyPayment: monthlyPayment(Math.max(0, carrybackPrincipal), input.carrybackRate, input.carrybackTermMonths),
    buyerTotalMonthlyOutlay: underlyingPiti.totalMonthlyPiti + monthlyPayment(Math.max(0, carrybackPrincipal), input.carrybackRate, input.carrybackTermMonths),
    activeFirstMortgage: first,
  };

  const sellerDown = Math.min(price, Math.max(0, input.sellerFinanceDownPayment));
  const sellerPrincipal = Math.max(0, price - sellerDown);
  const sellerPayment = monthlyPayment(sellerPrincipal, input.sellerFinanceRate, input.sellerFinanceAmortizationMonths);
  const balloonMonth = Math.min(Math.max(1, Math.floor(input.sellerFinanceBalloonPaymentMonth)), Math.max(1, input.sellerFinanceAmortizationMonths));
  const sellerFinance: SellerFinancingStructure = {
    eligible: activeLoans.length === 0,
    sellerEquity: price,
    downPayment: sellerDown,
    sellerPrincipalLoanAmount: sellerPrincipal,
    monthlyPrincipalAndInterest: sellerPayment,
    balloonBalance: unpaidPrincipalBalance(sellerPrincipal, input.sellerFinanceRate, input.sellerFinanceAmortizationMonths, balloonMonth),
    balloonPaymentMonth: balloonMonth,
  };

  const wrapPayment = monthlyPayment(Math.max(0, input.wrapLoanAmount), input.wrapRate, input.wrapTermMonths);
  const wrap: WrapStructure = {
    wrapLoanAmount: Math.max(0, input.wrapLoanAmount),
    monthlyPrincipalAndInterest: wrapPayment,
    underlyingPiti: underlyingPiti.totalMonthlyPiti,
    wrapSpread: wrapPayment - underlyingPiti.totalMonthlyPiti,
  };
  const dscr = underlyingPiti.totalMonthlyPiti > 0 ? profile.fairMarketRent / underlyingPiti.totalMonthlyPiti : profile.fairMarketRent > 0 ? Infinity : 0;
  const dscrThreshold = input.dscrThreshold ?? 1;
  const dscrStatus = dscr >= dscrThreshold ? "pass" : dscr >= dscrThreshold * 0.9 ? "warning" : "fail";
  return { profile, activeLoans, underlyingPiti, subjectTo, sellerFinancing: sellerFinance, wrap, dscr, dscrStatus, warnings: profile.warnings };
}