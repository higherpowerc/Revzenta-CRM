import { useEffect, useState } from "react";
import { api } from "./api";
import type { Client } from "./types";

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
                <th style={{ textAlign: "right", padding: "12px 10px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opportunity) => (
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
                  <td style={{ padding: "13px 10px", textAlign: "right" }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenCreativeHub(opportunity)}>Open in Creative Hub</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
