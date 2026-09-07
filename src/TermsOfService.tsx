import ThemeToggle from "./ThemeToggle";

interface LegalPageProps {
  onBack: () => void;
  onSignIn: () => void;
  onLaunchApp: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateSecurity?: () => void;
}

export default function TermsOfService({ onBack, onSignIn, onLaunchApp, onNavigatePrivacy, onNavigateSecurity }: LegalPageProps) {
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
            <span>⚖️</span> Master SaaS Subscription Terms
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            Terms of Service
          </h1>
          <div style={{ fontSize: "14px", color: "var(--rw-text-dim)" }}>
            Effective Date: <strong>September 7, 2026</strong> · Version 2.4
          </div>

          {/* Quick Legal Nav Tabs */}
          <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
            {onNavigatePrivacy && (
              <button
                type="button"
                onClick={onNavigatePrivacy}
                style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)", color: "var(--rw-text)", cursor: "pointer" }}
              >
                Privacy Policy →
              </button>
            )}
            <span style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, backgroundColor: "var(--rw-primary)", color: "var(--rw-primary-ink)" }}>
              Terms of Service
            </span>
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

        {/* Real Estate Non-Agency Statutory Disclosure Card */}
        <div
          style={{
            padding: "20px 24px",
            borderRadius: "10px",
            backgroundColor: "var(--rw-surface)",
            border: "1px solid var(--rw-border)",
            borderLeft: "4px solid #f59e0b",
            marginBottom: "32px",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px", color: "#f59e0b" }}>
            ⚠️ Real Estate Wholesaling &amp; Non-Agency Statutory Notice
          </div>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--rw-text-dim)", lineHeight: 1.6 }}>
            Revzenta LLC is a technology software provider and <strong>is NOT a licensed real estate broker, brokerage, agent, appraisal firm, or escrow agent</strong>. Revzenta CRM provides tools to manage contractual agreements and marketing workflows. Subscribers acknowledge they act as independent real estate investors or licensed professionals operating in accordance with state licensing laws.
          </p>
        </div>

        {/* Content Body */}
        <div style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--rw-text-dim)" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            1. Acceptance of Terms &amp; Subscription Agreement
          </h2>
          <p>
            By accessing or using the Revzenta CRM platform, APIs, contract generation engines, and mobile interfaces (collectively, the &quot;Service&quot;), you agree to be legally bound by these Terms of Service. If you are entering into this agreement on behalf of a company, partnership, or legal entity, you represent and warrant that you possess the full legal authority to bind such entity.
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            2. Real Estate Wholesaling &amp; Equitable Interest Doctrine
          </h2>
          <p>
            Revzenta CRM provides contract generators for Purchase and Sale Agreements (PSA), Assignment of Contracts, and Letters of Intent (LOI). When utilizing these templates:
          </p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>
              <strong>Equitable Interest:</strong> You acknowledge and agree that under the Equitable Interest Doctrine (and applicable state statutes, including TX Prop Code § 5.086, FL Real Estate Commission rules, and CA Civil Code), you are marketing your <em>equitable contractual rights as a buyer principal</em>, and not acting as an unrepresented real estate broker.
            </li>
            <li>
              <strong>Required Disclosures:</strong> You agree to include all required statutory disclaimers in your offers, LOIs, and marketing collateral indicating your principal capacity and non-agency status.
            </li>
            <li>
              <strong>Independent Legal Counsel:</strong> Contract templates provided in Revzenta CRM are standard drafting starting points. Subscribers are strongly advised to have qualified local real estate counsel review and approve forms for compliance with state-specific closing rules.
            </li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            3. Fair Credit Reporting Act (FCRA 15 U.S.C. § 1681a) Disclaimer
          </h2>
          <p>
            Revzenta CRM and its data feeds (including RentCast property enrichment) are <strong>NOT Consumer Reporting Agencies (CRAs)</strong>. You expressly agree that you shall NOT use any data, records, property valuations, or estimated mortgage balances provided by the Service for any purpose governed by the FCRA, including:
          </p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>Determining an individual’s eligibility for personal, family, or household credit or insurance.</li>
            <li>Evaluating an individual for employment, hiring, promotion, or retention.</li>
            <li>Screening individuals for residential or commercial leases or tenant tenancy.</li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            4. SaaS Subscriptions, Billing &amp; Refund Policy
          </h2>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>
              <strong>Subscription Billing:</strong> Subscriptions are billed in advance on a recurring monthly or annual basis via Stripe. Your subscription will automatically renew until canceled in accordance with these Terms.
            </li>
            <li>
              <strong>Self-Serve Cancellation:</strong> You may cancel your subscription at any time directly through <code>Settings &gt; Subscription &amp; Billing</code>. Cancellation stops future billings immediately, and you will retain access through the end of the current paid billing cycle.
            </li>
            <li>
              <strong>Refund Policy &amp; No Proration:</strong> All subscription fees are non-refundable once billed due to the immediate digital provisioning of proprietary deal underwriting tools, contract generation templates, and enriched real estate data feeds. Revzenta does not issue prorated refunds, account credits, or cash reimbursements for unused time or partial months.
            </li>
            <li>
              <strong>Billing Dispute Window:</strong> Any suspected billing errors or duplicate charges must be submitted in writing to <code>billing@revzenta.com</code> within thirty (30) calendar days of the charge date to be eligible for review.
            </li>
            <li>
              <strong>Data Retention Window:</strong> Upon cancellation or expiration, your workspace enters a 30-day retention status allowing you to export your data. After 30 days, workspace records are permanently purged from production servers.
            </li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            5. Acceptable Use Policy &amp; Telephony Restrictions
          </h2>
          <p>You agree NOT to use Revzenta CRM to:</p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>Violate the Telephone Consumer Protection Act (TCPA), the FTC Telemarketing Sales Rule (TSR), or National Do Not Call (DNC) Registry requirements.</li>
            <li>Transmit unsolicited commercial electronic messages (spam) in violation of the CAN-SPAM Act.</li>
            <li>Conduct unauthorized automated scraping or reverse-engineering of Revzenta APIs or third-party listing portals.</li>
            <li>Store or transmit malicious code, trojans, or unauthorized surveillance scripts.</li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            6. Limitation of Liability &amp; Disclaimers
          </h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, REVZENTA LLC AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA LOSS, LOSS OF REAL ESTATE ASSIGNMENT FEES, OR REGULATORY FINES ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE. REVZENTA’S TOTAL AGGREGATE LIABILITY UNDER THESE TERMS SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO REVZENTA IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            7. Governing Law &amp; Dispute Resolution
          </h2>
          <p>
            These Terms shall be governed by and construed under the laws of the State of Delaware, without regard to its conflict of law principles. Any dispute, claim, or controversy arising out of or relating to these Terms shall be resolved by binding individual arbitration conducted under the rules of the American Arbitration Association (AAA).
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            8. Contact Information
          </h2>
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "8px",
              backgroundColor: "var(--rw-surface)",
              border: "1px solid var(--rw-border)",
              marginTop: "12px",
            }}
          >
            <div><strong>Revzenta LLC — Legal &amp; Contracts Department</strong></div>
            <div style={{ marginTop: "4px" }}>Legal Inquiries: <a href="mailto:legal@revzenta.com" style={{ color: "var(--rw-primary)" }}>legal@revzenta.com</a></div>
            <div>Support: <a href="mailto:support@revzenta.com" style={{ color: "var(--rw-primary)" }}>support@revzenta.com</a></div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--rw-border)", padding: "24px 0", textAlign: "center", fontSize: "13px", color: "var(--rw-text-muted)" }}>
        <div className="rw-container">
          © {new Date().getFullYear()} Revzenta LLC. All rights reserved. · Revzenta Master SaaS Terms of Service
        </div>
      </footer>
    </div>
  );
}
