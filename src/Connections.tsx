import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { WebhookSettings } from "./types";

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

  const load = useCallback(async () => {
    try {
      const wh = await api.webhookSettings();
      setWebhookSettings(wh);
      setRentcastKeyDraft(wh.rentcastApiKey || "");
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
                  Automatically stream leads from PropStream, BatchLeads, Zapier, Make, or custom web forms directly into your CRM.
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
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>🎯 Zapier / Make.com</div>
              <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
                Use a Webhook "POST" action pointing to your CRM Webhook URL. Map fields like <code>address</code>, <code>asking_price</code>, and <code>seller_name</code>.
              </p>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", background: "var(--surface-sunken)" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>📊 PropStream &amp; BatchLeads</div>
              <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
                Export your filtered skip-traced lists or trigger webhook exports on motivated seller triggers directly into your CRM.
              </p>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", background: "var(--surface-sunken)" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>🌐 Custom Website Forms</div>
              <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
                Point motivated seller landing page forms (Webflow, WordPress, Carrd) straight to this endpoint for instant lead creation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
