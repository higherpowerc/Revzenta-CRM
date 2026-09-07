import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { RentcastUsageInfo, WebhookSettings } from "./types";

export default function Connections({ canEdit = true }: { canEdit?: boolean }) {
  const [webhookSettings, setWebhookSettings] = useState<WebhookSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Webhook state
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testWebhookMsg, setTestWebhookMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // RentCast API state
  const [rentcastKeyDraft, setRentcastKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingRentcast, setSavingRentcast] = useState(false);
  const [rentcastMsg, setRentcastMsg] = useState<string | null>(null);
  const [testingRentcast, setTestingRentcast] = useState(false);
  const [rentcastTestResult, setRentcastTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // RentCast Quota & Hard Stop Guard state
  const [rentcastUsage, setRentcastUsage] = useState<RentcastUsageInfo | null>(null);
  const [monthlyLimitDraft, setMonthlyLimitDraft] = useState<number>(50);
  const [hardStopEnabledDraft, setHardStopEnabledDraft] = useState<boolean>(true);
  const [offsetDraft, setOffsetDraft] = useState<number>(41);
  const [savingGuard, setSavingGuard] = useState<boolean>(false);
  const [guardMsg, setGuardMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const wh = await api.webhookSettings();
      setWebhookSettings(wh);
      setRentcastKeyDraft(wh.rentcastApiKey || "");

      try {
        const usageRes = await api.getRentcastUsage();
        if (usageRes.ok && usageRes.usage) {
          setRentcastUsage(usageRes.usage);
          setMonthlyLimitDraft(usageRes.usage.monthlyLimit);
          setHardStopEnabledDraft(usageRes.usage.hardStopEnabled);
          setOffsetDraft(usageRes.usage.offset);
        }
      } catch (err) {
        console.warn("Failed to load RentCast usage:", err);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load connection settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="main">
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">Connections &amp; APIs</h1>
          <p className="page-sub">
            Connect external lead platforms, MLS property specs, skip-tracing sources, and automation webhooks to your Wholesale CRM.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={load}
            title="Refresh connection status"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: "16px" }}>
          {error}
        </div>
      )}

      <div className="admin-grid" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* 1. Inbound Lead Webhook Card */}
        <div className="card admin-form">
          <div className="admin-card-head">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>⚡</span>
              <div>
                <h2 className="admin-card-title" style={{ margin: 0 }}>Inbound Lead Webhook (POST)</h2>
                <p className="admin-card-sub" style={{ margin: "4px 0 0" }}>
                  Direct real-time webhook endpoint for BatchLeads, Zapier, Make, and web forms. For PropStream, use <strong>Properties &gt; 📥 Import CSV</strong> or relay via Zapier.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "16px" }}>
            <div className="field">
              <span className="field-label" style={{ fontWeight: 600 }}>Your Inbound Webhook URL</span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  readOnly
                  value={webhookSettings?.webhookUrl || (loading ? "Loading..." : "Unavailable")}
                  style={{
                    fontFamily: "monospace",
                    fontSize: "13px",
                    background: "var(--surface-sunken)",
                    flex: "1 1 320px",
                    letterSpacing: "0.2px",
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (webhookSettings?.webhookUrl) {
                      navigator.clipboard.writeText(webhookSettings.webhookUrl);
                      setWebhookCopied(true);
                      setTimeout(() => setWebhookCopied(false), 2500);
                    }
                  }}
                  disabled={!webhookSettings?.webhookUrl}
                >
                  {webhookCopied ? "✓ Copied!" : "📋 Copy URL"}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={async () => {
                      if (!confirm("Regenerate webhook key? Any existing webhook integrations will need the new URL.")) return;
                      try {
                        const res = await api.regenerateWebhookKey();
                        if (res.ok) {
                          setWebhookSettings((prev) => prev ? { ...prev, webhookSecret: res.webhookSecret, webhookUrl: res.webhookUrl } : null);
                        }
                      } catch (e) {
                        alert(e instanceof Error ? e.message : "Failed to rotate key");
                      }
                    }}
                    title="Regenerate Webhook Secret"
                  >
                    🔄 Rotate Key
                  </button>
                )}
              </div>
              <span className="field-hint" style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "6px", display: "block" }}>
                Accepts JSON payloads. Any incoming lead automatically populates property details, seller contact info, and triggers instant auto-enrichment.
              </span>
            </div>

            {/* Test Webhook Action */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  setTestingWebhook(true);
                  setTestWebhookMsg(null);
                  try {
                    const res = await api.testWebhookLead();
                    if (res.ok) {
                      setTestWebhookMsg({
                        ok: true,
                        text: `✓ Test lead created: "${res.client.companyName}". Check your Properties pipeline!`,
                      });
                      const wh = await api.webhookSettings();
                      setWebhookSettings(wh);
                    } else {
                      setTestWebhookMsg({ ok: false, text: "Failed to dispatch test lead" });
                    }
                  } catch (e) {
                    setTestWebhookMsg({ ok: false, text: e instanceof Error ? e.message : "Failed to send test lead" });
                  } finally {
                    setTestingWebhook(false);
                  }
                }}
                disabled={testingWebhook || !canEdit}
              >
                {testingWebhook ? "Sending..." : "⚡ Send Test Inbound Lead"}
              </button>
              {testWebhookMsg && (
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: testWebhookMsg.ok ? "var(--primary, #10b981)" : "#ef4444",
                  }}
                >
                  {testWebhookMsg.text}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. RentCast MLS Specs & Comps API */}
        <div className="card admin-form">
          <div className="admin-card-head">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>🏠</span>
              <div>
                <h2 className="admin-card-title" style={{ margin: 0 }}>RentCast API (Live MLS Specs, Tax Valuations &amp; Comps)</h2>
                <p className="admin-card-sub" style={{ margin: "4px 0 0" }}>
                  Connects property cards and the Deal Calculator directly to live nationwide county tax assessors and recent comparable sales.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
            <div className="field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span className="field-label" style={{ fontWeight: 600, margin: 0 }}>
                  RentCast API Key
                </span>
                {rentcastKeyDraft.trim() ? (
                  <span className="chip" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", fontSize: "11px", padding: "3px 10px", borderRadius: "12px", fontWeight: 600 }}>
                    ● Key Stored
                  </span>
                ) : (
                  <span className="chip" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)", fontSize: "11px", padding: "3px 10px", borderRadius: "12px", fontWeight: 600 }}>
                    ○ Unconfigured
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type={showKey ? "text" : "password"}
                  value={rentcastKeyDraft}
                  onChange={(e) => {
                    setRentcastKeyDraft(e.target.value);
                    setRentcastTestResult(null);
                  }}
                  placeholder="Paste RentCast API key (e.g. 5a1b2c3d...)"
                  style={{ fontFamily: "monospace", flex: "1 1 260px" }}
                  disabled={!canEdit}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? "🙈 Hide" : "👁️ Show"}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      setSavingRentcast(true);
                      setRentcastMsg(null);
                      try {
                        const res = await api.saveRentcastKey(rentcastKeyDraft);
                        if (res.ok) {
                          setRentcastMsg("Saved!");
                          setTimeout(() => setRentcastMsg(null), 3000);
                        }
                      } catch (e) {
                        setRentcastMsg(e instanceof Error ? e.message : "Save failed");
                      } finally {
                        setSavingRentcast(false);
                      }
                    }}
                    disabled={savingRentcast}
                  >
                    {savingRentcast ? "Saving..." : rentcastMsg || "Save Key"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    setTestingRentcast(true);
                    setRentcastTestResult(null);
                    try {
                      const res = await api.testRentcastKey(rentcastKeyDraft);
                      if (res.ok) {
                        setRentcastTestResult({
                          ok: true,
                          msg: res.message || "✓ RentCast API connected successfully! Live MLS & tax records verified.",
                        });
                      } else {
                        setRentcastTestResult({
                          ok: false,
                          msg: res.error || "Connection failed. Please verify your API key.",
                        });
                      }
                    } catch (e) {
                      setRentcastTestResult({
                        ok: false,
                        msg: e instanceof Error ? e.message : "Test failed",
                      });
                    } finally {
                      setTestingRentcast(false);
                    }
                  }}
                  disabled={testingRentcast || !rentcastKeyDraft.trim()}
                >
                  {testingRentcast ? "Testing..." : "⚡ Test Key"}
                </button>
              </div>

              {rentcastTestResult && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    background: rentcastTestResult.ok ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    color: rentcastTestResult.ok ? "#10b981" : "#ef4444",
                    border: `1px solid ${rentcastTestResult.ok ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    fontWeight: 500,
                  }}
                >
                  {rentcastTestResult.msg}
                </div>
              )}

              <span className="field-hint" style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "8px", display: "block" }}>
                Get a free API key at{" "}
                <a href="https://rentcast.io/api" target="_blank" rel="noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>
                  rentcast.io/api
                </a>{" "}
                (includes 50 free property &amp; comp lookups every month). Power up instant ARV estimates, property square footage, and tax comps on all deals.
              </span>
            </div>

            {/* RentCast Quota & Hard Stop Guard Control Panel */}
            <div
              style={{
                marginTop: "20px",
                padding: "18px 20px",
                borderRadius: "10px",
                background: "var(--panel-2, #1f2029)",
                border: "1px solid var(--border, #30363d)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>🛡️</span> RentCast Usage &amp; Hard Stop Guard
                  </h4>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted, #94a3b8)" }}>
                    Automatically monitor API consumption and block outbound calls before exceeding your plan limit.
                  </p>
                </div>
                {rentcastUsage?.hardStopEnabled ? (
                  <span className="chip" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", fontSize: "11px", fontWeight: 700 }}>
                    ● Hard Stop Guard Active
                  </span>
                ) : (
                  <span className="chip" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)", fontSize: "11px", fontWeight: 700 }}>
                    ○ Hard Stop Disabled
                  </span>
                )}
              </div>

              {/* Progress Gauge */}
              {rentcastUsage && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px", marginBottom: "6px" }}>
                    <span>
                      Monthly Usage: <strong style={{ color: rentcastUsage.callsThisMonth >= rentcastUsage.monthlyLimit ? "#ef4444" : rentcastUsage.callsThisMonth >= rentcastUsage.monthlyLimit * 0.8 ? "#f59e0b" : "var(--ink, #f8fafc)" }}>{rentcastUsage.callsThisMonth} / {rentcastUsage.monthlyLimit} calls</strong>
                    </span>
                    <span style={{ color: "var(--muted, #94a3b8)" }}>
                      {rentcastUsage.remainingCalls} call{rentcastUsage.remainingCalls === 1 ? "" : "s"} remaining
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "8px", borderRadius: "4px", background: "var(--border, #30363d)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.round((rentcastUsage.callsThisMonth / Math.max(1, rentcastUsage.monthlyLimit)) * 100))}%`,
                        height: "100%",
                        background:
                          rentcastUsage.callsThisMonth >= rentcastUsage.monthlyLimit
                            ? "#ef4444"
                            : rentcastUsage.callsThisMonth >= rentcastUsage.monthlyLimit * 0.8
                            ? "#f59e0b"
                            : "#10b981",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  {rentcastUsage.cachedQueriesThisMonth > 0 && (
                    <div style={{ fontSize: "11.5px", color: "#34d399", marginTop: "6px" }}>
                      ⚡ {rentcastUsage.cachedQueriesThisMonth} lookups served from local cache with <strong>0 API calls consumed</strong>.
                    </div>
                  )}
                </div>
              )}

              {/* Guard Settings Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", alignItems: "flex-end" }}>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                    Monthly Plan Limit
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={monthlyLimitDraft}
                    onChange={(e) => setMonthlyLimitDraft(Math.max(1, Number(e.target.value) || 1))}
                    style={{ height: "36px", fontSize: "13px" }}
                    disabled={!canEdit}
                  />
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                    Current Usage / Baseline
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={offsetDraft}
                    onChange={(e) => setOffsetDraft(Math.max(0, Number(e.target.value) || 0))}
                    style={{ height: "36px", fontSize: "13px" }}
                    disabled={!canEdit}
                    title="Set to match your current RentCast dashboard counter"
                  />
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12.5px", fontWeight: 600, height: "36px" }}>
                    <input
                      type="checkbox"
                      checked={hardStopEnabledDraft}
                      onChange={(e) => setHardStopEnabledDraft(e.target.checked)}
                      disabled={!canEdit}
                      style={{ width: "16px", height: "16px", accentColor: "#10b981" }}
                    />
                    <span>Enable Hard Stop Guard</span>
                  </label>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ height: "36px", fontSize: "13px" }}
                    disabled={savingGuard}
                    onClick={async () => {
                      setSavingGuard(true);
                      setGuardMsg(null);
                      try {
                        const res = await api.saveRentcastGuard({
                          monthlyLimit: monthlyLimitDraft,
                          hardStopEnabled: hardStopEnabledDraft,
                          offset: offsetDraft,
                        });
                        if (res.ok && res.usage) {
                          setRentcastUsage(res.usage);
                          setGuardMsg("Guard settings saved!");
                          setTimeout(() => setGuardMsg(null), 3000);
                        }
                      } catch (err: any) {
                        setGuardMsg(err?.message || "Failed to save guard settings.");
                      } finally {
                        setSavingGuard(false);
                      }
                    }}
                  >
                    {savingGuard ? "Saving..." : guardMsg || "Save Guard Settings"}
                  </button>
                )}
              </div>
            </div>

            {/* Security Notice: Authorized URL Whitelist */}
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                borderRadius: "8px",
                background: "rgba(56, 189, 248, 0.08)",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "18px", lineHeight: 1 }}>🔒</span>
              <div style={{ fontSize: "12px", color: "var(--ink, #f8fafc)", lineHeight: "1.45" }}>
                <strong>Authorized Real Estate URL Whitelist Active:</strong> For security and data integrity, your CRM strictly permits listing links from <strong>Zillow, Redfin, Realtor.com, Trulia, and Homes.com</strong> (or clean physical addresses). Arbitrary web links, malicious URLs, and internal IP addresses are blocked at the firewall.
              </div>
            </div>
          </div>
        </div>

        {/* 3. Inbound Webhook Activity Logs */}
        <div className="card admin-table">
          <div className="admin-card-head">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="admin-card-title">Recent Inbound Webhook Deliveries</h2>
                <p className="admin-card-sub">
                  Live audit log of payloads received by your CRM endpoint.
                </p>
              </div>
              <span className="badge" style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)" }}>
                {webhookSettings?.recentLogs?.length || 0} Events
              </span>
            </div>
          </div>

          {(!webhookSettings?.recentLogs || webhookSettings.recentLogs.length === 0) ? (
            <div style={{ padding: "28px", textAlign: "center", color: "var(--text-dim)", fontSize: "13px" }}>
              <p style={{ margin: 0 }}>No inbound webhook events logged yet.</p>
              <p style={{ margin: "6px 0 0", fontSize: "12px" }}>
                Click <strong>"⚡ Send Test Inbound Lead"</strong> above or configure your external marketing funnel.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse", textAlign: "center" }}>
                <thead>
                  <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Status</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Source</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Property Lead ID</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookSettings.recentLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <span
                          style={{
                            color: log.status === "success" ? "#10b981" : "#ef4444",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                          }}
                        >
                          {log.status === "success" ? "✓ Received" : "✕ Error"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", textTransform: "capitalize", fontWeight: 500, textAlign: "center" }}>
                        {log.source}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        {log.clientId ? (
                          <span style={{ fontFamily: "monospace", color: "var(--primary)" }}>
                            #{log.clientId}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-dim)" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px", color: "var(--text-dim)", textAlign: "center" }}>
                        {log.createdAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. Supported Integration Guides Card */}
        <div className="card admin-form">
          <div className="admin-card-head">
            <h2 className="admin-card-title">Supported Lead Channels &amp; Setup Guides</h2>
            <p className="admin-card-sub">
              Quick integration blueprints for your wholesale lead sources.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "14px",
              marginTop: "12px",
            }}
          >
            <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", background: "var(--surface-sunken)" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>📊 PropStream (CSV &amp; Zapier Sync)</div>
              <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
                <em>Note:</em> PropStream does not provide a direct outbound webhook builder in standard accounts.
              </p>
              <ul style={{ fontSize: "12px", color: "var(--text-dim)", margin: "8px 0 0 0", paddingLeft: "18px", lineHeight: 1.5 }}>
                <li><strong>Recommended:</strong> Export your filtered / skip-traced list as <code>.csv</code> from PropStream, then open <strong>Properties &gt; 📥 Import CSV</strong> in Revzenta. All columns (Address, Owner, Est. Value, Beds, Baths) auto-map instantly.</li>
                <li><strong>Automated:</strong> Relay PropStream list alerts through Zapier or Google Sheets to POST into your Revzenta Webhook URL.</li>
              </ul>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", background: "var(--surface-sunken)" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>⚡ BatchLeads (Direct Webhooks)</div>
              <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
                BatchLeads supports native outbound webhooks. Go to <strong>Integrations &gt; Webhooks</strong> inside BatchLeads, add a new webhook, and paste your Revzenta Webhook URL to stream new motivated leads automatically.
              </p>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", background: "var(--surface-sunken)" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>🎯 Zapier &amp; Make.com</div>
              <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
                Use a Webhook "POST" action pointing to your CRM Webhook URL. Map fields like <code>address</code>, <code>asking_price</code>, <code>seller_name</code>, and <code>phone</code>.
              </p>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", background: "var(--surface-sunken)" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>🌐 Custom Website Forms</div>
              <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
                Point motivated seller landing page forms (Carrot, Webflow, WordPress, Carrd) straight to this endpoint for instant lead creation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
