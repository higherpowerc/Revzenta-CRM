import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Client, RentcastUsageInfo, SuppressionRecord } from "./types";
import { api } from "./api";

interface Props {
  onNavigateToConnections?: () => void;
  onNavigateToLeads?: () => void;
}

export default function Compliance({ onNavigateToConnections, onNavigateToLeads }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [suppressions, setSuppressions] = useState<SuppressionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dnc" | "wholesaling" | "privacy" | "api_guard" | "safeguards">("safeguards");

  // Safeguard A–D collapse state (expanded by default to preserve current behavior)
  const [safeguardOpen, setSafeguardOpen] = useState<Record<"a" | "b" | "c" | "d", boolean>>({
    a: true,
    b: true,
    c: true,
    d: true,
  });
  const toggleSafeguard = (key: "a" | "b" | "c" | "d") =>
    setSafeguardOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  // DNC Scrub / Lookup search
  const [searchQuery, setSearchQuery] = useState("");
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);

  // Manual DNC Flag Modal
  const [showAddDncModal, setShowAddDncModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");
  const [customDncReason, setCustomDncReason] = useState("Homeowner explicitly requested no contact");

  // CCPA Purge Modal
  const [showCcpaPurgeModal, setShowCcpaPurgeModal] = useState(false);
  const [purgeClientId, setPurgeClientId] = useState<number | "">("");
  const [purgeReason, setPurgeReason] = useState("Consumer submitted formal CCPA Right-to-be-Forgotten deletion request");
  const [purging, setPurging] = useState(false);

  // RentCast API Usage Guard State
  const [rentcastUsage, setRentcastUsage] = useState<RentcastUsageInfo | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.clients(true);
      setClients(res.clients || []);

      try {
        const supRes = await api.getSuppressionList();
        if (supRes.ok && supRes.records) {
          setSuppressions(supRes.records);
        }
      } catch (err) {
        console.warn("Could not load suppression list:", err);
      }

      try {
        const usageRes = await api.getRentcastUsage();
        if (usageRes.ok && usageRes.usage) {
          setRentcastUsage(usageRes.usage);
        }
      } catch (err) {
        console.warn("Could not load rentcast usage in compliance:", err);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load compliance records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // DNC Statistics
  const dncClients = useMemo(() => clients.filter((c) => c.dnc === true), [clients]);
  const safeClients = useMemo(() => clients.filter((c) => !c.dnc), [clients]);

  // Scrub search results
  const scrubResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const cleanPhoneQ = q.replace(/[^0-9]/g, "");
    return clients.filter((c) => {
      const phoneClean = (c.phone || "").replace(/[^0-9]/g, "");
      const nameMatch = (c.contactName || "").toLowerCase().includes(q) || (c.companyName || "").toLowerCase().includes(q);
      const addrMatch = (c.address || "").toLowerCase().includes(q);
      const phoneMatch = cleanPhoneQ.length >= 3 && phoneClean.includes(cleanPhoneQ);
      return nameMatch || addrMatch || phoneMatch;
    });
  }, [clients, searchQuery]);

  const handleClearDnc = async (client: Client) => {
    if (!window.confirm(`Are you sure you want to remove the DNC flag for ${client.contactName || client.address || "this contact"}? Only remove if written or express verbal consent was received.`)) {
      return;
    }
    setActionInProgress(client.id);
    try {
      await api.updateClient(client.id, {
        dnc: false,
        dncReason: "",
        dncDate: "",
      });
      setSuccessMsg(`Cleared DNC restriction for ${client.contactName || client.address}. Contact is now permitted for outreach.`);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Failed to update DNC status.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleMarkDnc = async (clientId: number, reason: string) => {
    setActionInProgress(clientId);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.updateClient(clientId, {
        dnc: true,
        dncReason: reason || "Requested no further communications",
        dncDate: today,
      });
      setSuccessMsg("Contact successfully flagged as DO-NOT-CALL. Outreach restricted across CRM.");
      setShowAddDncModal(false);
      setSelectedClientId("");
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Failed to mark DNC.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleExecuteCcpaPurge = async () => {
    if (typeof purgeClientId !== "number") return;
    const target = clients.find((c) => c.id === purgeClientId);
    if (!window.confirm(`CAUTION: You are about to permanently purge all stored personal records for "${target?.contactName || target?.address || "this consumer"}". Under CCPA, this will erase notes, equity numbers, and history, and place the phone number on the Permanent Suppression Registry. Proceed?`)) {
      return;
    }
    setPurging(true);
    try {
      const res = await api.ccpaPurgeClient(purgeClientId, purgeReason);
      setSuccessMsg(res.message || "Consumer record successfully purged under CCPA/CPRA.");
      setShowCcpaPurgeModal(false);
      setPurgeClientId("");
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Failed to execute CCPA purge.");
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="main">
      {/* Page Header */}
      <div className="page-head">
        <div className="page-head-main">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "30px" }}>🛡️</span>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>Compliance, Legal &amp; Data Safeguards</h1>
              <p className="page-sub" style={{ margin: "4px 0 0" }}>
                TCPA Do-Not-Call protection, state wholesaling non-agency safe harbors, CCPA data purge, and FCRA data privacy safeguards.
              </p>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={loadData} title="Refresh compliance data">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "16px" }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: "16px", background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46", padding: "12px 16px", borderRadius: "6px" }}>
          {successMsg}
        </div>
      )}

      {/* Compliance Health Overview Banner */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "14px",
        marginBottom: "22px"
      }}>
        <div className="card" style={{ padding: "16px", borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Legal Safeguards</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>4 Active Frameworks</div>
          <div style={{ fontSize: "12px", color: "#10b981", marginTop: "4px" }}>DPA · FCRA · CCPA · In-Transit TLS</div>
        </div>

        <div className="card" style={{ padding: "16px", borderLeft: "4px solid #ef4444" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>DNC Restricted Leads</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#ef4444", marginTop: "4px" }}>{dncClients.length}</div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Outreach blocked &amp; flagged</div>
        </div>

        <div className="card" style={{ padding: "16px", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>CCPA Suppressions</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#d97706", marginTop: "4px" }}>{suppressions.length}</div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Permanent purge registry</div>
        </div>

        <div className="card" style={{ padding: "16px", borderLeft: "4px solid #8b5cf6" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>RentCast API Guard</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#8b5cf6", marginTop: "4px" }}>
            {rentcastUsage ? `${rentcastUsage.callsThisMonth} / ${rentcastUsage.monthlyLimit}` : "Active"}
          </div>
          <div style={{ fontSize: "12px", color: rentcastUsage?.isBlocked ? "#ef4444" : "#10b981", marginTop: "4px" }}>
            {rentcastUsage?.isBlocked ? "🛑 Hard Stop Reached" : "✓ Hard Stop Active"}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "2px solid #e2e8f0", marginBottom: "20px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setActiveTab("safeguards")}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "14px",
            border: "none",
            borderBottom: activeTab === "safeguards" ? "3px solid #6366f1" : "3px solid transparent",
            background: "transparent",
            color: activeTab === "safeguards" ? "#6366f1" : "#64748b",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>📜</span>
          <span>4 Formal Legal Safeguards</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("dnc")}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "14px",
            border: "none",
            borderBottom: activeTab === "dnc" ? "3px solid #ef4444" : "3px solid transparent",
            background: "transparent",
            color: activeTab === "dnc" ? "#ef4444" : "#64748b",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>🛑</span>
          <span>TCPA &amp; Do-Not-Call Registry ({dncClients.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("wholesaling")}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "14px",
            border: "none",
            borderBottom: activeTab === "wholesaling" ? "3px solid #3b82f6" : "3px solid transparent",
            background: "transparent",
            color: activeTab === "wholesaling" ? "#3b82f6" : "#64748b",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>⚖️</span>
          <span>Wholesaling &amp; Anti-Brokering Disclosures</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("privacy")}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "14px",
            border: "none",
            borderBottom: activeTab === "privacy" ? "3px solid #10b981" : "3px solid transparent",
            background: "transparent",
            color: activeTab === "privacy" ? "#10b981" : "#64748b",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>🔒</span>
          <span>Data Privacy, FCRA &amp; Zero-Scraping</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("api_guard")}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "14px",
            border: "none",
            borderBottom: activeTab === "api_guard" ? "3px solid #8b5cf6" : "3px solid transparent",
            background: "transparent",
            color: activeTab === "api_guard" ? "#8b5cf6" : "#64748b",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>🛡️</span>
          <span>RentCast Quota &amp; Whitelist</span>
        </button>
      </div>

      {/* Tab 0: The 4 Formalized Legal Safeguards */}
      {activeTab === "safeguards" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Safeguard A: Data Controller vs Data Processor Agreement */}
          <div className="card admin-form">
            <div className="admin-card-head admin-card-head-toggle">
              <div className="admin-card-head-text">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "20px" }}>📄</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", background: "#e0e7ff", color: "#4338ca", borderRadius: "10px" }}>SAFEGUARD A</span>
                </div>
                <h2 className="admin-card-title" style={{ margin: 0 }}>Data Controller vs. Data Processor Legal Agreement (SaaS DPA)</h2>
                <p className="admin-card-sub" style={{ margin: "4px 0 0" }}>
                  Defines liability boundaries between Revzenta (the Software Provider) and the Wholesale Subscriber (the Lead Data Controller).
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm admin-card-toggle"
                aria-expanded={safeguardOpen.a}
                aria-label={safeguardOpen.a ? "Collapse Safeguard A" : "Expand Safeguard A"}
                onClick={() => toggleSafeguard("a")}
              >
                {safeguardOpen.a ? "Hide ▾" : "Show ▸"}
              </button>
            </div>
            {safeguardOpen.a && (

            <div style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6, marginTop: "14px", background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "12px" }}>
                <div style={{ background: "#ffffff", padding: "12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>🏢 Revzenta LLC — Data Processor</div>
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "#475569", fontSize: "12px" }}>
                    <li>Provides secure cloud infrastructure, database hosting, and deal calculators.</li>
                    <li><strong>Non-Sale Pledge:</strong> Revzenta NEVER sells, rents, monetizes, or shares user leads with any third party.</li>
                    <li>Processes data strictly upon instructions of the tenant account.</li>
                  </ul>
                </div>
                <div style={{ background: "#ffffff", padding: "12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>👤 Client / Subscriber — Data Controller</div>
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "#475569", fontSize: "12px" }}>
                    <li>Owns and controls all homeowner and investor lead data entered into their workspace.</li>
                    <li>Warrants that phone numbers and skip-traced contacts were acquired lawfully under TCPA and state law.</li>
                    <li>Solely responsible for outbound dialing, SMS marketing, and respecting opt-outs.</li>
                  </ul>
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                ✓ Result: If a subscriber executes an unauthorized phone campaign, legal liability rests on the subscriber as Data Controller, protecting Revzenta LLC as the independent technology platform.
              </div>
            </div>
            )}
          </div>

          {/* Safeguard B: FCRA & Financial Data Disclaimer */}
          <div className="card admin-form">
            <div className="admin-card-head admin-card-head-toggle">
              <div className="admin-card-head-text">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "20px" }}>⚖️</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", background: "#fef3c7", color: "#92400e", borderRadius: "10px" }}>SAFEGUARD B</span>
                </div>
                <h2 className="admin-card-title" style={{ margin: 0 }}>FCRA &amp; Financial Non-Consumer Reporting Agency Disclaimer</h2>
                <p className="admin-card-sub" style={{ margin: "4px 0 0" }}>
                  Mandatory statutory safe harbor under 15 U.S.C. § 1681a governing public property records, valuations, and debt estimates.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm admin-card-toggle"
                aria-expanded={safeguardOpen.b}
                aria-label={safeguardOpen.b ? "Collapse Safeguard B" : "Expand Safeguard B"}
                onClick={() => toggleSafeguard("b")}
              >
                {safeguardOpen.b ? "Hide ▾" : "Show ▸"}
              </button>
            </div>
            {safeguardOpen.b && (

            <div style={{ marginTop: "14px", padding: "16px", borderRadius: "8px", background: "#fffbeb", border: "1px solid #fde68a", fontSize: "13px", color: "#78350f", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: "#92400e", marginBottom: "6px" }}>
                📜 Official Fair Credit Reporting Act (FCRA) Statutory Notice:
              </div>
              <p style={{ margin: "0 0 10px" }}>
                <strong>Revzenta CRM is not a Consumer Reporting Agency (&quot;CRA&quot;)</strong> as defined by the Fair Credit Reporting Act (15 U.S.C. § 1681 et seq.). The property valuations, automated valuation models (AVMs), market rent calculations, and public deed records accessible via Revzenta CRM are gathered from licensed third-party public aggregators (RentCast) and self-reported inputs.
              </p>
              <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "6px", border: "1px solid #fde68a", color: "#b45309", fontWeight: 600 }}>
                ⚠️ Prohibited Use Notice: Data provided through Revzenta CRM may NOT be used in whole or in part as a factor in determining eligibility for personal consumer credit, insurance, employment, or residential tenant screening.
              </div>
            </div>
            )}
          </div>

          {/* Safeguard C: CCPA/CPRA Data Purge & Right to be Forgotten */}
          <div className="card admin-form">
            <div className="admin-card-head admin-card-head-toggle">
              <div className="admin-card-head-text">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "20px" }}>🗑️</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", background: "#fee2e2", color: "#991b1b", borderRadius: "10px" }}>SAFEGUARD C</span>
                </div>
                <h2 className="admin-card-title" style={{ margin: 0 }}>CCPA / CPRA &quot;Right to be Forgotten&quot; Consumer Purge Protocol</h2>
                <p className="admin-card-sub" style={{ margin: "4px 0 0" }}>
                  Permanently purge homeowner personal records upon request while maintaining their phone number on the Permanent Suppression Registry.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowCcpaPurgeModal(true)}
                  style={{ background: "#dc2626", borderColor: "#b91c1c" }}
                >
                  🗑️ Execute CCPA Purge
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm admin-card-toggle"
                  aria-expanded={safeguardOpen.c}
                  aria-label={safeguardOpen.c ? "Collapse Safeguard C" : "Expand Safeguard C"}
                  onClick={() => toggleSafeguard("c")}
                >
                  {safeguardOpen.c ? "Hide ▾" : "Show ▸"}
                </button>
              </div>
            </div>
            {safeguardOpen.c && (

            <div style={{ marginTop: "14px", fontSize: "13px", color: "#334155", lineHeight: 1.6 }}>
              <p>
                Under the <strong>California Consumer Privacy Act (CCPA / CPRA)</strong>, Texas Data Privacy and Security Act (TDPSA), and similar state statutes, consumers have the legal right to request the complete deletion of their personal information.
              </p>
              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "16px" }}>
                <strong>The Safe Harbor Deletion Protocol:</strong>
                <ol style={{ margin: "6px 0 0", paddingLeft: "20px", color: "#475569", fontSize: "12px" }}>
                  <li>All personal notes, equity records, financial figures, and lead entries are permanently wiped from the active database.</li>
                  <li>Under CCPA § 1798.105(d) and federal TCPA safe-harbor standards, the consumer&apos;s phone number and address are placed into the <strong>Permanent Suppression Registry</strong> below so they are never accidentally re-imported via future CSV uploads or outreach lists.</li>
                </ol>
              </div>

              {/* Permanent Suppression Registry Table */}
              <h4 style={{ margin: "16px 0 8px", color: "#0f172a" }}>
                Permanent Suppression Registry ({suppressions.length} Records)
              </h4>
              {suppressions.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                  No consumer purge records on file. When a CCPA deletion is executed, the suppressed numbers will be cataloged here.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ padding: "8px" }}>Consumer</th>
                        <th style={{ padding: "8px" }}>Suppressed Phone</th>
                        <th style={{ padding: "8px" }}>Property Address</th>
                        <th style={{ padding: "8px" }}>Purge Type</th>
                        <th style={{ padding: "8px" }}>Date Purged</th>
                        <th style={{ padding: "8px" }}>Legal Basis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppressions.map((s) => (
                        <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px", fontWeight: 600 }}>{s.ownerName || "Consumer"}</td>
                          <td style={{ padding: "8px", fontFamily: "monospace" }}>{s.phone || "—"}</td>
                          <td style={{ padding: "8px" }}>{s.address || "—"}</td>
                          <td style={{ padding: "8px" }}>
                            <span style={{ padding: "2px 6px", borderRadius: "4px", background: "#fee2e2", color: "#991b1b", fontSize: "11px", fontWeight: 700 }}>
                              {s.purgeType.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "8px", color: "#64748b" }}>{s.purgedAt.slice(0, 10)}</td>
                          <td style={{ padding: "8px", color: "#64748b", fontStyle: "italic" }}>
                            &quot;{s.referenceNotes || "Formal CCPA deletion request"}&quot;
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            )}
          </div>

          {/* Safeguard D: Technical Storage, At-Rest & In-Transit Security Audit */}
          <div className="card admin-form">
            <div className="admin-card-head admin-card-head-toggle">
              <div className="admin-card-head-text">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "20px" }}>🔒</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", background: "#ecfdf5", color: "#047857", borderRadius: "10px" }}>SAFEGUARD D</span>
                </div>
                <h2 className="admin-card-title" style={{ margin: 0 }}>Data Storage, In-Transit Encryption &amp; Security Architecture</h2>
                <p className="admin-card-sub" style={{ margin: "4px 0 0" }}>
                  Technical specifications protecting confidential records against data interception, unauthorized access, and cross-tenant leakage.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm admin-card-toggle"
                aria-expanded={safeguardOpen.d}
                aria-label={safeguardOpen.d ? "Collapse Safeguard D" : "Expand Safeguard D"}
                onClick={() => toggleSafeguard("d")}
              >
                {safeguardOpen.d ? "Hide ▾" : "Show ▸"}
              </button>
            </div>
            {safeguardOpen.d && (

            <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
              <div style={{ padding: "14px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #cbd5e1" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  <span>🛡️</span>
                  <span>Row-Level Tenant Partitioning</span>
                </div>
                <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>
                  Every database query strictly enforces <code>WHERE org_id = ?</code>. Tenant accounts are cryptographically and logically isolated so no organization can access or view another&apos;s leads.
                </div>
                <div style={{ marginTop: "8px", fontSize: "11px", color: "#059669", fontWeight: 700 }}>
                  ✓ STATUS: ENFORCED IN CORE DB
                </div>
              </div>

              <div style={{ padding: "14px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #cbd5e1" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  <span>👁️</span>
                  <span>On-Screen PII Blur Masking</span>
                </div>
                <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>
                  Global privacy toggle (eye icon) in top navigation dynamically blurs homeowner names, phone numbers, and addresses to protect client privacy during screenshares and recordings.
                </div>
                <div style={{ marginTop: "8px", fontSize: "11px", color: "#059669", fontWeight: 700 }}>
                  ✓ STATUS: ACTIVE IN TOOLBAR
                </div>
              </div>

              <div style={{ padding: "14px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #cbd5e1" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  <span>🔐</span>
                  <span>HTTP Security Headers</span>
                </div>
                <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>
                  Server injects <code>X-Content-Type-Options: nosniff</code>, <code>X-Frame-Options: SAMEORIGIN</code>, and <code>Referrer-Policy: strict-origin-when-cross-origin</code> to prevent clickjacking and MIME attacks.
                </div>
                <div style={{ marginTop: "8px", fontSize: "11px", color: "#059669", fontWeight: 700 }}>
                  ✓ STATUS: INJECTED ON ALL HTTP RESPONSES
                </div>
              </div>

              <div style={{ padding: "14px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #cbd5e1" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  <span>🌐</span>
                  <span>Zero-Scraping Offline Regex</span>
                </div>
                <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>
                  Property URLs are extracted 100% in local memory using regex patterns. Zero network requests or headless bots touch Zillow or Redfin servers.
                </div>
                <div style={{ marginTop: "8px", fontSize: "11px", color: "#059669", fontWeight: 700 }}>
                  ✓ STATUS: VERIFIED 100% BLIND BACKEND
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: TCPA & Do-Not-Call Registry */}
      {activeTab === "dnc" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Quick Scrub Tool */}
          <div className="card admin-form">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 className="admin-card-title" style={{ margin: 0 }}>🔍 Quick DNC &amp; Outreach Scrub Check</h2>
                <p className="admin-card-sub" style={{ margin: "4px 0 0" }}>
                  Search any phone number, homeowner name, or property address before calling or sending SMS.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddDncModal(true)}
                style={{ background: "#ef4444", borderColor: "#dc2626" }}
              >
                + Mark Lead as DNC
              </button>
            </div>

            <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
              <input
                type="text"
                className="input"
                placeholder="Type a phone number (e.g. 555-123-4567), homeowner name, or street address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSearchQuery("")}
                >
                  Clear
                </button>
              )}
            </div>

            {searchQuery.trim() && (
              <div style={{ marginTop: "14px", padding: "12px", borderRadius: "6px", background: scrubResults.some((r) => r.dnc) ? "#fef2f2" : "#f0fdf4", border: scrubResults.some((r) => r.dnc) ? "#fecaca" : "#bbf7d0" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", color: scrubResults.some((r) => r.dnc) ? "#991b1b" : "#166534", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{scrubResults.some((r) => r.dnc) ? "🛑 OUTREACH RESTRICTED" : "✓ OUTREACH PERMITTED"}</span>
                  <span style={{ fontWeight: 400 }}>— Found {scrubResults.length} matching record(s)</span>
                </div>
                {scrubResults.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", padding: "8px 12px", background: "#ffffff", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                    <div>
                      <strong>{r.contactName || r.companyName}</strong> — {r.address} | 📞 {r.phone || "No phone recorded"}
                    </div>
                    <div>
                      {r.dnc ? (
                        <span style={{ padding: "3px 8px", borderRadius: "4px", background: "#ef4444", color: "#ffffff", fontSize: "11px", fontWeight: 700 }}>
                          🛑 DNC (Reason: {r.dncReason || "Requested no contact"})
                        </span>
                      ) : (
                        <span style={{ padding: "3px 8px", borderRadius: "4px", background: "#10b981", color: "#ffffff", fontSize: "11px", fontWeight: 700 }}>
                          ✓ Safe to Contact
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DNC Registry Table */}
          <div className="card admin-form">
            <div className="admin-card-head">
              <div>
                <h2 className="admin-card-title">Internal Do-Not-Call (DNC) Registry ({dncClients.length})</h2>
                <p className="admin-card-sub">
                  All homeowners and numbers who have opted out of cold outreach, direct mail, or phone calls. Records are immediately protected across all CRM tables and modals.
                </p>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                Loading DNC registry...
              </div>
            ) : dncClients.length === 0 ? (
              <div style={{ padding: "36px 16px", textAlign: "center", color: "#64748b" }}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>🛡️</div>
                <h3 style={{ margin: "0 0 6px", color: "#0f172a" }}>No DNC Restricted Contacts</h3>
                <p style={{ margin: 0, fontSize: "13px", maxWidth: "500px", marginInline: "auto" }}>
                  No leads in your CRM are currently marked with a Do-Not-Call restriction. If a homeowner asks not to be contacted, flag them immediately using the DNC button on their record or via the button above.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto", marginTop: "12px" }}>
                <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ padding: "10px" }}>Homeowner / Contact</th>
                      <th style={{ padding: "10px" }}>Property Address</th>
                      <th style={{ padding: "10px" }}>Phone Number</th>
                      <th style={{ padding: "10px" }}>Opt-Out Reason</th>
                      <th style={{ padding: "10px" }}>Date Flagged</th>
                      <th style={{ padding: "10px" }}>Status</th>
                      <th style={{ padding: "10px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dncClients.map((client) => (
                      <tr key={client.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px", fontWeight: 600 }}>
                          {client.contactName || client.companyName || "Unknown"}
                        </td>
                        <td style={{ padding: "10px" }}>{client.address || "—"}</td>
                        <td style={{ padding: "10px", fontFamily: "monospace" }}>
                          {client.phone || "N/A"}
                        </td>
                        <td style={{ padding: "10px", color: "#64748b", fontStyle: "italic" }}>
                          &quot;{client.dncReason || "Requested no further contact"}&quot;
                        </td>
                        <td style={{ padding: "10px", color: "#64748b" }}>
                          {client.dncDate || "Recorded"}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "#fee2e2",
                            color: "#b91c1c"
                          }}>
                            🛑 DO NOT CONTACT
                          </span>
                        </td>
                        <td style={{ padding: "10px", textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={actionInProgress === client.id}
                            onClick={() => handleClearDnc(client)}
                            title="Remove DNC status if consent was re-established"
                            style={{ color: "#059669", fontSize: "12px" }}
                          >
                            {actionInProgress === client.id ? "Updating..." : "✓ Clear DNC"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* TCPA Legal Guidelines Card */}
          <div className="card admin-form" style={{ background: "#f8fafc", border: "1px solid #cbd5e1" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "15px", color: "#0f172a" }}>
              📖 Telephone Consumer Protection Act (TCPA) &amp; Telemarketing Sales Rule (TSR) Guidelines
            </h3>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#475569", lineHeight: 1.6 }}>
              <li>
                <strong>Permitted Calling Hours:</strong> Outbound calls and text messages are only legally permissible between <strong>8:00 AM and 9:00 PM</strong> in the recipient&apos;s local time zone.
              </li>
              <li>
                <strong>Immediate Opt-Out Honoring:</strong> When a homeowner requests not to be called, federal law requires recording the opt-out. Revzenta CRM enforces this immediately upon saving the DNC flag.
              </li>
              <li>
                <strong>National Do-Not-Call Registry Scrubbing:</strong> Telemarketers and commercial callers must scrub outreach lists against the National DNC registry at least once every 31 days.
              </li>
              <li>
                <strong>Statutory Penalties:</strong> Unsolicited automated calls or calling numbers registered on the DNC list without an established business relationship carries civil statutory penalties ranging from <strong>$500 to $1,500 per violation</strong>.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Wholesaling & Anti-Brokering Disclosures */}
      {activeTab === "wholesaling" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="card admin-form">
            <div className="admin-card-head">
              <div>
                <h2 className="admin-card-title">⚖️ The Equitable Interest Doctrine &amp; Anti-Brokering Compliance</h2>
                <p className="admin-card-sub">
                  How Revzenta CRM protects you against unlicensed real estate brokerage allegations across all 50 states.
                </p>
              </div>
            </div>

            <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.6, marginTop: "12px" }}>
              <p>
                In the United States, representing a third-party seller in marketing their real estate for compensation requires an active real estate broker&apos;s license. Unlicensed real estate wholesaling is strictly governed under state real estate commission statutes (such as Illinois Public Act 101-0357, Texas Occupations Code § 1101.0045, Oklahoma SB 924, and California BPC § 10130).
              </p>
              <div style={{ padding: "14px", borderRadius: "6px", background: "#eff6ff", border: "1px solid #bfdbfe", margin: "14px 0" }}>
                <strong style={{ color: "#1d4ed8" }}>The Legal Rule: Marketing Equitable Interest vs. Real Estate</strong>
                <p style={{ margin: "6px 0 0", color: "#1e40af", fontSize: "13px" }}>
                  As an independent investor, you are <strong>NEVER</strong> selling or brokering the homeowner&apos;s physical property. You are assigning your <strong>contractual right to purchase (Equitable Interest)</strong> created under a bilateral purchase agreement.
                </p>
              </div>

              <h4 style={{ margin: "18px 0 8px", color: "#0f172a" }}>Automated Statutory Disclosures in Revzenta CRM:</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
                <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "6px", background: "#ffffff" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>📄 Purchase Agreements</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    Section 6 automatically embeds: <em>&quot;PRINCIPAL CAPACITY &amp; NON-AGENCY DISCLOSURE — Buyer is acting solely as a principal investor for its own account and does not represent Seller as a real estate agent or broker.&quot;</em>
                  </div>
                </div>

                <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "6px", background: "#ffffff" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>📝 Assignment of Contract Agreements</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    Section 5 automatically embeds: <em>&quot;NON-AGENCY &amp; INDEPENDENT INVESTOR ACKNOWLEDGEMENT — Assignor is assigning its equitable contractual interest. Assignee acknowledges Assignor is not a licensed real estate broker.&quot;</em>
                  </div>
                </div>

                <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "6px", background: "#ffffff" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>📬 Letters of Intent (LOIs)</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    Footer automatically includes: <em>&quot;Buyer is an independent investor acting as a principal. This proposal does not constitute a brokerage listing or fiduciary representation.&quot;</em>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Data Privacy, FCRA & Zero-Scraping */}
      {activeTab === "privacy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="card admin-form">
            <div className="admin-card-head">
              <div>
                <h2 className="admin-card-title">🔒 Zero-Scraping Architecture &amp; Complete Platform Independence</h2>
                <p className="admin-card-sub">
                  How our system ensures complete legal immunity against web scraping lawsuits, CFAA, and listing portal ToS violations.
                </p>
              </div>
            </div>

            <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.6, marginTop: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                <div style={{ padding: "14px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #cbd5e1" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>👁️</span>
                    <span>100% Blind Backend to Zillow / Redfin</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>
                    When a user pastes a Zillow, Redfin, or Realtor.com URL into Revzenta CRM, the backend <strong>NEVER</strong> accesses, contacts, or scrapes Zillow or Redfin servers. The URL text is parsed entirely in local memory using regex to extract the raw physical address.
                  </p>
                </div>

                <div style={{ padding: "14px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #cbd5e1" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>📜</span>
                    <span>Licensed Public Records Aggregation</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>
                    Once the physical address is extracted, all property square footage, bedrooms, bathrooms, and automated valuations (AVMs) are retrieved exclusively through your licensed RentCast API subscription, which aggregates public county assessor data and public deed registries.
                  </p>
                </div>
              </div>

              <div style={{ padding: "14px", borderRadius: "6px", background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e" }}>
                <div style={{ fontWeight: 700, marginBottom: "#4px" }}>🛡️ Financial Privacy Protection (GLBA &amp; FCRA Aligned)</div>
                <p style={{ margin: 0, fontSize: "13px" }}>
                  Private homeowner mortgage balances and lender payoff amounts are confidential banking records governed under the <strong>Gramm-Leach-Bliley Act (GLBA)</strong> and <strong>Fair Credit Reporting Act (FCRA)</strong>. They are never published on listing websites or public MLS. Revzenta CRM strictly adheres to this standard by defaulting open mortgage balances to $0 (unverified) until confirmed directly by the homeowner or title company.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: RentCast Quota & Security Whitelist */}
      {activeTab === "api_guard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="card admin-form">
            <div className="admin-card-head">
              <div>
                <h2 className="admin-card-title">🛑 RentCast API Monthly Quota Guard &amp; Hard Stop Status</h2>
                <p className="admin-card-sub">
                  Automatic safety mechanism to prevent unexpected API overages and safeguard your account quota.
                </p>
              </div>
            </div>

            {rentcastUsage ? (
              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                      Monthly Quota Consumption: {rentcastUsage.callsThisMonth} / {rentcastUsage.monthlyLimit} calls
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                      Offset baseline: {rentcastUsage.offset} calls | Live calls: {Math.max(0, rentcastUsage.callsThisMonth - rentcastUsage.offset)} | Cached queries: {rentcastUsage.cachedQueriesThisMonth}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      background: rentcastUsage.isBlocked ? "#fee2e2" : "#ecfdf5",
                      color: rentcastUsage.isBlocked ? "#b91c1c" : "#047857"
                    }}>
                      {rentcastUsage.isBlocked ? "🛑 HARD STOP ACTIVE (BLOCKED)" : "✓ QUOTA HEALTHY"}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ height: "10px", background: "#e2e8f0", borderRadius: "5px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, Math.round((rentcastUsage.callsThisMonth / Math.max(1, rentcastUsage.monthlyLimit)) * 100))}%`,
                    background: rentcastUsage.callsThisMonth >= rentcastUsage.monthlyLimit ? "#ef4444" : rentcastUsage.callsThisMonth >= rentcastUsage.monthlyLimit * 0.8 ? "#f59e0b" : "#10b981",
                    transition: "width 0.3s ease"
                  }} />
                </div>

                <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "13px", color: "#475569" }}>
                  When the monthly limit of <strong>{rentcastUsage.monthlyLimit} calls</strong> is reached and Hard Stop Protection is enabled, outbound property valuation requests are immediately paused with an explicit warning modal. Cached properties incur 0 API calls.
                </div>

                {onNavigateToConnections && (
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={onNavigateToConnections}
                    >
                      ⚙️ Adjust RentCast Limit &amp; Hard Stop in Connections &rarr;
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "16px", color: "#64748b" }}>
                Loading RentCast Quota information...
              </div>
            )}
          </div>

          {/* Authorized Domains Security Card */}
          <div className="card admin-form">
            <h3 style={{ margin: "0 0 8px", fontSize: "15px", color: "#0f172a" }}>
              🌐 Authorized Property URL Domain Whitelist
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#64748b" }}>
              To defend against Server-Side Request Forgery (SSRF) and untrusted URL inputs, the CRM only permits property URLs from verified real estate listing portals:
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {["zillow.com", "redfin.com", "realtor.com", "trulia.com", "homes.com"].map((d) => (
                <span key={d} style={{ padding: "4px 10px", borderRadius: "4px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: "12px", fontWeight: 600 }}>
                  ✓ {d}
                </span>
              ))}
            </div>
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#ef4444" }}>
              * Any URL containing internal IP addresses (localhost, 127.0.0.1, 192.168.*, 10.*) or unauthorized domains will be immediately rejected with a security alert.
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mark Lead as DNC */}
      {showAddDncModal && (
        <div className="modal-backdrop" onClick={() => setShowAddDncModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px", width: "100%" }}>
            <div className="modal-header">
              <h2 className="modal-title">🛑 Mark Contact as Do-Not-Call (DNC)</h2>
              <button type="button" className="modal-close" onClick={() => setShowAddDncModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="label">Select Existing CRM Lead:</label>
                <select
                  className="input"
                  value={selectedClientId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedClientId(id || "");
                  }}
                >
                  <option value="">-- Choose a lead to mark as DNC --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contactName || c.companyName} {c.address ? `(${c.address})` : ""} {c.phone ? `— ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">DNC Opt-Out Reason:</label>
                <select
                  className="input"
                  value={customDncReason}
                  onChange={(e) => setCustomDncReason(e.target.value)}
                >
                  <option value="Homeowner explicitly requested no contact">Homeowner explicitly requested no contact</option>
                  <option value="Hostile / Verbal Opt-Out during phone call">Hostile / Verbal Opt-Out during phone call</option>
                  <option value="STOP / Opt-Out received via SMS">STOP / Opt-Out received via SMS</option>
                  <option value="Wrong number / No longer owns property">Wrong number / No longer owns property</option>
                  <option value="Litigation threat / TCPA warning">Litigation threat / TCPA warning</option>
                  <option value="Registered on National DNC List">Registered on National DNC List</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ padding: "10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "4px", fontSize: "12px", color: "#991b1b" }}>
                ⚠️ Flagging this lead will immediately display a red <strong>🛑 DO NOT CALL</strong> warning across all Opportunity views and prevent accidental outbound dialing.
              </div>
            </div>
            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddDncModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedClientId || actionInProgress !== null}
                onClick={() => {
                  if (typeof selectedClientId === "number") {
                    handleMarkDnc(selectedClientId, customDncReason);
                  }
                }}
                style={{ background: "#ef4444", borderColor: "#dc2626" }}
              >
                {actionInProgress !== null ? "Flagging..." : "Mark as DNC"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: CCPA Consumer Data Purge */}
      {showCcpaPurgeModal && (
        <div className="modal-backdrop" onClick={() => setShowCcpaPurgeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px", width: "100%" }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: "#dc2626" }}>🗑️ Execute CCPA / CPRA Data Purge</h2>
              <button type="button" className="modal-close" onClick={() => setShowCcpaPurgeModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ padding: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "12px", color: "#991b1b", lineHeight: 1.5 }}>
                <strong>Legal Action Notice:</strong> This action permanently purges the consumer&apos;s personal records, notes, equity calculations, and deal data from the database. Their phone number will be automatically cataloged on the <strong>Permanent Suppression Registry</strong> to enforce future safe-harbor compliance.
              </div>

              <div>
                <label className="label">Select Consumer / Lead to Purge:</label>
                <select
                  className="input"
                  value={purgeClientId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setPurgeClientId(id || "");
                  }}
                >
                  <option value="">-- Choose lead record to permanently delete --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contactName || c.companyName} ({c.address || "No Address"}) {c.phone ? `— ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Statutory Deletion Basis / Reason:</label>
                <select
                  className="input"
                  value={purgeReason}
                  onChange={(e) => setPurgeReason(e.target.value)}
                >
                  <option value="Consumer submitted formal CCPA Right-to-be-Forgotten deletion request">
                    Consumer formal CCPA / CPRA deletion request
                  </option>
                  <option value="State Data Privacy Act (TDPSA / VCDPA) removal demand">
                    State Data Privacy Act (TDPSA / VCDPA) removal demand
                  </option>
                  <option value="Legal counsel cease-and-desist / privacy demand">
                    Legal counsel cease-and-desist / privacy demand
                  </option>
                  <option value="Erroneous personal data / wrong individual purge">
                    Erroneous personal data / wrong individual purge
                  </option>
                  <option value="Other statutory removal demand">
                    Other statutory removal demand
                  </option>
                </select>
              </div>
            </div>
            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCcpaPurgeModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!purgeClientId || purging}
                onClick={handleExecuteCcpaPurge}
                style={{ background: "#dc2626", borderColor: "#b91c1c" }}
              >
                {purging ? "Purging..." : "Permanently Purge Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
