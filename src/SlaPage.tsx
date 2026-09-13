import ThemeToggle from "./ThemeToggle";

interface LegalPageProps {
  onBack: () => void;
  onSignIn: () => void;
  onLaunchApp: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
  onNavigateSecurity?: () => void;
  onNavigateCookies?: () => void;
}

export default function SlaPage({
  onBack,
  onSignIn,
  onLaunchApp,
  onNavigatePrivacy,
  onNavigateTerms,
  onNavigateSecurity,
  onNavigateCookies,
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
            <span>⚡</span> High-Availability Enterprise Guarantee
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            Service Level Agreement (SLA)
          </h1>
          <div style={{ fontSize: "14px", color: "var(--rw-text-dim)" }}>
            99.9% Monthly Uptime Commitment · Financial Service Credits · Real-Time Redundancy
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
            {onNavigateCookies && (
              <button
                type="button"
                onClick={onNavigateCookies}
                style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)", color: "var(--rw-text)", cursor: "pointer" }}
              >
                Cookie Policy →
              </button>
            )}
            <span style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, backgroundColor: "var(--rw-primary)", color: "var(--rw-primary-ink)" }}>
              SLA (99.9%)
            </span>
          </div>
        </div>

        {/* SLA Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "36px" }}>
          <div style={{ padding: "20px", borderRadius: "10px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏱️</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--rw-text)", marginBottom: "4px" }}>99.9% Uptime Target</div>
            <div style={{ fontSize: "13px", color: "var(--rw-text-dim)", lineHeight: 1.5 }}>
              Guaranteed operational availability across Core API, Deal Engine, and Lead Webhooks every calendar month.
            </div>
          </div>

          <div style={{ padding: "20px", borderRadius: "10px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>💳</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--rw-text)", marginBottom: "4px" }}>Automatic Service Credits</div>
            <div style={{ fontSize: "13px", color: "var(--rw-text-dim)", lineHeight: 1.5 }}>
              Tiered subscription bill credits ranging from 10% to 50% if availability ever drops below our commitment.
            </div>
          </div>

          <div style={{ padding: "20px", borderRadius: "10px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>🚨</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--rw-text)", marginBottom: "4px" }}>15-Min Critical Response</div>
            <div style={{ fontSize: "13px", color: "var(--rw-text-dim)", lineHeight: 1.5 }}>
              24/7 proactive monitoring with rapid incident triage for any high-severity production impairment.
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--rw-text-dim)" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            1. Scope &amp; Commitment
          </h2>
          <p>
            This Service Level Agreement (&quot;SLA&quot;) governs the availability and performance of Revzenta CRM (&quot;Service&quot;) provided by Revzenta LLC to subscribing wholesale organizations. We commit to providing at least <strong>99.9% Monthly Uptime Percentage</strong> for all production environments.
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            2. Service Level Credit Schedule
          </h2>
          <p>
            If Revzenta fails to meet the 99.9% Monthly Uptime Commitment in any billing cycle, eligible customers are entitled to receive a Service Credit applied against their subsequent monthly subscription charge according to the following schedule:
          </p>

          <div style={{ overflowX: "auto", margin: "16px 0 24px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", backgroundColor: "var(--rw-surface)", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--rw-border)" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid var(--rw-border)", color: "var(--rw-text)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                  <th style={{ padding: "12px 16px" }}>Monthly Uptime Percentage</th>
                  <th style={{ padding: "12px 16px" }}>Service Credit Percentage</th>
                  <th style={{ padding: "12px 16px" }}>Monthly Downtime Equivalent</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--rw-border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--rw-text)" }}>99.0% – 99.89%</td>
                  <td style={{ padding: "12px 16px", color: "var(--rw-primary)", fontWeight: 700 }}>10% Credit</td>
                  <td style={{ padding: "12px 16px" }}>~43 minutes – 7.2 hours</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--rw-border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--rw-text)" }}>95.0% – 98.99%</td>
                  <td style={{ padding: "12px 16px", color: "var(--rw-primary)", fontWeight: 700 }}>25% Credit</td>
                  <td style={{ padding: "12px 16px" }}>~7.2 hours – 36 hours</td>
                </tr>
                <tr>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--rw-text)" }}>&lt; 95.0%</td>
                  <td style={{ padding: "12px 16px", color: "#ef4444", fontWeight: 700 }}>50% Credit</td>
                  <td style={{ padding: "12px 16px" }}>&gt; 36 hours</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            3. Scheduled Maintenance &amp; Exclusions
          </h2>
          <p>
            The Monthly Uptime Percentage calculation excludes downtime resulting from:
          </p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li>
              <strong>Scheduled Maintenance:</strong> Routine infrastructure patching, zero-downtime database upgrades, or security enhancements conducted during scheduled maintenance windows. Revzenta will provide at least <strong>48 hours advance notice</strong> for any anticipated downtime, scheduled during low-volume weekend hours (typically 1:00 AM – 4:00 AM EST).
            </li>
            <li>
              <strong>Force Majeure:</strong> Events beyond Revzenta&apos;s reasonable control, including natural disasters, acts of war, global internet backbone fiber cuts, or regional utility outages.
            </li>
            <li>
              <strong>Customer Misconfiguration:</strong> Network blocks, firewall denials, or invalid webhook credentials configured by the subscriber.
            </li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            4. Incident Severity Levels &amp; Target Response Times
          </h2>
          <div style={{ display: "grid", gap: "12px", margin: "16px 0" }}>
            <div style={{ padding: "14px 18px", borderRadius: "8px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <strong style={{ color: "#ef4444" }}>Severity 1 (Critical Outage)</strong>
                <span className="badge tone-red" style={{ fontSize: "11px", fontWeight: 700 }}>Response: &lt; 15 Minutes</span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--rw-text-dim)" }}>
                Total system unavailability, catastrophic database failure, or inability of all users to sign in. Engineering team triages 24/7 with continuous updates every 30 minutes until resolved.
              </p>
            </div>

            <div style={{ padding: "14px 18px", borderRadius: "8px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <strong style={{ color: "#f59e0b" }}>Severity 2 (Major Impairment)</strong>
                <span className="badge tone-amber" style={{ fontSize: "11px", fontWeight: 700 }}>Response: &lt; 1 Hour</span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--rw-text-dim)" }}>
                Core feature severely impaired (e.g. contract PDF generation or automated property underwriting degraded), but core CRM navigation remains functional.
              </p>
            </div>

            <div style={{ padding: "14px 18px", borderRadius: "8px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <strong style={{ color: "var(--rw-text)" }}>Severity 3 (Minor Inquiry / General)</strong>
                <span className="badge tone-blue" style={{ fontSize: "11px", fontWeight: 700 }}>Response: &lt; 4 Hours</span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--rw-text-dim)" }}>
                General workflow questions, minor cosmetic anomalies, or feature requests.
              </p>
            </div>
          </div>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            5. Backup &amp; Disaster Recovery
          </h2>
          <p>
            Revzenta maintains enterprise-grade disaster recovery procedures:
          </p>
          <ul style={{ paddingLeft: "24px", marginBottom: "16px" }}>
            <li><strong>Automated Hourly Snapshots:</strong> Transactional database state is backed up continuously with point-in-time recovery capabilities.</li>
            <li><strong>Multi-Region Cold Standbys:</strong> Off-site backup archives are replicated across isolated geographical cloud availability zones.</li>
            <li><strong>Recovery Time Objective (RTO):</strong> Target full system restoration under disaster recovery scenarios within 2 hours.</li>
            <li><strong>Recovery Point Objective (RPO):</strong> Maximum data loss threshold capped at 15 minutes.</li>
          </ul>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--rw-text)", marginTop: "32px", marginBottom: "12px" }}>
            6. Credit Claim Process
          </h2>
          <p>
            To request a Service Credit, subscribers should submit a ticket through the Revzenta Support Cockpit or email <a href="mailto:support@revzenta.com" style={{ color: "var(--rw-primary)" }}>support@revzenta.com</a> within thirty (30) days of the affected calendar month. Verified credits will be credited directly to your Stripe billing account on the next invoice cycle.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--rw-border)", padding: "24px 0", textAlign: "center", fontSize: "13px", color: "var(--rw-text-muted)" }}>
        <div className="rw-container">
          © {new Date().getFullYear()} Revzenta LLC. All rights reserved. · Service Level Agreement &amp; High-Availability Trust Center
        </div>
      </footer>
    </div>
  );
}
