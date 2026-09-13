import ThemeToggle from "./ThemeToggle";

interface LegalPageProps {
  onBack: () => void;
  onSignIn: () => void;
  onLaunchApp: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
  onNavigateSecurity?: () => void;
  onNavigateSla?: () => void;
}

export default function CookiePolicy({
  onBack,
  onSignIn,
  onLaunchApp,
  onNavigatePrivacy,
  onNavigateTerms,
  onNavigateSecurity,
  onNavigateSla,
}: LegalPageProps) {
  return (
    <div className="rw-page" style={{ minHeight: "100vh", backgroundColor: "var(--rw-bg)", color: "var(--rw-text)" }}>
      {/* Top Navigation Bar */}
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

      {/* Main Legal Container */}
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
            <span>🍪</span> Transparency &amp; Cookie Consent
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            Cookie Policy
          </h1>
          <div style={{ fontSize: "14px", color: "var(--rw-text-dim)" }}>
            Effective Date: <strong>September 13, 2026</strong> · Global Compliance Center
          </div>

          {/* Quick Legal Nav Tabs */}
          <div style={{ display: "flex", gap: "10px", marginTop: "18px", flexWrap: "wrap" }}>
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
                Security →
              </button>
            )}
            {onNavigateSla && (
              <button
                type="button"
                onClick={onNavigateSla}
                style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)", color: "var(--rw-text)", cursor: "pointer" }}
              >
                SLA (99.9%) →
              </button>
            )}
            <span style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, backgroundColor: "var(--rw-primary)", color: "var(--rw-primary-ink)" }}>
              Cookie Policy
            </span>
          </div>
        </div>

        {/* Highlight Guarantee */}
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
            🛡️ Zero Third-Party Advertising Trackers Pledge
          </div>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--rw-text-dim)", lineHeight: 1.6 }}>
            Revzenta operates strictly as a secure B2B SaaS platform. <strong>We do not deploy third-party advertising pixels, behavioral ad tracking cookies (like Meta Pixel or Google Ads retargeting), or sell browsing telemetry.</strong> The cookies and local storage tokens we use are strictly required to operate your workspace, authenticate your sessions, and preserve your UI preferences.
          </p>
        </div>

        {/* Content Body */}
        <div style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--rw-text-dim)" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            1. What Are Cookies &amp; Local Storage?
          </h2>
          <p>
            Cookies are compact text files stored on your computer or mobile device when you visit web applications. In modern web applications, client-side storage technologies such as <code>localStorage</code> and <code>sessionStorage</code> are also utilized to maintain state across page transitions.
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            2. Categories of Cookies We Use
          </h2>

          <div style={{ display: "grid", gap: "16px", marginTop: "16px", marginBottom: "24px" }}>
            <div style={{ padding: "18px 20px", borderRadius: "8px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
              <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--rw-primary)", marginBottom: "4px" }}>
                A. Strictly Necessary &amp; Security Cookies (Essential)
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--rw-text-dim)", lineHeight: 1.5 }}>
                These are mandatory for the application to function. They authenticate your signed-in user session, enforce multi-tenant account isolation, protect against Cross-Site Request Forgery (CSRF), and prevent unauthorized access.
              </p>
              <table style={{ width: "100%", marginTop: "12px", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rw-border)", color: "var(--rw-text)" }}>
                    <th style={{ padding: "6px 0" }}>Identifier</th>
                    <th style={{ padding: "6px 0" }}>Type</th>
                    <th style={{ padding: "6px 0" }}>Purpose &amp; Retention</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid var(--rw-border)" }}>
                    <td style={{ padding: "6px 0", fontFamily: "monospace" }}>token / crm_session</td>
                    <td style={{ padding: "6px 0" }}>Cookie / Storage</td>
                    <td style={{ padding: "6px 0" }}>Cryptographic session token for account authentication (30 days or until sign out).</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 0", fontFamily: "monospace" }}>crm:pii-hidden</td>
                    <td style={{ padding: "6px 0" }}>localStorage</td>
                    <td style={{ padding: "6px 0" }}>Saves your privacy-eye toggle state to blur sensitive homeowner PII during screen-shares.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ padding: "18px 20px", borderRadius: "8px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
              <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--rw-text)", marginBottom: "4px" }}>
                B. Functional &amp; User Preference Cookies
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--rw-text-dim)", lineHeight: 1.5 }}>
                These remember your preferred workspace configurations so you do not have to reconfigure them each time you visit:
              </p>
              <ul style={{ margin: "8px 0 0", paddingLeft: "20px", fontSize: "13px" }}>
                <li><code>theme</code>: Remembers your selection between Dark Mode and Light Mode.</li>
                <li><code>crm:money-hidden</code>: Remembers whether pipeline financial figures are blurred on the Executive Dashboard.</li>
                <li><code>crm:cookie-consent</code>: Stores your cookie preference choices to avoid repeating the consent banner.</li>
              </ul>
            </div>

            <div style={{ padding: "18px 20px", borderRadius: "8px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
              <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--rw-text)", marginBottom: "4px" }}>
                C. Payment &amp; Fraud Prevention (Stripe, Inc.)
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--rw-text-dim)", lineHeight: 1.5 }}>
                When completing subscription checkouts or updating payment methods, Stripe sets necessary security tokens (such as <code>__stripe_mid</code> and <code>__stripe_sid</code>) solely for fraud detection, payment risk scoring, and SCA (Strong Customer Authentication) compliance.
              </p>
            </div>
          </div>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            3. How to Control and Manage Cookies
          </h2>
          <p>
            You have full control over the cookies saved on your device:
          </p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>
              <strong>Browser Settings:</strong> You can configure your browser (Chrome, Safari, Edge, Firefox) to block or alert you about cookies. Please note that blocking essential session cookies will prevent you from signing in to Revzenta CRM.
            </li>
            <li>
              <strong>Local Storage Clearing:</strong> You can clear your browser&apos;s site data or cache at any time to reset all preferences.
            </li>
            <li>
              <strong>Consent Banner:</strong> You can update your consent settings at any time using our on-page cookie preferences button.
            </li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            4. Updates to This Policy
          </h2>
          <p>
            We may periodically revise this Cookie Policy to reflect new regulatory requirements or changes in our software infrastructure. Any modifications will be posted here with an updated effective date.
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            5. Contact Us
          </h2>
          <p>
            If you have any questions regarding our use of cookies or data privacy practices, please reach out to our privacy office:
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
            <div><strong>Revzenta LLC — Privacy &amp; Data Compliance</strong></div>
            <div style={{ marginTop: "4px" }}>Email: <a href="mailto:privacy@revzenta.com" style={{ color: "var(--rw-primary)" }}>privacy@revzenta.com</a></div>
            <div>Support: <a href="mailto:support@revzenta.com" style={{ color: "var(--rw-primary)" }}>support@revzenta.com</a></div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--rw-border)", padding: "24px 0", textAlign: "center", fontSize: "13px", color: "var(--rw-text-muted)" }}>
        <div className="rw-container">
          © {new Date().getFullYear()} Revzenta LLC. All rights reserved. · Revzenta Cookie &amp; Data Privacy Center
        </div>
      </footer>
    </div>
  );
}
