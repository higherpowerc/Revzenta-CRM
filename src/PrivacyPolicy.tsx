import ThemeToggle from "./ThemeToggle";

interface LegalPageProps {
  onBack: () => void;
  onSignIn: () => void;
  onLaunchApp: () => void;
  onNavigateTerms?: () => void;
  onNavigateSecurity?: () => void;
}

export default function PrivacyPolicy({ onBack, onSignIn, onLaunchApp, onNavigateTerms, onNavigateSecurity }: LegalPageProps) {
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
            <span>📜</span> Revzenta Trust &amp; Privacy Center
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            Privacy Policy
          </h1>
          <div style={{ fontSize: "14px", color: "var(--rw-text-dim)" }}>
            Effective Date: <strong>September 7, 2026</strong> · Last Reviewed: September 2026
          </div>

          {/* Quick Legal Nav Tabs */}
          <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
            <span style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, backgroundColor: "var(--rw-primary)", color: "var(--rw-primary-ink)" }}>
              Privacy Policy
            </span>
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

        {/* Executive Guarantee Card */}
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
            🛡️ Revzenta Non-Sale of Data Pledge
          </div>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--rw-text-dim)", lineHeight: 1.6 }}>
            Revzenta CRM operates solely as an enterprise software provider. <strong>We do not sell, rent, commercialize, broker, or monetize your lead lists, seller contact records, buyer buy boxes, or property notes under any circumstances.</strong> Your proprietary real estate data belongs exclusively to your account.
          </p>
        </div>

        {/* Content Body */}
        <div style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--rw-text-dim)" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            1. Overview &amp; SaaS Data Processing Relationship
          </h2>
          <p>
            This Privacy Policy explains how Revzenta LLC (&quot;Revzenta&quot;, &quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, processes, and safeguards information when you visit our website or subscribe to our cloud-based real estate customer relationship management software (&quot;Revzenta CRM&quot;).
          </p>
          <p>
            Under applicable data privacy regulations (including the California Consumer Privacy Act as amended by the CPRA):
          </p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>
              <strong>Revzenta as Data Processor:</strong> With respect to homeowner leads, seller contacts, buyer rosters, offers, and transaction data entered or uploaded by you (&quot;Subscriber Data&quot;), Revzenta acts strictly as a <strong>Data Processor</strong> (Service Provider).
            </li>
            <li>
              <strong>Subscriber as Data Controller:</strong> The subscribing business, wholesaler, or investor acts as the <strong>Data Controller</strong>, retaining full legal ownership and responsibility for lawful acquisition, cold outreach consent, and opt-out fulfillment.
            </li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            2. Information We Collect
          </h2>
          <p>We collect information in three distinct categories:</p>
          <h3 style={{ fontSize: "17px", fontWeight: 600, color: "var(--rw-text)", marginTop: "18px", marginBottom: "8px" }}>
            A. Account &amp; Billing Information
          </h3>
          <p>
            When you register for an account, subscribe to a tier, or communicate with our support team, we collect your name, business name, email address, phone number, and billing details. All financial transactions and payment cards are tokenized and processed securely through <strong>Stripe, Inc.</strong>; Revzenta never stores raw credit card numbers or banking credentials.
          </p>
          <h3 style={{ fontSize: "17px", fontWeight: 600, color: "var(--rw-text)", marginTop: "18px", marginBottom: "8px" }}>
            B. Customer-Uploaded Subscriber Data (Wholesale CRM Records)
          </h3>
          <p>
            When utilizing Revzenta CRM, you may import property lists (via PropStream CSV imports, BatchLeads webhooks, or manual entry), including parcel addresses, owner names, phone numbers, and deal terms. This information is stored in tenant-isolated database partitions accessible only by authorized users of your organization.
          </p>
          <h3 style={{ fontSize: "17px", fontWeight: 600, color: "var(--rw-text)", marginTop: "18px", marginBottom: "8px" }}>
            C. Licensed Public Records &amp; MLS Enrichment Data
          </h3>
          <p>
            To provide automated property underwriting, Revzenta queries licensed third-party data providers (including <strong>RentCast API</strong>) using public county assessor, tax record, and MLS aggregations. Revzenta does <strong>not</strong> scrape or access unauthorized private portals.
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            3. How We Use Information
          </h2>
          <p>We use collected data solely to:</p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>Provide, maintain, host, and optimize the Revzenta CRM features (pipeline tracking, deal calculator, LOI contract generation, and escrow management).</li>
            <li>Process monthly SaaS subscription billings and deliver account transaction receipts.</li>
            <li>Enforce security controls, session authentication, and row-level tenant data isolation.</li>
            <li>Comply with statutory legal obligations, subpoenas, and fraud prevention protocols.</li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            4. California Consumer Privacy Act (CCPA / CPRA) &amp; Consumer Rights
          </h2>
          <p>
            Consumers and property owners residing in California and other jurisdictions have specific statutory rights regarding personal data:
          </p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li><strong>Right to Know:</strong> The right to request disclosure of personal information processed by the software.</li>
            <li><strong>Right to Delete (&quot;Right to be Forgotten&quot;):</strong> The right to request the permanent deletion of personal records.</li>
            <li><strong>Right to Non-Discrimination:</strong> We will never discriminate against any user or consumer exercising statutory privacy rights.</li>
          </ul>
          <p>
            <strong>Interactive CCPA Purge &amp; Permanent Suppression:</strong> Inside Revzenta CRM under <code>Settings &gt; Compliance &amp; DNC</code>, subscribers have direct access to our one-click CCPA Purge tool. When a contact is purged, their personal records are permanently erased, and their contact hash is recorded in the <strong>Permanent Privacy Suppression Registry</strong> to prevent accidental re-imports from future CSV files.
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            5. TCPA, Do Not Call (DNC) &amp; Telemarketing Compliance
          </h2>
          <p>
            Subscribers are solely responsible for ensuring that their outreach practices comply with the Telephone Consumer Protection Act (47 U.S.C. § 227), TSR regulations, and state mini-TCPA statutes. Users must obtain required express consents before transmitting autodialed calls or text messages and must promptly honor all verbal or written opt-out requests.
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            6. Data Retention &amp; Account Cancellation
          </h2>
          <p>
            Active subscriber data is retained for the duration of the subscription agreement. Upon account cancellation or non-payment, accounts enter a <strong>30-day grace retention window</strong> allowing subscribers to export their data. Following the 30-day window, all tenant data is permanently dropped via our automated database cascade deletion protocols.
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            7. Contact Information
          </h2>
          <p>
            For questions regarding this Privacy Policy, CCPA data requests, or compliance inquiries, please contact our designated privacy team:
          </p>
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "8px",
              backgroundColor: "var(--rw-surface)",
              border: "1px solid var(--rw-border)",
              marginTop: "12px",
            }}
          >
            <div><strong>Revzenta LLC — Privacy &amp; Data Protection Office</strong></div>
            <div style={{ marginTop: "4px" }}>Email: <a href="mailto:privacy@revzenta.com" style={{ color: "var(--rw-primary)" }}>privacy@revzenta.com</a></div>
            <div>Support: <a href="mailto:support@revzenta.com" style={{ color: "var(--rw-primary)" }}>support@revzenta.com</a></div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--rw-border)", padding: "24px 0", textAlign: "center", fontSize: "13px", color: "var(--rw-text-muted)" }}>
        <div className="rw-container">
          © {new Date().getFullYear()} Revzenta LLC. All rights reserved. · Revzenta CRM Privacy &amp; Compliance Hub
        </div>
      </footer>
    </div>
  );
}
