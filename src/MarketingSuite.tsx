import { useCallback, useEffect, useState, useMemo } from "react";
import { api } from "./api";
import type { MarketingCampaign, MarketingOverviewData } from "./types";

const CHANNEL_OPTIONS = [
  { value: "google_ads", label: "Google Search Ads (PPC)", icon: "🔍" },
  { value: "meta_ads", label: "Meta (FB & IG) Ads", icon: "📱" },
  { value: "seo_organic", label: "SEO & Legal Guides", icon: "📑" },
  { value: "title_viral_loop", label: "Title Portal Viral Loop", icon: "🔄" },
  { value: "community", label: "SubTo & REI Communities", icon: "🤝" },
  { value: "outbound", label: "Outbound Email & SMS", icon: "✉️" },
  { value: "direct", label: "Direct & Word of Mouth", icon: "🌟" },
  { value: "other", label: "Other / Custom Source", icon: "🌐" },
];

export default function MarketingSuite() {
  const [data, setData] = useState<MarketingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & UI States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [copiedUtm, setCopiedUtm] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  // UTM Generator States
  const [utmUrl, setUtmUrl] = useState("https://revzenta.com");
  const [utmSource, setUtmSource] = useState("google");
  const [utmMedium, setUtmMedium] = useState("cpc");
  const [utmCampaign, setUtmCampaign] = useState("wholesale_search_2026");
  const [utmContent, setUtmContent] = useState("");

  // New/Edit Campaign Form States
  const [formName, setFormName] = useState("");
  const [formChannel, setFormChannel] = useState("google_ads");
  const [formStatus, setFormStatus] = useState<"active" | "paused" | "completed">("active");
  const [formSpend, setFormSpend] = useState<string>("0");
  const [formClicks, setFormClicks] = useState<string>("0");
  const [formImpressions, setFormImpressions] = useState<string>("0");
  const [formLeads, setFormLeads] = useState<string>("0");
  const [formConversions, setFormConversions] = useState<string>("0");
  const [formTargetUrl, setFormTargetUrl] = useState("https://revzenta.com");
  const [formUtmSource, setFormUtmSource] = useState("");
  const [formUtmMedium, setFormUtmMedium] = useState("");
  const [formUtmCampaign, setFormUtmCampaign] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMarketingOverview();
      if (res.ok) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load marketing attribution data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generated UTM URL
  const generatedUtmUrl = useMemo(() => {
    try {
      const u = new URL(utmUrl.trim() || "https://revzenta.com");
      if (utmSource.trim()) u.searchParams.set("utm_source", utmSource.trim());
      if (utmMedium.trim()) u.searchParams.set("utm_medium", utmMedium.trim());
      if (utmCampaign.trim()) u.searchParams.set("utm_campaign", utmCampaign.trim());
      if (utmContent.trim()) u.searchParams.set("utm_content", utmContent.trim());
      return u.toString();
    } catch {
      return `${utmUrl}?utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}`;
    }
  }, [utmUrl, utmSource, utmMedium, utmCampaign, utmContent]);

  const handleCopyUtm = async () => {
    try {
      await navigator.clipboard.writeText(generatedUtmUrl);
      setCopiedUtm(true);
      setTimeout(() => setCopiedUtm(false), 2500);
    } catch {
      /* ignore clipboard copy errors */
    }
  };

  const handleOpenAdd = () => {
    setEditingCampaign(null);
    setFormName("");
    setFormChannel("google_ads");
    setFormStatus("active");
    setFormSpend("0");
    setFormClicks("0");
    setFormImpressions("0");
    setFormLeads("0");
    setFormConversions("0");
    setFormTargetUrl("https://revzenta.com");
    setFormUtmSource("google");
    setFormUtmMedium("cpc");
    setFormUtmCampaign("");
    setFormNotes("");
    setFormError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (c: MarketingCampaign) => {
    setEditingCampaign(c);
    setFormName(c.name);
    setFormChannel(c.channel);
    setFormStatus(c.status);
    setFormSpend(String(c.spend));
    setFormClicks(String(c.clicks));
    setFormImpressions(String(c.impressions));
    setFormLeads(String(c.leadsCount));
    setFormConversions(String(c.conversions));
    setFormTargetUrl(c.targetUrl);
    setFormUtmSource(c.utmSource);
    setFormUtmMedium(c.utmMedium);
    setFormUtmCampaign(c.utmCampaign);
    setFormNotes(c.notes);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Campaign name is required.");
      return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      const payload: Partial<MarketingCampaign> = {
        name: formName.trim(),
        channel: formChannel,
        status: formStatus,
        spend: parseFloat(formSpend) || 0,
        clicks: parseInt(formClicks, 10) || 0,
        impressions: parseInt(formImpressions, 10) || 0,
        leadsCount: parseInt(formLeads, 10) || 0,
        conversions: parseInt(formConversions, 10) || 0,
        targetUrl: formTargetUrl.trim(),
        utmSource: formUtmSource.trim(),
        utmMedium: formUtmMedium.trim(),
        utmCampaign: formUtmCampaign.trim(),
        notes: formNotes.trim(),
      };

      if (editingCampaign) {
        await api.updateMarketingCampaign(editingCampaign.id, payload);
      } else {
        await api.createMarketingCampaign(payload);
      }
      setShowAddModal(false);
      await fetchData();
    } catch (err: any) {
      setFormError(err?.message || "Failed to save campaign.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggleStatus = async (c: MarketingCampaign) => {
    const nextStatus = c.status === "active" ? "paused" : "active";
    try {
      await api.updateMarketingCampaign(c.id, { status: nextStatus });
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "Failed to update campaign status.");
    }
  };

  const handleDeleteCampaign = async (c: MarketingCampaign) => {
    if (!confirm(`Are you sure you want to delete "${c.name}"?`)) return;
    try {
      await api.deleteMarketingCampaign(c.id);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "Failed to delete campaign.");
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    const headers = [
      "Campaign ID",
      "Campaign Name",
      "Channel",
      "Status",
      "Spend ($)",
      "Impressions",
      "Clicks",
      "CTR (%)",
      "Leads Count",
      "CPL ($)",
      "Conversions",
      "CAC ($)",
      "Attributed MRR ($)",
      "Attributed ARR ($)",
      "UTM Source",
      "UTM Medium",
      "UTM Campaign",
      "Target URL",
      "Notes",
    ];

    const rows = data.campaigns.map((c) => {
      const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : "0.00";
      const cpl = c.leadsCount > 0 ? (c.spend / c.leadsCount).toFixed(2) : "0.00";
      const cac = c.conversions > 0 ? (c.spend / c.conversions).toFixed(2) : "0.00";
      const mrr = (c.conversions * 58.5).toFixed(2);
      const arr = (c.conversions * 58.5 * 12).toFixed(2);

      return [
        c.id,
        `"${c.name.replace(/"/g, '""')}"`,
        c.channel,
        c.status,
        c.spend.toFixed(2),
        c.impressions,
        c.clicks,
        ctr,
        c.leadsCount,
        cpl,
        c.conversions,
        cac,
        mrr,
        arr,
        `"${c.utmSource}"`,
        `"${c.utmMedium}"`,
        `"${c.utmCampaign}"`,
        `"${c.targetUrl}"`,
        `"${(c.notes || "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `revzenta_marketing_attribution_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCampaigns = useMemo(() => {
    if (!data) return [];
    return data.campaigns.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        c.utmCampaign.toLowerCase().includes(searchFilter.toLowerCase()) ||
        c.notes.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesChannel = channelFilter === "all" || c.channel === channelFilter;
      return matchesSearch && matchesChannel;
    });
  }, [data, searchFilter, channelFilter]);

  return (
    <div className="page page-stack" style={{ maxWidth: 1400, margin: "0 auto", paddingBottom: "3rem" }}>
      {/* ── Page Header ── */}
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.75rem" }}>📈</span>
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
              Marketing &amp; <em className="serif">Attribution Suite</em>
            </h1>
          </div>
          <p className="page-sub" style={{ marginTop: "0.25rem", color: "var(--muted)", fontSize: "0.95rem" }}>
            Multi-channel customer acquisition tracking across Google, Meta, SEO, Communities, and Title Portal viral loops.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchData}
            title="Refresh attribution metrics"
            disabled={loading}
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCsv}
            title="Download CSV report"
            disabled={!data || data.campaigns.length === 0}
          >
            📥 Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAdd}
            style={{ fontWeight: 600 }}
          >
            ➕ Log Ad Spend
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "var(--danger-dim)", color: "var(--danger)", borderRadius: "var(--radius-sm)", border: "1px solid var(--danger)" }}>
          ⚠️ {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
          Loading multi-channel marketing performance...
        </div>
      )}

      {data && (
        <>
          {/* ── Executive KPI Summary Ribbon ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
              marginTop: "0.5rem",
            }}
          >
            {/* KPI 1: Ad Spend */}
            <div
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1.25rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                <span>TOTAL AD SPEND</span>
                <span>💸</span>
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--ink)", marginTop: "0.4rem" }}>
                ${data.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ marginTop: "0.4rem", fontSize: "0.82rem", color: "var(--muted)" }}>
                Blended CPC: <strong style={{ color: "var(--ink)" }}>${data.blendedCpc.toFixed(2)}</strong> · CPL: <strong style={{ color: "var(--ink)" }}>${data.blendedCpl.toFixed(2)}</strong>
              </div>
            </div>

            {/* KPI 2: Attributed ARR / MRR */}
            <div
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1.25rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                <span>ATTRIBUTED ARR / MRR</span>
                <span>🚀</span>
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--accent)", marginTop: "0.4rem" }}>
                ${data.totalAttributedArr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--muted)", marginLeft: "0.4rem" }}>
                  / ${Math.round(data.totalAttributedMrr).toLocaleString()} mo
                </span>
              </div>
              <div style={{ marginTop: "0.4rem", fontSize: "0.82rem", color: "var(--muted)" }}>
                From <strong style={{ color: "var(--ink)" }}>{data.totalConversions}</strong> paying subscribers converted
              </div>
            </div>

            {/* KPI 3: Blended CAC */}
            <div
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1.25rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                <span>BLENDED CAC</span>
                <span>🎯</span>
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--ink)", marginTop: "0.4rem" }}>
                ${data.blendedCac.toFixed(2)}
              </div>
              <div style={{ marginTop: "0.4rem", fontSize: "0.82rem", color: "var(--muted)" }}>
                Payback Period: <strong style={{ color: "#22c55e" }}>&lt; 0.5 months</strong> (Avg ARPU $58.50)
              </div>
            </div>

            {/* KPI 4: Blended ROAS */}
            <div
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1.25rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                <span>ANNUALIZED ROAS</span>
                <span>⚡</span>
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#22c55e", marginTop: "0.4rem" }}>
                {data.blendedRoas.toFixed(1)}x
              </div>
              <div style={{ marginTop: "0.4rem", fontSize: "0.82rem", color: "var(--muted)" }}>
                <span style={{ padding: "0.15rem 0.4rem", backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#22c55e", borderRadius: 4, fontWeight: 600 }}>
                  High-Margin SaaS Organic &amp; Paid Blend
                </span>
              </div>
            </div>
          </div>

          {/* ── Channel Attribution Breakdown Matrix ── */}
          <div
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
                  Channel Attribution &amp; Performance
                </h2>
                <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                  Direct conversion funnel metrics per acquisition channel.
                </p>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Acquisition Channel</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>Spend</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>Clicks / Impr</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>CTR</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>Leads (CPL)</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>Subs (CAC)</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>Conv %</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>Attributed ARR</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>ROAS &amp; Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((src) => {
                    const badgeBg =
                      src.badge === "viral"
                        ? "rgba(168, 85, 247, 0.2)"
                        : src.badge === "high_performing"
                        ? "rgba(34, 197, 94, 0.2)"
                        : src.badge === "healthy"
                        ? "rgba(59, 130, 246, 0.2)"
                        : src.badge === "needs_optimization"
                        ? "rgba(234, 179, 8, 0.2)"
                        : "rgba(148, 163, 184, 0.15)";
                    const badgeColor =
                      src.badge === "viral"
                        ? "#c084fc"
                        : src.badge === "high_performing"
                        ? "#4ade80"
                        : src.badge === "healthy"
                        ? "#60a5fa"
                        : src.badge === "needs_optimization"
                        ? "#facc15"
                        : "#94a3b8";

                    return (
                      <tr key={src.channel} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "0.85rem 0.5rem", fontWeight: 600, color: "var(--ink)" }}>
                          <span style={{ marginRight: "0.5rem" }}>{src.icon}</span>
                          {src.label}
                        </td>
                        <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", color: "var(--ink)" }}>
                          ${src.spend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", color: "var(--muted)" }}>
                          <span style={{ color: "var(--ink)", fontWeight: 500 }}>{src.clicks.toLocaleString()}</span>
                          <span style={{ fontSize: "0.75rem", display: "block" }}>{src.impressions.toLocaleString()} imp</span>
                        </td>
                        <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", color: "var(--muted)" }}>
                          {src.ctr.toFixed(1)}%
                        </td>
                        <td style={{ padding: "0.85rem 0.5rem", textAlign: "right" }}>
                          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{src.leads}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                            {src.spend > 0 ? `$${src.cpl.toFixed(2)}` : "$0.00"}
                          </span>
                        </td>
                        <td style={{ padding: "0.85rem 0.5rem", textAlign: "right" }}>
                          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{src.conversions}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                            {src.spend > 0 ? `$${src.cac.toFixed(2)}` : "Free"}
                          </span>
                        </td>
                        <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", color: "var(--ink)" }}>
                          {src.convRate.toFixed(1)}%
                        </td>
                        <td style={{ padding: "0.85rem 0.5rem", textAlign: "right", fontWeight: 700, color: "var(--ink)" }}>
                          ${src.attributedArr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: "0.85rem 0.5rem", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.25rem 0.6rem",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor: badgeBg,
                              color: badgeColor,
                            }}
                          >
                            {src.badgeLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Active Campaigns & Spend Management ── */}
          <div
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
                  Active Marketing Campaigns
                </h2>
                <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                  Manage live campaigns, budgets, and track individual performance.
                </p>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Search campaign name / UTM..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-sunken)",
                    color: "var(--ink)",
                    fontSize: "0.85rem",
                    width: "220px",
                  }}
                />

                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-sunken)",
                    color: "var(--ink)",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="all">All Channels</option>
                  {CHANNEL_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredCampaigns.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                No campaigns match your filter.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "0.85rem" }}>
                {filteredCampaigns.map((c) => {
                  const cpl = c.leadsCount > 0 ? (c.spend / c.leadsCount).toFixed(2) : "0.00";
                  const cac = c.conversions > 0 ? (c.spend / c.conversions).toFixed(2) : "0.00";
                  const attributedArr = Math.round(c.conversions * 58.5 * 12);
                  const roas = c.spend > 0 ? (attributedArr / c.spend).toFixed(1) : "Viral";

                  return (
                    <div
                      key={c.id}
                      style={{
                        padding: "1rem 1.25rem",
                        backgroundColor: "var(--surface-sunken)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "1rem",
                      }}
                    >
                      <div style={{ flex: "1 1 300px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <strong style={{ fontSize: "0.98rem", color: "var(--ink)" }}>{c.name}</strong>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              padding: "0.15rem 0.45rem",
                              borderRadius: 4,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              backgroundColor: c.status === "active" ? "rgba(34, 197, 94, 0.2)" : "rgba(148, 163, 184, 0.2)",
                              color: c.status === "active" ? "#4ade80" : "#94a3b8",
                            }}
                          >
                            {c.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.3rem" }}>
                          Channel: <span style={{ color: "var(--ink)" }}>{c.channel}</span> · UTM: <code style={{ color: "var(--accent)" }}>{c.utmCampaign || "direct"}</code>
                          {c.notes && (
                            <span style={{ display: "block", marginTop: "0.2rem", fontStyle: "italic" }}>
                              {c.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Performance Metric Pills */}
                      <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase" }}>Spend</div>
                          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>${c.spend.toLocaleString()}</div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase" }}>Leads (CPL)</div>
                          <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>
                            {c.leadsCount} <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>(${cpl})</span>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase" }}>Paid Subs (CAC)</div>
                          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent)" }}>
                            {c.conversions} <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>(${cac})</span>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase" }}>Attributed ARR</div>
                          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#22c55e" }}>${attributedArr.toLocaleString()}</div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase" }}>ROAS</div>
                          <div style={{ fontSize: "1rem", fontWeight: 700, color: roas === "Viral" || Number(roas) >= 4 ? "#22c55e" : "var(--ink)" }}>
                            {roas === "Viral" ? "Viral (∞)" : `${roas}x`}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                            onClick={() => handleToggleStatus(c)}
                            title={c.status === "active" ? "Pause campaign" : "Activate campaign"}
                          >
                            {c.status === "active" ? "⏸️ Pause" : "▶️ Resume"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                            onClick={() => handleOpenEdit(c)}
                            title="Edit campaign & spend"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", color: "var(--danger)" }}
                            onClick={() => handleDeleteCampaign(c)}
                            title="Delete campaign"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Built-In UTM Campaign Link Generator & Recent Attributed Conversions ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1rem" }}>
            {/* UTM Link Generator */}
            <div
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>🔗</span>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                  UTM Campaign Link Builder
                </h3>
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 1rem" }}>
                Generate accurately tagged URLs for ads, title portals, influencers, and community deals.
              </p>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    Target Landing Page URL
                  </label>
                  <input
                    type="text"
                    value={utmUrl}
                    onChange={(e) => setUtmUrl(e.target.value)}
                    placeholder="https://revzenta.com/start"
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                      UTM Source
                    </label>
                    <select
                      value={utmSource}
                      onChange={(e) => setUtmSource(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.45rem 0.6rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface-sunken)",
                        color: "var(--ink)",
                        fontSize: "0.85rem",
                      }}
                    >
                      <option value="google">google</option>
                      <option value="facebook">facebook</option>
                      <option value="instagram">instagram</option>
                      <option value="title_portal">title_portal (Viral Loop)</option>
                      <option value="subto_community">subto_community</option>
                      <option value="biggerpockets">biggerpockets</option>
                      <option value="youtube">youtube</option>
                      <option value="linkedin">linkedin</option>
                      <option value="email_outbound">email_outbound</option>
                      <option value="direct">direct</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                      UTM Medium
                    </label>
                    <select
                      value={utmMedium}
                      onChange={(e) => setUtmMedium(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.45rem 0.6rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface-sunken)",
                        color: "var(--ink)",
                        fontSize: "0.85rem",
                      }}
                    >
                      <option value="cpc">cpc (Search Ad)</option>
                      <option value="paid_social">paid_social (Meta Video/Feed)</option>
                      <option value="referral">referral (Title Officer loop)</option>
                      <option value="partner">partner (Community Deal)</option>
                      <option value="organic">organic (Content/SEO)</option>
                      <option value="email">email</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    UTM Campaign Name
                  </label>
                  <input
                    type="text"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    placeholder="search_wholesale_crm"
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                {/* Generated Output */}
                <div style={{ marginTop: "0.5rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    Tagged Tracking Link
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      value={generatedUtmUrl}
                      style={{
                        flex: 1,
                        padding: "0.5rem 0.75rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--accent)",
                        backgroundColor: "var(--surface-sunken)",
                        color: "var(--ink)",
                        fontSize: "0.8rem",
                        fontFamily: "monospace",
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCopyUtm}
                      style={{ whiteSpace: "nowrap", padding: "0.5rem 1rem", fontWeight: 600 }}
                    >
                      {copiedUtm ? "✅ Copied!" : "📋 Copy Link"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Attributed Conversions Feed */}
            <div
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>⚡</span>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                  Recent Attributed Conversions
                </h3>
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 1rem" }}>
                Live feed of verified paying subscriber signups matched to marketing sources.
              </p>

              <div style={{ display: "grid", gap: "0.6rem", maxHeight: 310, overflowY: "auto" }}>
                {data.recentConversions.map((conv) => {
                  const tierColor =
                    conv.tier === "scale" ? "#a855f7" : conv.tier === "pro" ? "var(--accent)" : "#3b82f6";

                  return (
                    <div
                      key={conv.id}
                      style={{
                        padding: "0.65rem 0.85rem",
                        backgroundColor: "var(--surface-sunken)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--ink)" }}>
                          {conv.subscriberName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                          Via <span style={{ color: "var(--ink)", fontWeight: 500 }}>{conv.channelLabel}</span> · {conv.date}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.15rem 0.45rem",
                            borderRadius: 4,
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            backgroundColor: `rgba(0, 168, 159, 0.15)`,
                            color: tierColor,
                            marginBottom: "0.2rem",
                          }}
                        >
                          {conv.tier}
                        </span>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)" }}>
                          +${conv.mrr}/mo
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modal: Log Ad Spend / New Campaign ── */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              width: "100%",
              maxWidth: 600,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                {editingCampaign ? "Edit Marketing Campaign & Spend" : "➕ Log Ad Spend / New Campaign"}
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.25rem 0.5rem" }}
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ padding: "0.75rem", backgroundColor: "var(--danger-dim)", color: "var(--danger)", borderRadius: "var(--radius-sm)", marginBottom: "1rem", fontSize: "0.85rem" }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSaveCampaign} style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.3rem" }}>
                  Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Google Search — Subject-To Underwriting"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-sunken)",
                    color: "var(--ink)",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.3rem" }}>
                    Acquisition Channel
                  </label>
                  <select
                    value={formChannel}
                    onChange={(e) => setFormChannel(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.9rem",
                    }}
                  >
                    {CHANNEL_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.3rem" }}>
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <option value="active">Active (Running)</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Spend and Performance Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.5rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    Ad Spend ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formSpend}
                    onChange={(e) => setFormSpend(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    Impressions
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formImpressions}
                    onChange={(e) => setFormImpressions(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    Clicks
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formClicks}
                    onChange={(e) => setFormClicks(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    Leads Captured
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formLeads}
                    onChange={(e) => setFormLeads(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    Paid Subs
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formConversions}
                    onChange={(e) => setFormConversions(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>

              {/* UTM Tags */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    UTM Source
                  </label>
                  <input
                    type="text"
                    value={formUtmSource}
                    onChange={(e) => setFormUtmSource(e.target.value)}
                    placeholder="google"
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    UTM Medium
                  </label>
                  <input
                    type="text"
                    value={formUtmMedium}
                    onChange={(e) => setFormUtmMedium(e.target.value)}
                    placeholder="cpc"
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                    UTM Campaign
                  </label>
                  <input
                    type="text"
                    value={formUtmCampaign}
                    onChange={(e) => setFormUtmCampaign(e.target.value)}
                    placeholder="wholesale_crm_2026"
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-sunken)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>
                  Notes &amp; Strategy
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Targeting creative finance and wholesale real estate operators..."
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-sunken)",
                    color: "var(--ink)",
                    fontSize: "0.85rem",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={formSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSaving}
                >
                  {formSaving ? "Saving..." : editingCampaign ? "Update Campaign" : "Log Campaign Spend"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
