import { useMemo, useState } from "react";
import { api } from "./api";
import {
  applyOverrides,
  calculateUnderwriting,
  type FieldOverride,
  type UnifiedPropertyFinancialProfile,
} from "./underwritingEngine";

function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function OverrideField({
  label,
  value,
  override,
  onChange,
}: {
  label: string;
  value: number;
  override: FieldOverride<number>;
  onChange: (next: FieldOverride<number>) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--border, #30363d)" }}>
      <div>
        <strong style={{ fontSize: "12px", color: "var(--ink, #f8fafc)" }}>{label}</strong>
        <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>Imported: {money(value)}</div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted, #94a3b8)" }}>
        <input type="checkbox" checked={override.enabled} onChange={(event) => onChange({ ...override, enabled: event.target.checked })} />
        Override
        {override.enabled && (
          <input
            type="number"
            value={override.value}
            onChange={(event) => onChange({ ...override, value: Number(event.target.value) || 0 })}
            style={{ width: "92px", height: "28px", background: "var(--panel, #121216)", color: "var(--ink, #f8fafc)", border: "1px solid var(--border, #30363d)", borderRadius: "5px", padding: "0 6px" }}
          />
        )}
      </label>
    </div>
  );
}

export default function UnderwritingRecordsPanel({ address }: { address: string }) {
  const [profile, setProfile] = useState<UnifiedPropertyFinancialProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(450000);
  const [cashToSeller, setCashToSeller] = useState(25000);
  const [wrapLoanAmount, setWrapLoanAmount] = useState(405000);
  const [overrides, setOverrides] = useState({
    currentBalance: { enabled: false, value: 0 },
    interestRate: { enabled: false, value: 0 },
    annualPropertyTax: { enabled: false, value: 0 },
    monthlyInsurance: { enabled: false, value: 0 },
    estimatedMarketValue: { enabled: false, value: 0 },
    fairMarketRent: { enabled: false, value: 0 },
  });

  const effectiveProfile = useMemo(() => profile ? applyOverrides(profile, overrides) : null, [profile, overrides]);
  const result = useMemo(() => effectiveProfile ? calculateUnderwriting({
    profile: effectiveProfile,
    purchasePrice,
    cashToSeller,
    carrybackRate: 5,
    carrybackTermMonths: 120,
    sellerFinanceDownPayment: 45000,
    sellerFinanceRate: 6,
    sellerFinanceAmortizationMonths: 360,
    sellerFinanceBalloonPaymentMonth: 60,
    wrapLoanAmount,
    wrapRate: 7,
    wrapTermMonths: 360,
  }) : null, [effectiveProfile, purchasePrice, cashToSeller, wrapLoanAmount]);

  async function loadRecords() {
    if (!address.trim()) {
      setError("Enter a property address before looking up public records.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await api.cotalityUnderwriting(address.trim());
      setProfile(response.profile);
      const first = response.profile.voluntaryMortgages[0];
      setOverrides({
        currentBalance: { enabled: false, value: first?.currentBalance ?? 0 },
        interestRate: { enabled: false, value: first?.interestRate ?? 0 },
        annualPropertyTax: { enabled: false, value: response.profile.annualPropertyTax },
        monthlyInsurance: { enabled: false, value: response.profile.estimatedMonthlyInsurance },
        estimatedMarketValue: { enabled: false, value: response.profile.estimatedMarketValue },
        fairMarketRent: { enabled: false, value: response.profile.fairMarketRent },
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to retrieve public records.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, color: "var(--ink, #f8fafc)" }}>Public Records Underwriting</h3>
          <p style={{ margin: "4px 0 0", color: "var(--muted, #94a3b8)", fontSize: "12px" }}>Cotality lien data reconstructed into current loan economics.</p>
        </div>
        <button type="button" onClick={loadRecords} disabled={loading} style={{ padding: "9px 14px", border: "0", borderRadius: "6px", background: "var(--primary, #d6ff3f)", color: "#000", fontWeight: 800, cursor: "pointer" }}>
          {loading ? "Looking up..." : "Look Up Public Records"}
        </button>
      </div>
      {error && <div style={{ padding: "10px", borderRadius: "6px", color: "#fecaca", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)", fontSize: "12px" }}>{error}</div>}
      {!profile && !error && <div style={{ color: "var(--muted, #94a3b8)", fontSize: "12px" }}>No public-record profile loaded.</div>}
      {profile && (
        <>
          {effectiveProfile?.warnings.map((warning) => <div key={warning} style={{ padding: "10px", borderRadius: "6px", color: "#fde68a", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.35)", fontSize: "12px" }}>{warning}</div>)}
          <div className="uw-split">
            <section style={{ background: "var(--panel-2, #16161b)", border: "1px solid var(--border, #30363d)", borderRadius: "8px", padding: "14px" }}>
              <h4 style={{ margin: "0 0 8px", color: "var(--ink, #f8fafc)" }}>Source of Truth</h4>
              <OverrideField label="Current first-lien balance" value={profile.voluntaryMortgages[0]?.currentBalance ?? result?.activeLoans[0]?.unpaidPrincipalBalance ?? 0} override={overrides.currentBalance} onChange={(currentBalance) => setOverrides({ ...overrides, currentBalance })} />
              <OverrideField label="Interest rate" value={profile.voluntaryMortgages[0]?.interestRate ?? 0} override={overrides.interestRate} onChange={(interestRate) => setOverrides({ ...overrides, interestRate })} />
              <OverrideField label="Annual property taxes" value={profile.annualPropertyTax} override={overrides.annualPropertyTax} onChange={(annualPropertyTax) => setOverrides({ ...overrides, annualPropertyTax })} />
              <OverrideField label="Monthly insurance" value={profile.estimatedMonthlyInsurance} override={overrides.monthlyInsurance} onChange={(monthlyInsurance) => setOverrides({ ...overrides, monthlyInsurance })} />
              <OverrideField label="Estimated market value" value={profile.estimatedMarketValue} override={overrides.estimatedMarketValue} onChange={(estimatedMarketValue) => setOverrides({ ...overrides, estimatedMarketValue })} />
              <OverrideField label="Fair market rent" value={profile.fairMarketRent} override={overrides.fairMarketRent} onChange={(fairMarketRent) => setOverrides({ ...overrides, fairMarketRent })} />
            </section>
            <section style={{ background: "var(--panel-2, #16161b)", border: "1px solid var(--border, #30363d)", borderRadius: "8px", padding: "14px" }}>
              <h4 style={{ margin: "0 0 8px", color: "var(--ink, #f8fafc)" }}>Deal Structures</h4>
              <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                <label style={{ fontSize: "11px" }}>Purchase price<input type="number" value={purchasePrice} onChange={(event) => setPurchasePrice(Number(event.target.value) || 0)} /></label>
                <label style={{ fontSize: "11px" }}>Cash to seller<input type="number" value={cashToSeller} onChange={(event) => setCashToSeller(Number(event.target.value) || 0)} /></label>
                <label style={{ fontSize: "11px" }}>Wrap amount<input type="number" value={wrapLoanAmount} onChange={(event) => setWrapLoanAmount(Number(event.target.value) || 0)} /></label>
              </div>
              {result && <div style={{ display: "grid", gap: "8px", marginTop: "14px", fontSize: "12px" }}>
                <div>Underlying PITI <strong>{money(result.underlyingPiti.totalMonthlyPiti)}/mo</strong></div>
                <div>Subject-to carryback <strong>{money(result.subjectTo.sellerCarrybackPrincipal)}</strong> at <strong>{money(result.subjectTo.sellerCarrybackMonthlyPayment)}/mo</strong></div>
                <div>Seller financing <strong>{result.sellerFinancing.eligible ? "Eligible: free and clear" : "Not free and clear"}</strong></div>
                <div>Wrap spread <strong>{money(result.wrap.wrapSpread)}/mo</strong></div>
                <div>DSCR <strong>{Number.isFinite(result.dscr) ? result.dscr.toFixed(2) : "N/A"}</strong> ({result.dscrStatus})</div>
              </div>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}