import { useEffect, useState } from "react";
import { api } from "./api";
import type { Client } from "./types";

function getLoiStatus(opp: Client): "Sent" | "Unsent" {
  if (typeof opp.offersCount === "number" && opp.offersCount > 0) return "Sent";
  if (
    opp.customFields?.some((f) => {
      const n = (f.name || "").toLowerCase();
      const v = (f.value || "").toLowerCase();
      return (
        (n === "loi status" && v === "sent") ||
        (n === "loi" && v === "sent") ||
        (n === "offer sent" && (v === "true" || v === "sent" || v === "yes")) ||
        n === "offer pdf"
      );
    })
  ) {
    return "Sent";
  }
  if (opp.notes && /loi\s+sent|offer\s+sent/i.test(opp.notes)) return "Sent";
  const s = (opp.stage || "").toLowerCase();
  if (s === "offer sent" || s === "contract" || s === "under contract") return "Sent";
  return "Unsent";
}

export default function Opportunities({ onOpenCreativeHub }: { onOpenCreativeHub: (opportunity?: Client) => void }) {
  const [opportunities, setOpportunities] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.clients().then((response) => {
      if (!active) return;
      setOpportunities(response.clients.filter((client) => !client.archived && client.stage !== "Closing"));
      setLoading(false);
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Unable to load opportunities.");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleToggleLoi = async (opp: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = getLoiStatus(opp);
    const nextStatus = current === "Sent" ? "Unsent" : "Sent";
    const existing = (opp.customFields || []).filter(
      (f) => f.name.toLowerCase() !== "loi status" && f.name.toLowerCase() !== "loi"
    );
    const updatedFields = [...existing, { name: "LOI Status", value: nextStatus.toLowerCase() }];
    try {
      const res = await api.updateClient(opp.id, {
        customFields: updatedFields,
        offersCount: nextStatus === "Sent" ? Math.max(1, opp.offersCount || 1) : 0,
      });

      if (nextStatus === "Sent" && (!opp.offersCount || opp.offersCount === 0)) {
        try {
          const propAddr = (opp.address && opp.companyName && opp.address !== opp.companyName)
            ? `${opp.companyName} — ${opp.address}`
            : (opp.address || opp.companyName || "Subject Property");
          await api.createOffer({
            clientId: opp.id,
            propertyAddress: propAddr,
            sellerName: opp.contactName || "Property Owner",
            sellerEmail: opp.email || "",
            sellerPhone: opp.phone || "",
            cashOfferAmount: opp.dealValue || 250000,
            offerType: "cash",
            selectedOffers: ["cash"],
            status: "Sent",
            emailStatus: "sent",
            notes: `Official Letter of Intent (LOI) dispatched for ${opp.companyName || opp.address}`,
          });
        } catch (offerErr) {
          console.warn("Could not auto-create offer record in repository:", offerErr);
        }
      }

      if (res.client) {
        setOpportunities((prev) => prev.map((item) => (item.id === opp.id ? res.client : item)));
      }
    } catch (err) {
      console.error("Failed to update LOI status", err);
    }
  };

  return (
    <section style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Opportunities</h1>
          <p style={{ margin: "6px 0 0", color: "var(--muted, #94a3b8)" }}>Active wholesale properties that still need a next deal step.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onOpenCreativeHub()}>New Deal</button>
      </div>
      {loading && <p>Loading opportunities...</p>}
      {error && <p role="alert" style={{ color: "#ef4444" }}>{error}</p>}
      {!loading && !error && opportunities.length === 0 && (
        <div style={{ padding: "32px", border: "1px dashed var(--border, #30363d)", borderRadius: "8px", color: "var(--muted, #94a3b8)" }}>
          No active opportunities yet. Add a property in Creative Hub to see it here.
        </div>
      )}
      {!loading && !error && opportunities.length > 0 && (
        <div style={{ overflowX: "auto", borderTop: "1px solid var(--border, #30363d)" }}>
          <table className="table" style={{ width: "100%", minWidth: "760px", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 10px" }}>Property</th>
                <th style={{ textAlign: "left", padding: "12px 10px" }}>Stage</th>
                <th style={{ textAlign: "left", padding: "12px 10px" }}>Location</th>
                <th style={{ textAlign: "right", padding: "12px 10px" }}>Deal Value</th>
                <th style={{ textAlign: "center", padding: "12px 10px" }}>LOI</th>
                <th style={{ textAlign: "right", padding: "12px 10px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opportunity) => {
                const loiStatus = getLoiStatus(opportunity);
                const isSent = loiStatus === "Sent";
                return (
                  <tr key={opportunity.id}>
                    <td style={{ padding: "13px 10px", fontWeight: 700, color: "var(--ink, #f8fafc)" }}>
                      {opportunity.companyName || opportunity.address || "Untitled property"}
                    </td>
                    <td style={{ padding: "13px 10px", color: "var(--muted, #94a3b8)" }}>{opportunity.stage || "Unassigned"}</td>
                    <td style={{ padding: "13px 10px", color: "var(--muted, #94a3b8)" }}>
                      {[opportunity.address, opportunity.city, opportunity.state, opportunity.zip].filter(Boolean).join(", ") || "No address"}
                    </td>
                    <td style={{ padding: "13px 10px", textAlign: "right", fontWeight: 700 }}>
                      {opportunity.dealValue > 0 ? `$${opportunity.dealValue.toLocaleString()}` : "-"}
                    </td>
                    <td style={{ padding: "13px 10px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleLoi(opportunity, e)}
                        title={`LOI: ${loiStatus}. Click to toggle to ${isSent ? "Unsent" : "Sent"}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "4px 10px",
                          borderRadius: "9999px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          border: isSent ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(148, 163, 184, 0.3)",
                          backgroundColor: isSent ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.1)",
                          color: isSent ? "#10b981" : "var(--muted, #94a3b8)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span style={{ fontSize: "11px" }}>{isSent ? "✓" : "○"}</span>
                        <span>{loiStatus}</span>
                      </button>
                    </td>
                    <td style={{ padding: "13px 10px", textAlign: "right" }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenCreativeHub(opportunity)}>Open in Creative Hub</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
