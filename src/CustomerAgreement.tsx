import { useState, useEffect } from "react";
import ThemeToggle from "./ThemeToggle";
import { ALL_US_STATES, getStateComplianceRule } from "./stateWholesaleCompliance";

interface LegalPageProps {
  onBack: () => void;
  onSignIn: () => void;
  onLaunchApp: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
  onNavigateSecurity?: () => void;
  initialState?: string;
}

export default function CustomerAgreement({
  onBack,
  onSignIn,
  onLaunchApp,
  onNavigatePrivacy,
  onNavigateTerms,
  onNavigateSecurity,
  initialState,
}: LegalPageProps) {
  const [selectedState, setSelectedState] = useState<string>(() => {
    if (initialState) return initialState.toUpperCase();
    const hash = window.location.hash;
    const qIdx = hash.indexOf("?");
    if (qIdx !== -1) {
      const p = new URLSearchParams(hash.slice(qIdx + 1));
      const s = p.get("state");
      if (s) return s.toUpperCase();
    }
    const sp = new URLSearchParams(window.location.search).get("state");
    return sp ? sp.toUpperCase() : "TX";
  });

  const stateRule = getStateComplianceRule(selectedState);

  return (
    <div className="rw-page" style={{ minHeight: "100vh", backgroundColor: "var(--rw-bg)", color: "var(--rw-text)" }}>
      {/* ── Top Navigation Bar ── */}
      <header className="rw-nav">
        <div className="rw-container rw-nav-inner">
          <div className="rw-brand" onClick={onBack} style={{ cursor: "pointer" }}>
            <div className="rw-brand-icon">R</div>
            <span>Revzenta</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBack}
              style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              ← Back to Overview
            </button>
            <ThemeToggle />
            <button type="button" className="btn btn-ghost" onClick={onSignIn}>
              Sign In
            </button>
            <button type="button" className="btn btn-primary" onClick={onLaunchApp}>
              Launch CRM
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Legal Container ── */}
      <main className="rw-container" style={{ maxWidth: "920px", margin: "40px auto 80px", padding: "0 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px", borderBottom: "1px solid var(--rw-border)", paddingBottom: "24px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 600,
              backgroundColor: "var(--rw-primary-dim)",
              color: "var(--rw-primary)",
              marginBottom: "12px",
            }}
          >
            <span>📝</span> Customer Onboarding &amp; Software License
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            Master SaaS Subscriber Agreement
          </h1>
          <div style={{ fontSize: "14px", color: "var(--rw-text-dim)" }}>
            Standard Customer Subscription Agreement for Revzenta CRM · Software as a Service (SaaS)
          </div>

          {/* Quick Legal Nav Tabs */}
          <div style={{ display: "flex", gap: "10px", marginTop: "18px", flexWrap: "wrap" }}>
            <span style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, backgroundColor: "var(--rw-primary)", color: "var(--rw-primary-ink)" }}>
              Customer Agreement
            </span>
            {onNavigatePrivacy && (
              <button
                type="button"
                onClick={onNavigatePrivacy}
                style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)", color: "var(--rw-text)", cursor: "pointer" }}
              >
                Privacy Policy →
              </button>
            )}
            {onNavigateTerms && (
              <button
                type="button"
                onClick={onNavigateTerms}
                style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)", color: "var(--rw-text)", cursor: "pointer" }}
              >
                Terms of Service →
              </button>
            )}
            {onNavigateSecurity && (
              <button
                type="button"
                onClick={onNavigateSecurity}
                style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)", color: "var(--rw-text)", cursor: "pointer" }}
              >
                Security &amp; Safeguards →
              </button>
            )}
          </div>
        </div>

        {/* Executive Summary Card */}
        <div
          style={{
            padding: "20px 24px",
            borderRadius: "10px",
            backgroundColor: "var(--rw-surface)",
            border: "1px solid var(--rw-border)",
            borderLeft: "4px solid var(--rw-primary)",
            marginBottom: "32px",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px", color: "var(--rw-text)" }}>
            📄 What is this agreement?
          </div>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--rw-text-dim)", lineHeight: 1.6 }}>
            This is the binding master agreement between <strong>Revzenta LLC</strong> (the software provider) and your company (the subscriber). When you purchase a subscription to Revzenta CRM, this contract governs your software license, protects your exclusive data ownership, establishes statutory non-agency disclaimers, and details billing, compliance, and support terms.
          </p>
        </div>

        {/* Agreement Text Block */}
        <div
          style={{
            padding: "32px",
            borderRadius: "10px",
            backgroundColor: "var(--rw-surface)",
            border: "1px solid var(--rw-border)",
            fontSize: "14px",
            lineHeight: 1.8,
            color: "var(--rw-text)",
            boxShadow: "var(--rw-card-shadow)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px", letterSpacing: "0.02em" }}>
              REVZENTA CRM — MASTER SAAS SUBSCRIBER AGREEMENT
            </h2>
            <div style={{ fontSize: "12px", color: "var(--rw-text-muted)" }}>
              Standard Customer Agreement · Form REV-SaaS-2026
            </div>
          </div>

          <p>
            This Master Software as a Service (SaaS) Subscriber Agreement (<strong>&quot;Agreement&quot;</strong>) is entered into by and between <strong>Revzenta LLC</strong> (<strong>&quot;Provider&quot;</strong> or <strong>&quot;Revzenta&quot;</strong>), and the subscriber purchasing access to the Service (<strong>&quot;Subscriber&quot;</strong> or <strong>&quot;Customer&quot;</strong>).
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            1. SUBSCRIPTION GRANT &amp; AUTHORIZED WORKSPACE ACCESS
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            Subject to the terms of this Agreement and payment of applicable fees, Provider grants Subscriber a non-exclusive, non-transferable, revocable subscription right to access and use the Revzenta CRM cloud platform solely for Subscriber&apos;s internal real estate wholesaling, acquisitions, and investment operations.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            2. RECURRING SUBSCRIPTION FEES &amp; STRIPE BILLING
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            Subscriber agrees to pay the recurring subscription fee established during checkout or contract execution. Fees are billed in advance on a recurring monthly or annual billing cycle via Stripe. Subscriptions automatically renew until canceled by Subscriber via self-serve account settings.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            3. REFUND POLICY &amp; NO-PRORATION TERMS
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            (a) <strong>Non-Refundable Subscription Fees:</strong> Because Revzenta CRM provisions cloud workspace infrastructure, proprietary deal underwriting engines, automated legal contract generators (PSA, LOI, Assignment), and enriched property records immediately upon activation, all subscription fees (monthly and annual) are strictly non-refundable once billed.<br />
            (b) <strong>No Prorated Refunds:</strong> Upon cancellation, Subscriber retains workspace access through the conclusion of the current paid billing cycle. Provider does not issue prorated refunds, partial credits, or cash reimbursements for unused days, mid-billing cycle cancellations, or unutilized account features.<br />
            (c) <strong>Billing Inquiries &amp; Discrepancies:</strong> Any billing discrepancy, suspected duplicate charge, or calculation inquiry must be submitted in writing to <code>billing@revzenta.com</code> within thirty (30) calendar days of the charge date. Charges not disputed within thirty (30) days are deemed conclusively accepted and finalized.<br />
            (d) <strong>Chargebacks:</strong> Initiating an unauthorized merchant dispute or chargeback without first contacting Revzenta support constitutes a material breach of this Agreement, subjecting Subscriber&apos;s workspace to immediate termination.<br />
            (e) <strong>Statutory Exceptions:</strong> In jurisdictions where consumer protection or statutory laws mandate a non-waivable right of withdrawal or cooling-off period, refunds will be provided strictly in accordance with applicable statutory law.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            4. PROPRIETARY DATA OWNERSHIP &amp; ZERO-MONETIZATION PLEDGE
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            (a) <strong>Exclusive Ownership:</strong> Subscriber retains 100% exclusive proprietary ownership of all uploaded property leads, seller phone numbers, deal notes, buyer rosters, and transaction files.<br />
            (b) <strong>Non-Sale Guarantee:</strong> Revzenta will NEVER sell, lease, commercialize, broker, or monetize Subscriber data to any third party, marketing broker, or competing investor.<br />
            (c) <strong>Tenant Boundary Isolation:</strong> Cryptographic row-level database partitioning guarantees complete separation from other subscriber workspaces.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            5. REAL ESTATE STATUTORY NON-AGENCY &amp; STATE WHOLESALING COMPLIANCE DISCLAIMER
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            (a) <strong>Software Provider Status:</strong> Subscriber explicitly acknowledges that Revzenta LLC is an enterprise technology provider and is <strong>NOT a licensed real estate broker, brokerage, agent, appraisal firm, or escrow agency</strong>.<br />
            (b) <strong>Principal Investor Capacity:</strong> In marketing real estate contracts or utilizing Revzenta deal underwriting tools, Subscriber acts solely as an independent principal real estate investor acquiring or assigning equitable contractual rights pursuant to the Equitable Interest Doctrine and state-specific disclosure requirements.<br />
            (c) <strong>Subscriber Sole Duty for State-Specific Wholesaling Guidelines:</strong> Real estate wholesaling laws, licensing mandates, marketing restrictions, and disclosure rules vary significantly by state and municipality (including, but not limited to, wholesaling licensing statutes, equitable interest advertising constraints, double-closing rules, and earnest money deposit requirements). It is Subscriber&apos;s sole, non-delegable duty to ensure that all wholesaling practices, contracts, seller communications, and dispositions strictly comply with lawful practices and state-specific guidelines in each jurisdiction where Subscriber conducts transactions.<br />
            (d) <strong>No Defense or Legal Representation:</strong> Revzenta LLC does NOT defend, represent, counsel, or indemnify Subscriber against state-specific laws, real estate licensing commission investigations, regulatory citations, statutory penalties, or civil lawsuits arising out of Subscriber&apos;s wholesaling practices. Subscriber assumes full, independent legal and financial responsibility for its transactions and agrees to indemnify and hold harmless Revzenta LLC from any regulatory enforcement or third-party claims arising from Subscriber&apos;s activities.<br />
            (e) <strong>Affirmative State Statutory Warranty:</strong> Subscriber explicitly warrants and covenants that in executing real estate wholesale transactions within <strong>{stateRule.name}</strong>, Subscriber adheres to <code>{stateRule.citation}</code> and maintains the appropriate licensing or statutory written disclosures required by law.
          </p>

          {/* ── 5.1 State-Specific Wholesaling Statutory Addendum ── */}
          <div
            style={{
              marginTop: "20px",
              marginBottom: "20px",
              padding: "20px 24px",
              borderRadius: "10px",
              backgroundColor:
                stateRule.category === "license_required"
                  ? "rgba(239, 68, 68, 0.08)"
                  : stateRule.category === "mandatory_disclosure"
                  ? "rgba(245, 158, 11, 0.08)"
                  : "rgba(16, 185, 129, 0.08)",
              border:
                stateRule.category === "license_required"
                  ? "1px solid rgba(239, 68, 68, 0.3)"
                  : stateRule.category === "mandatory_disclosure"
                  ? "1px solid rgba(245, 158, 11, 0.3)"
                  : "1px solid rgba(16, 185, 129, 0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    backgroundColor:
                      stateRule.category === "license_required"
                        ? "rgba(239, 68, 68, 0.2)"
                        : stateRule.category === "mandatory_disclosure"
                        ? "rgba(245, 158, 11, 0.2)"
                        : "rgba(16, 185, 129, 0.2)",
                    color:
                      stateRule.category === "license_required"
                        ? "#ef4444"
                        : stateRule.category === "mandatory_disclosure"
                        ? "#f59e0b"
                        : "#10b981",
                  }}
                >
                  {stateRule.category === "license_required"
                    ? "⚖️ License Required / Restricted Jurisdiction"
                    : stateRule.category === "mandatory_disclosure"
                    ? "ℹ️ Mandatory Written Equitable Disclosure State"
                    : "✓ Standard Equitable Interest Doctrine"}
                </span>
                <h4 style={{ margin: "8px 0 2px", fontSize: "16px", fontWeight: 800, color: "var(--rw-text)" }}>
                  5.1 {stateRule.agreementAddendumTitle}
                </h4>
                <div style={{ fontSize: "12px", color: "var(--rw-text-dim)" }}>
                  Statute: <strong>{stateRule.citation}</strong> · Effective: {stateRule.effectiveDate}
                </div>
              </div>

              {/* State Switcher Dropdown inside Agreement */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--rw-text-dim)" }}>
                  Change State:
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: "1px solid var(--rw-border)",
                    backgroundColor: "var(--rw-surface)",
                    color: "var(--rw-text)",
                    cursor: "pointer",
                  }}
                >
                  {ALL_US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {stateRule.licenseRequiredNotice && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#f87171",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  marginBottom: "12px",
                  lineHeight: 1.5,
                }}
              >
                {stateRule.licenseRequiredNotice}
              </div>
            )}

            <p style={{ fontSize: "13px", color: "var(--rw-text-dim)", lineHeight: 1.6, marginBottom: "12px" }}>
              {stateRule.summary}
            </p>

            <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--rw-text)", marginBottom: "6px" }}>
              Key Statutory Compliance Requirements for {stateRule.name}:
            </div>
            <ul style={{ margin: "0 0 14px", paddingLeft: "20px", fontSize: "13px", color: "var(--rw-text-dim)", lineHeight: 1.6 }}>
              {stateRule.keyRequirements.map((req, idx) => (
                <li key={idx} style={{ marginBottom: "4px" }}>{req}</li>
              ))}
            </ul>

            <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--rw-text)", marginBottom: "6px" }}>
              Binding Subscriber Addendum Clauses:
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--rw-text-dim)", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: "6px" }}>
              {stateRule.agreementAddendumClauses.map((clause, idx) => (
                <div key={idx} style={{ paddingLeft: "12px", borderLeft: "2px solid var(--rw-primary)" }}>
                  {clause}
                </div>
              ))}
            </div>
          </div>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            6. FAIR CREDIT REPORTING ACT (FCRA 15 U.S.C. § 1681a) NOTICE
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            Revzenta CRM and its third-party public records feeds (including RentCast MLS and county tax assessor data) are NOT Consumer Reporting Agencies (&quot;CRAs&quot;). Subscriber covenants that it shall NOT use any data, estimates, or records obtained through the Service for any purpose governed by the FCRA, including evaluating consumer credit, personal loans, employment screening, or tenant leasing.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            7. TELEPHONY, DNC &amp; OUTREACH COMPLIANCE WARRANTY
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            Subscriber warrants that all cold calling, SMS text campaigns, and telemarketing outreach conducted by Subscriber comply strictly with the Telephone Consumer Protection Act (47 U.S.C. § 227), TSR regulations, and the National Do Not Call Registry. Subscriber agrees to immediately honor opt-out requests, utilize Revzenta&apos;s CCPA Purge / Suppression Registry, and indemnify Revzenta against any TCPA or regulatory claims resulting from Subscriber&apos;s outreach.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            8. ACCEPTABLE USE &amp; RESTRICTIONS
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            Subscriber shall not reverse-engineer, decompile, or disassemble the Service; conduct unauthorized automated scraping against Provider infrastructure; transmit unlawful material; or share account credentials outside authorized staff.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            9. TERM, CANCELLATION &amp; 30-DAY DATA RETENTION
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            This Agreement continues on a month-to-month basis until canceled. Subscriber may cancel at any time directly through account settings. Upon cancellation, Subscriber data is retained for thirty (30) days for export, after which it is permanently purged via automated database cascade protocols.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            10. LIMITATION OF LIABILITY
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            The Service is provided &quot;AS IS.&quot; In no event shall Revzenta&apos;s aggregate liability exceed the total subscription fees paid by Subscriber in the twelve (12) months preceding the claim.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            11. GOVERNING LAW &amp; BINDING ARBITRATION
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            This Agreement shall be governed by the laws of the State of Delaware. Any dispute arising hereunder shall be resolved through binding arbitration administered by the American Arbitration Association (AAA).
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: "24px", marginBottom: "8px", color: "var(--rw-text)" }}>
            12. ELECTRONIC SIGNATURE &amp; EXECUTION
          </h3>
          <p style={{ color: "var(--rw-text-dim)" }}>
            Execution of this Agreement via electronic signature or digital sign-up checkout constitutes a legally binding execution under the federal E-SIGN Act (15 U.S.C. § 7001 et seq.) and the Uniform Electronic Transactions Act (UETA).
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--rw-border)", padding: "24px 0", textAlign: "center", fontSize: "13px", color: "var(--rw-text-muted)" }}>
        <div className="rw-container">
          © {new Date().getFullYear()} Revzenta LLC. All rights reserved. · Revzenta Master SaaS Subscriber Agreement
        </div>
      </footer>
    </div>
  );
}
