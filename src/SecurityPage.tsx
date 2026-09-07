import ThemeToggle from "./ThemeToggle";

interface LegalPageProps {
  onBack: () => void;
  onSignIn: () => void;
  onLaunchApp: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
}

export default function SecurityPage({ onBack, onSignIn, onLaunchApp, onNavigatePrivacy, onNavigateTerms }: LegalPageProps) {
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
            <span>🔒</span> Enterprise Data Security &amp; Compliance
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            Security &amp; Data Protection
          </h1>
          <div style={{ fontSize: "14px", color: "var(--rw-text-dim)" }}>
            Revzenta CRM Technical Safeguards, Multi-Tenant Architecture &amp; Privacy Shield
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
            {onNavigateTerms && (
              <button
                type="button"
                onClick={onNavigateTerms}
                style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)", color: "var(--rw-text)", cursor: "pointer" }}
              >
                Terms of Service →
              </button>
            )}
            <span style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, backgroundColor: "var(--rw-primary)", color: "var(--rw-primary-ink)" }}>
              Security &amp; Safeguards
            </span>
          </div>
        </div>

        {/* Security Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "36px" }}>
          <div style={{ padding: "20px", borderRadius: "10px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>🏰</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--rw-text)", marginBottom: "4px" }}>Row-Level Isolation</div>
            <div style={{ fontSize: "13px", color: "var(--rw-text-dim)", lineHeight: 1.5 }}>
              Strict database tenant partitioning (<code>WHERE org_id = ?</code>) enforces 100% boundary isolation across subscriber workspaces.
            </div>
          </div>

          <div style={{ padding: "20px", borderRadius: "10px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔐</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--rw-text)", marginBottom: "4px" }}>In-Transit TLS 1.3</div>
            <div style={{ fontSize: "13px", color: "var(--rw-text-dim)", lineHeight: 1.5 }}>
              All network traffic, API endpoints, webhooks, and e-signatures are encrypted with modern TLS 1.3 and high-entropy session keys.
            </div>
          </div>

          <div style={{ padding: "20px", borderRadius: "10px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>👁️</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--rw-text)", marginBottom: "4px" }}>On-Screen PII Masking</div>
            <div style={{ fontSize: "13px", color: "var(--rw-text-dim)", lineHeight: 1.5 }}>
              One-click global privacy eye toggle blurs seller names, phone numbers, and addresses during video calls or public screen-shares.
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--rw-text-dim)" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            1. Multi-Tenant Architectural Security
          </h2>
          <p>
            Revzenta CRM is engineered around a hardened multi-tenant architecture designed to prevent any cross-organization data leakage or unauthorized access:
          </p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>
              <strong>Deterministic Tenant Scope:</strong> Every database query, mutation, and lookup automatically incorporates the validated cryptographic <code>org_id</code> extracted from the authenticated HTTP session token. No user can ever query or modify data belonging to another workspace.
            </li>
            <li>
              <strong>Owner vs. Tenant Separation:</strong> Platform administrative tools are separated from wholesale tenant environments through distinct permission hierarchies and role-based access control (RBAC).
            </li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            2. Server Hardening &amp; HTTP Security Headers
          </h2>
          <p>
            Revzenta servers inject strict HTTP response headers on 100% of outgoing requests to defend against cross-site scripting (XSS), clickjacking, and mime-sniffing exploits:
          </p>
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: "var(--rw-surface-sunken)",
              border: "1px solid var(--rw-border)",
              fontFamily: "monospace",
              fontSize: "12px",
              color: "var(--rw-text)",
              marginBottom: "16px",
              lineHeight: 1.8,
            }}
          >
            <div>X-Content-Type-Options: nosniff</div>
            <div>X-Frame-Options: SAMEORIGIN</div>
            <div>Referrer-Policy: strict-origin-when-cross-origin</div>
            <div>Permissions-Policy: camera=(), microphone=(), geolocation=()</div>
            <div>X-Robots-Tag: noindex, nofollow</div>
          </div>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            3. Search Engine Exclusion &amp; Privacy Shield
          </h2>
          <p>
            To prevent search engine crawlers (Google, Bing) from indexing private lead records, property valuations, or seller details, Revzenta enforces a <strong>Triple-Layer Search Engine Shield</strong>:
          </p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li><strong>Layer 1 (HTML Header):</strong> Permanent <code>&lt;meta name=&quot;robots&quot; content=&quot;noindex, nofollow&quot; /&gt;</code> tag on application shells.</li>
            <li><strong>Layer 2 (HTTP Headers):</strong> Global <code>X-Robots-Tag: noindex, nofollow</code> emitted on all API endpoints, contracts, and PDFs.</li>
            <li><strong>Layer 3 (Robots Protocol):</strong> Automated <code>/robots.txt</code> service with <code>Disallow: /</code> instruction.</li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            4. Zero Scraping &amp; Authorized Public API Whitelist
          </h2>
          <p>
            Revzenta adheres strictly to authorized real estate data sourcing:
          </p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>
              <strong>No Web Scraping:</strong> The Revzenta backend does not send scraping requests to consumer listing websites (Zillow, Redfin, Realtor.com). Property URLs entered into the system are parsed locally in the browser to extract clean street addresses.
            </li>
            <li>
              <strong>Licensed RentCast Public Records API:</strong> Property specs (beds, baths, square footage, year built, and AVM valuations) are sourced exclusively through licensed public tax assessor and MLS feeds via RentCast.
            </li>
            <li>
              <strong>API Quota Safeguards:</strong> A built-in circuit breaker monitors monthly API call volumes to prevent overages and rate-limit violations.
            </li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            5. Permanent Privacy Suppression Registry
          </h2>
          <p>
            Revzenta features a built-in cryptographic Do-Not-Contact blacklist. When an individual requests deletion under the CCPA or asks to be placed on a Do-Not-Call roster, their contact information is added to the <strong>Permanent Privacy Suppression Registry</strong>. The CRM automatically screens subsequent CSV imports and webhook payloads against this registry to prevent opted-out numbers from ever being re-imported or contacted.
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            6. Vulnerability Reporting &amp; Security Team
          </h2>
          <p>
            Revzenta welcomes reports from security researchers and developers. If you discover a potential vulnerability or security concern, please contact our security team immediately:
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
            <div><strong>Revzenta Security Operations Center</strong></div>
            <div style={{ marginTop: "4px" }}>Security Inquiries: <a href="mailto:security@revzenta.com" style={{ color: "var(--rw-primary)" }}>security@revzenta.com</a></div>
            <div>Response SLA: Within 24 hours for critical security notices</div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--rw-border)", padding: "24px 0", textAlign: "center", fontSize: "13px", color: "var(--rw-text-muted)" }}>
        <div className="rw-container">
          © {new Date().getFullYear()} Revzenta LLC. All rights reserved. · Revzenta Security &amp; Trust Assurance
        </div>
      </footer>
    </div>
  );
}
