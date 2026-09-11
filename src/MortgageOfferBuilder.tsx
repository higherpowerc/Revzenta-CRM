import { useEffect, useMemo, useState } from "react";
import { api, type ClientInput } from "./api";
import type { Client, PropertyEnrichmentResult } from "./types";
import { extractAddressFromUrl } from "./urlAddressParser";
import { evaluateDealViability, type DealViabilityScorecard } from "./dealUnderwriting";

interface Props {
  property?: Client | null;
  opportunities?: Client[];
  onUpdated?: (updated: Client) => void;
}

type OfferStructure = "cash" | "seller_financing" | "subject_to";

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: "40px",
  padding: "0 10px",
  border: "1px solid var(--border, #30363d)",
  borderRadius: "5px",
  background: "var(--panel, #121216)",
  color: "var(--ink, #f8fafc)",
  boxSizing: "border-box",
};

function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function monthsBetween(start: string, end = new Date()): number {
  const date = new Date(`${start}T00:00:00`);
  if (!Number.isFinite(date.getTime()) || date > end) return 0;
  const months = (end.getFullYear() - date.getFullYear()) * 12 + end.getMonth() - date.getMonth();
  return Math.max(0, months - (end.getDate() < date.getDate() ? 1 : 0));
}

function payment(principal: number, annualRate: number, termMonths: number): number {
  const p = Math.max(0, principal);
  const n = Math.max(1, Math.floor(termMonths));
  const r = Math.max(0, annualRate) / 100 / 12;
  if (!p) return 0;
  if (!r) return p / n;
  const factor = Math.pow(1 + r, n);
  return p * (r * factor) / (factor - 1);
}

function balance(principal: number, annualRate: number, termMonths: number, elapsedMonths: number): number {
  const p = Math.max(0, principal);
  const n = Math.max(1, Math.floor(termMonths));
  const elapsed = Math.min(n, Math.max(0, Math.floor(elapsedMonths)));
  const r = Math.max(0, annualRate) / 100 / 12;
  if (!p || elapsed >= n) return elapsed >= n ? 0 : p;
  if (!r) return Math.max(0, p * (1 - elapsed / n));
  const factor = Math.pow(1 + r, n);
  return Math.max(0, p * (factor - Math.pow(1 + r, elapsed)) / (factor - 1));
}

function Field({ label, value, onChange, type = "number", step = "1" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; step?: string }) {
  return (
    <label style={{ display: "grid", gap: "5px", minWidth: 0 }}>
      <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted, #94a3b8)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
      <input style={inputStyle} type={type} step={step} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default function MortgageOfferBuilder({ property, opportunities = [], onUpdated }: Props) {
  const [address, setAddress] = useState("");
  const [url, setUrl] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [propertyData, setPropertyData] = useState<PropertyEnrichmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [originalLoan, setOriginalLoan] = useState("");
  const [originationDate, setOriginationDate] = useState("");
  const [interestRate, setInterestRate] = useState("5.5");
  const [termMonths, setTermMonths] = useState("360");
  const [ltv, setLtv] = useState("80");
  const [arrears, setArrears] = useState("0");
  const [sellerCashOut, setSellerCashOut] = useState("0");
  const [wholesaleFee, setWholesaleFee] = useState("10000");
  const [repairs, setRepairs] = useState("0");
  const [closingCosts, setClosingCosts] = useState("2000");
  const [downPayment, setDownPayment] = useState("0");
  const [listedPrice, setListedPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [insurance, setInsurance] = useState("150");
  const [hoa, setHoa] = useState("0");
  const [structure, setStructure] = useState<OfferStructure>("subject_to");
  const [sellerFinancingRate, setSellerFinancingRate] = useState("5.5");
  const [sellerFinancingTerm, setSellerFinancingTerm] = useState("360");
  const [sellerFinancingBalloon, setSellerFinancingBalloon] = useState("60");
  const [wrapRate, setWrapRate] = useState("7");
  const [interestOnly, setInterestOnly] = useState(false);
  const [maintenanceReserve, setMaintenanceReserve] = useState("5");
  const [vacancyReserve, setVacancyReserve] = useState("5");
  const [managementFee, setManagementFee] = useState("8");
  const [monthlyPaymentOverride, setMonthlyPaymentOverride] = useState("");

  const loadSavedProperty = (saved: Client) => {
    const fullAddress = [saved.address, saved.city, saved.state, saved.zip].filter(Boolean).join(", ");
    const field = (name: string) => saved.customFields?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value || "";
    const numberField = (name: string) => Number(field(name)) || 0;
    const savedStructure = field("Offer Structure");
    setAddress(fullAddress || saved.companyName);
    setSellerName(saved.contactName || "");
    setPurchasePrice(saved.dealValue ? String(saved.dealValue) : "");
    setListedPrice(field("Listed Price") || (saved.dealValue ? String(saved.dealValue) : ""));
    setPropertyData({ formattedAddress: fullAddress || saved.companyName, addressLine1: saved.address || saved.companyName, city: saved.city || "", state: saved.state || "", zipCode: saved.zip || "", estimatedValue: numberField("AVM Market Value") || numberField("Estimated Value") || saved.dealValue, estimatedRent: numberField("Market Rent") || numberField("Rent Estimate"), source: "public_records_estimate" });
    if (field("Original Loan Amount")) setOriginalLoan(field("Original Loan Amount"));
    if (field("Loan Origination Date")) setOriginationDate(field("Loan Origination Date"));
    if (field("Interest Rate")) setInterestRate(field("Interest Rate"));
    if (field("Mortgage Term Months")) setTermMonths(field("Mortgage Term Months"));
    if (field("Arrears")) setArrears(field("Arrears"));
    if (field("Seller Cash Out")) setSellerCashOut(field("Seller Cash Out"));
    if (field("Wholesale Fee")) setWholesaleFee(field("Wholesale Fee"));
    if (field("Estimated Repairs")) setRepairs(field("Estimated Repairs"));
    if (field("Closing Costs")) setClosingCosts(field("Closing Costs"));
    if (["cash", "seller_financing", "subject_to"].includes(savedStructure)) setStructure(savedStructure as OfferStructure);
    setMessage("Saved opportunity loaded. Review or update the deal below.");
  };

  useEffect(() => {
    if (!property) return;
    loadSavedProperty(property);
  }, [property]);

  const calculateFromData = (data: PropertyEnrichmentResult, query: string) => {
    setPropertyData(data);
    const salePrice = data.lastSalePrice || data.estimatedValue || 0;
    setAddress(data.formattedAddress || query);
    setSellerName(data.ownerName || sellerName);
    setPurchasePrice((current) => current || String(Math.round(data.estimatedValue || salePrice)));
    setOriginalLoan((current) => current || String(Math.round(salePrice * (Number(ltv) / 100))));
    setOriginationDate((current) => current || data.lastSaleDate || new Date().toISOString().slice(0, 10));
    setMessage(data.source === "not_found" ? "Property not found. Enter the mortgage assumptions manually." : "Property data loaded. Review the assumptions below.");
  };

  const lookup = async (raw: string) => {
    const query = raw.trim();
    if (!query) {
      setError("Enter an address or property URL first.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const parsed = extractAddressFromUrl(query);
      if (parsed.isUrl && !parsed.authorized) throw new Error(parsed.rejectionReason || "This property URL is not supported.");
      const lookupAddress = parsed.address || query;
      const result = await api.lookupProperty(lookupAddress);
      calculateFromData(result.property, lookupAddress);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to look up this property.");
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    const value = Number(propertyData?.estimatedValue || 0);
    const price = Number(purchasePrice) || value;
    const principal = Number(originalLoan) || (Number(propertyData?.lastSalePrice || price) * (Number(ltv) / 100));
    const rate = Number(interestRate) || 0;
    const term = Number(termMonths) || 360;
    const elapsed = originationDate ? monthsBetween(originationDate) : 0;
    const monthlyPi = payment(principal, rate, term);
    const currentBalance = balance(principal, rate, term, elapsed);
    const monthlyTax = Number(propertyData?.taxAssessedValue || 0) > 0 ? Number(propertyData?.taxAssessedValue) * 0.012 / 12 : 0;
    const piti = monthlyPi + monthlyTax + Number(insurance || 0) + Number(hoa || 0);
    const rent = Number(propertyData?.estimatedRent || 0);
    const equity = value - currentBalance;
    const monthlyCashFlow = rent - piti;
    const cashOffer = Math.max(0, value * 0.7 - Number(repairs || 0) - Number(closingCosts || 0) - Number(wholesaleFee || 0));
    const sellerPrincipal = Math.max(0, price - Number(downPayment || 0));
    const sellerFinancingPayment = interestOnly ? sellerPrincipal * (Number(sellerFinancingRate) / 100 / 12) : payment(sellerPrincipal, Number(sellerFinancingRate), Number(sellerFinancingTerm));
    const wrapPayment = payment(Math.max(0, price - Number(downPayment || 0)), Number(wrapRate), Number(termMonths));
    const operatingReserves = rent * ((Number(maintenanceReserve) + Number(vacancyReserve) + Number(managementFee)) / 100);
    const sellerCashFlow = rent - sellerFinancingPayment - Number(insurance || 0) - Number(hoa || 0) - operatingReserves;
    const sellerDscr = sellerFinancingPayment > 0 ? Math.max(0, rent - Number(insurance || 0) - Number(hoa || 0) - operatingReserves) / sellerFinancingPayment : 0;
    const subjectPayment = Number(monthlyPaymentOverride) || monthlyPi;
    const subjectOutflow = subjectPayment + monthlyTax + Number(insurance || 0) + Number(hoa || 0);
    const subjectCashFlow = rent - subjectOutflow;
    const subjectDscr = subjectOutflow > 0 ? rent / subjectOutflow : 0;
    const balloonBalance = balance(sellerPrincipal, Number(sellerFinancingRate), Number(sellerFinancingTerm), Number(sellerFinancingBalloon));
    return { value, price, principal, elapsed, monthlyPi, currentBalance, monthlyTax, piti: subjectOutflow, rent, equity, monthlyCashFlow: subjectCashFlow, cashOffer, sellerFinancingPayment, wrapPayment, sellerCashFlow, sellerDscr, subjectDscr, balloonBalance };
  }, [propertyData, purchasePrice, originalLoan, ltv, interestRate, termMonths, originationDate, insurance, hoa, wholesaleFee, repairs, closingCosts, downPayment, sellerFinancingRate, sellerFinancingTerm, sellerFinancingBalloon, wrapRate, interestOnly, maintenanceReserve, vacancyReserve, managementFee, monthlyPaymentOverride]);

  const viability = useMemo<DealViabilityScorecard>(() => {
    if (structure === "cash") {
      const basis = metrics.cashOffer + Number(repairs || 0) + Number(closingCosts || 0) + Number(wholesaleFee || 0);
      const roi = basis > 0 ? Math.max(0, (metrics.value - basis) / basis * 100) : 0;
      return evaluateDealViability("cash", { investorROI: roi, netWholesaleOffer: metrics.cashOffer, maxAllowableOffer: Math.max(0, metrics.cashOffer + Number(wholesaleFee || 0)) });
    }
    const entryCapital = Number(downPayment || 0) + Number(wholesaleFee || 0) + Number(closingCosts || 0) + (structure === "subject_to" ? Number(sellerCashOut || 0) + Number(arrears || 0) : 0);
    const cashFlow = structure === "seller_financing" ? metrics.sellerCashFlow : metrics.monthlyCashFlow;
    const dscr = structure === "seller_financing" ? metrics.sellerDscr : metrics.subjectDscr;
    return evaluateDealViability(structure === "subject_to" ? "subto" : "creative", {
      netMonthlyCashFlow: cashFlow,
      cashOnCashReturn: entryCapital > 0 ? cashFlow * 12 / entryCapital * 100 : 0,
      entryCapitalPct: metrics.price > 0 ? entryCapital / metrics.price * 100 : 0,
      dscr,
    });
  }, [structure, metrics, repairs, closingCosts, wholesaleFee, downPayment, sellerCashOut, arrears]);

  const saveDeal = async () => {
    if (!address.trim()) {
      setError("Load a property before saving the deal.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const parsed = address.split(",").map((part) => part.trim());
      const fields = [
        { name: "Estimated Mortgage Balance", value: String(Math.round(metrics.currentBalance)) },
        { name: "Original Loan Amount", value: String(Math.round(metrics.principal)) },
        { name: "Loan Origination Date", value: originationDate },
        { name: "Interest Rate", value: String(Number(interestRate) || 0) },
        { name: "Mortgage Term Months", value: String(Number(termMonths) || 360) },
        { name: "Estimated Equity", value: String(Math.round(metrics.equity)) },
        { name: "Monthly PITI", value: String(Math.round(metrics.piti)) },
        { name: "Arrears", value: arrears },
        { name: "Seller Cash Out", value: sellerCashOut },
        { name: "Wholesale Fee", value: wholesaleFee },
        { name: "Estimated Repairs", value: repairs },
        { name: "Closing Costs", value: closingCosts },
        { name: "Offer Structure", value: structure },
        { name: "Listed Price", value: listedPrice },
        { name: "Monthly Offer Payment", value: String(Math.round(structure === "seller_financing" ? metrics.sellerFinancingPayment : structure === "subject_to" ? metrics.piti : 0)) },
      ];
      const input: ClientInput = {
        companyName: address,
        contactName: sellerName || "Unknown Owner",
        email: property?.email || "",
        phone: property?.phone || "",
        clientType: property?.clientType || "single_family",
        dealValue: Number(purchasePrice) || metrics.price,
        address: parsed[0] || address,
        city: parsed[1] || "",
        state: parsed[2]?.split(" ")[0] || "",
        zip: parsed[2]?.split(" ")[1] || "",
        customFields: [...(property?.customFields || []).filter((field) => !fields.some((next) => next.name.toLowerCase() === field.name.toLowerCase())), ...fields],
      };
      const response = property?.id ? await api.updateClient(property.id, input) : await api.createClient(input);
      onUpdated?.(response.client);
      setPropertyData(null);
      setAddress("");
      setUrl("");
      setSellerName("");
      setOriginalLoan("");
      setOriginationDate("");
      setPurchasePrice("");
      setMessage("Deal saved. Ready for the next property.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the deal.");
    } finally {
      setSaving(false);
    }
  };

  const hasProperty = Boolean(propertyData || property || address.trim());
  return (
    <section className="mortgage-builder" style={{ width: "100%", maxWidth: "1180px", margin: "0 auto", padding: "24px 16px", boxSizing: "border-box" }}>
      <style>{`.mortgage-builder-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.mortgage-builder-table{width:100%;border-collapse:collapse}.mortgage-builder-table td{padding:10px 0;border-bottom:1px solid var(--border,#30363d)}@media(max-width:700px){.mortgage-builder-grid{grid-template-columns:1fr}}`}</style>
      <header style={{ textAlign: "center", marginBottom: "22px" }}>
        <h1 style={{ margin: 0 }}>Build Deal</h1>
        <p style={{ margin: "7px 0 0", color: "var(--muted, #94a3b8)" }}>Look up one property, estimate the mortgage, and structure the offer.</p>
      </header>
      <div className="mortgage-builder-grid" style={{ alignItems: "end", maxWidth: "1000px", margin: "0 auto 16px" }}>
        <label style={{ display: "grid", gap: "5px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted, #94a3b8)", textTransform: "uppercase" }}>Load from Opportunities</span>
          <select style={inputStyle} value="" onChange={(event) => { const saved = opportunities.find((item) => String(item.id) === event.target.value); if (saved) loadSavedProperty(saved); }}>
            <option value="">Select a saved opportunity...</option>
            {opportunities.map((item) => <option key={item.id} value={item.id}>{item.address || item.companyName}{item.dealValue ? ` - ${money(item.dealValue)}` : ""}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: "5px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted, #94a3b8)", textTransform: "uppercase" }}>Enter Property Address</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <input style={inputStyle} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="742 Evergreen Terrace, Springfield" />
            <button type="button" className="btn btn-primary" onClick={() => lookup(address)} disabled={loading}>{loading ? "Loading..." : "Search"}</button>
          </div>
        </label>
        <label style={{ display: "grid", gap: "5px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted, #94a3b8)", textTransform: "uppercase" }}>Upload Property URL</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <input style={inputStyle} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste Zillow, Redfin, Realtor.com URL" />
            <button type="button" className="btn btn-primary" onClick={() => lookup(url)} disabled={loading}>{loading ? "Loading..." : "Upload"}</button>
          </div>
        </label>
      </div>
      {error && <div role="alert" style={{ color: "#f87171", padding: "10px 12px", borderBottom: "1px solid #7f1d1d", marginBottom: "16px" }}>{error}</div>}
      {message && <div style={{ color: "#34d399", padding: "10px 12px", borderBottom: "1px solid #065f46", marginBottom: "16px" }}>{message}</div>}
      {hasProperty && propertyData && (
        <>
          <section style={{ margin: "0 auto 22px", maxWidth: "900px", textAlign: "center" }}>
            <h2 style={{ margin: "0 0 12px" }}>Choose Your Offer Structure</h2>
            <div role="tablist" aria-label="Offer structure" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
              {([
                ["cash", "Cash Offer", "Fast close / MAO"],
                ["seller_financing", "Seller Financing", "Owner carry note"],
                ["subject_to", "Subject-To", "Take over payments"],
              ] as const).map(([value, label, hint]) => (
                <button key={value} type="button" role="tab" aria-selected={structure === value} onClick={() => setStructure(value)} style={{ minHeight: "68px", padding: "10px", borderRadius: "7px", border: structure === value ? "2px solid var(--primary, #d6ff3f)" : "1px solid var(--border, #30363d)", background: structure === value ? "rgba(214,255,63,.12)" : "var(--panel, #121216)", color: "var(--ink, #f8fafc)", cursor: "pointer" }}><strong style={{ display: "block" }}>{label}</strong><span style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "var(--muted, #94a3b8)" }}>{hint}</span></button>
              ))}
            </div>
          </section>
          <div className="mortgage-builder-grid">
            <section><h2>Property Data</h2><table className="mortgage-builder-table"><tbody><tr><td>Estimated value</td><td style={{ textAlign: "right", fontWeight: 800 }}>{money(metrics.value)}</td></tr><tr><td>Last sale</td><td style={{ textAlign: "right" }}>{propertyData.lastSaleDate || "Not available"} {propertyData.lastSalePrice ? money(propertyData.lastSalePrice) : ""}</td></tr><tr><td>Estimated rent</td><td style={{ textAlign: "right" }}>{money(metrics.rent)}/mo</td></tr><tr><td>Address</td><td style={{ textAlign: "right" }}>{propertyData.formattedAddress || address}</td></tr></tbody></table></section>
            <section><h2>Estimated Mortgage Details</h2><div className="mortgage-builder-grid"><Field label="Original loan amount" value={originalLoan} onChange={setOriginalLoan} /><Field label="Origination date" value={originationDate} onChange={setOriginationDate} type="date" /><Field label="Interest rate %" value={interestRate} onChange={setInterestRate} step="0.01" /><Field label="Term months" value={termMonths} onChange={setTermMonths} /><Field label="LTV % fallback" value={ltv} onChange={setLtv} step="0.01" /><Field label="Arrears" value={arrears} onChange={setArrears} />{structure === "subject_to" && <Field label="Monthly payment override" value={monthlyPaymentOverride} onChange={setMonthlyPaymentOverride} />}</div></section>
          </div>
          <div className="mortgage-builder-grid" style={{ marginTop: "20px" }}>
            <section><h2>Mortgage Calculation</h2><table className="mortgage-builder-table"><tbody><tr><td>Elapsed months</td><td style={{ textAlign: "right" }}>{metrics.elapsed}</td></tr><tr><td>Estimated monthly P&amp;I</td><td style={{ textAlign: "right", fontWeight: 800 }}>{money(metrics.monthlyPi)}</td></tr><tr><td>Estimated current balance</td><td style={{ textAlign: "right", fontWeight: 800 }}>{money(metrics.currentBalance)}</td></tr><tr><td>Estimated equity</td><td style={{ textAlign: "right", fontWeight: 800 }}>{money(metrics.equity)}</td></tr><tr><td>Total PITI</td><td style={{ textAlign: "right", fontWeight: 800 }}>{money(metrics.piti)}/mo</td></tr></tbody></table></section>
            <section>
              <h2>{structure === "cash" ? "Cash Offer" : structure === "seller_financing" ? "Seller Financing Terms" : "Subject-To Terms"}</h2>
              <div className="mortgage-builder-grid">
                <Field label="Purchase price" value={purchasePrice} onChange={setPurchasePrice} />
                {structure === "seller_financing" && <Field label="Listed price" value={listedPrice} onChange={setListedPrice} />}
                <Field label="Wholesale fee" value={wholesaleFee} onChange={setWholesaleFee} />
                {structure === "cash" && <><Field label="Estimated repairs" value={repairs} onChange={setRepairs} /><Field label="Closing costs" value={closingCosts} onChange={setClosingCosts} /></>}
                {structure !== "cash" && <Field label="Down payment" value={downPayment} onChange={setDownPayment} />}
                {structure === "subject_to" && <>
                  <Field label="Seller cash out" value={sellerCashOut} onChange={setSellerCashOut} />
                  <Field label="Arrears" value={arrears} onChange={setArrears} />
                  <Field label="Monthly insurance" value={insurance} onChange={setInsurance} />
                  <Field label="Monthly HOA" value={hoa} onChange={setHoa} />
                </>}
                {structure === "seller_financing" && <>
                  <Field label="Note rate %" value={sellerFinancingRate} onChange={setSellerFinancingRate} step="0.01" />
                  <Field label="Amortization months" value={sellerFinancingTerm} onChange={setSellerFinancingTerm} />
                  <Field label="Balloon month" value={sellerFinancingBalloon} onChange={setSellerFinancingBalloon} />
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700 }}><input type="checkbox" checked={interestOnly} onChange={(event) => setInterestOnly(event.target.checked)} /> Interest-only payments</label>
                  <Field label="Maintenance reserve %" value={maintenanceReserve} onChange={setMaintenanceReserve} step="0.1" />
                  <Field label="Vacancy reserve %" value={vacancyReserve} onChange={setVacancyReserve} step="0.1" />
                  <Field label="Management fee %" value={managementFee} onChange={setManagementFee} step="0.1" />
                </>}
                {structure === "cash" && <Field label="Estimated repairs" value={arrears} onChange={setArrears} />}
              </div>
              <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border, #30363d)" }}>
                {structure === "cash" ? <>Recommended cash offer: <strong>{money(metrics.cashOffer)}</strong></> : structure === "seller_financing" ? <>Seller note payment: <strong>{money(metrics.sellerFinancingPayment)}/mo</strong> · DSCR: <strong>{metrics.sellerDscr.toFixed(2)}</strong> · Balloon balance: <strong>{money(metrics.balloonBalance)}</strong></> : <>Subject-To monthly outlay: <strong>{money(metrics.piti)}/mo</strong> · Cash flow: <strong>{money(metrics.monthlyCashFlow)}/mo</strong> · DSCR: <strong>{metrics.subjectDscr.toFixed(2)}</strong></>}
              </div>
            </section>
          </div>
          <section style={{ marginTop: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div><h2 style={{ marginBottom: "4px" }}>End Buyer Deal Score</h2><span style={{ color: "var(--muted, #94a3b8)", fontSize: "12px" }}>{viability.verdict}</span></div>
              <strong style={{ fontSize: "26px", color: viability.score >= 85 ? "#10b981" : viability.score >= 70 ? "#f59e0b" : "#ef4444" }}>{viability.score}/100 · {viability.grade}</strong>
            </div>
            <table className="mortgage-builder-table"><tbody>{viability.checks.map((check) => <tr key={check.title}><td><strong>{check.title}</strong><div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>Target: {check.targetCriteria}</div></td><td style={{ textAlign: "right" }}><strong>{check.metricValue}</strong> <span style={{ color: check.status === "passed" ? "#10b981" : check.status === "warning" ? "#f59e0b" : "#ef4444", fontWeight: 800 }}>{check.status === "passed" ? "PASS" : check.status === "warning" ? "CHECK" : "FAIL"}</span></td></tr>)}</tbody></table>
          </section>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}><button type="button" className="btn btn-primary" onClick={saveDeal} disabled={saving}>{saving ? "Saving..." : "Save Deal"}</button></div>
        </>
      )}
    </section>
  );
}
