import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import PropertyImage from "./PropertyImage";
import type { Client, PropertyDealExplanation } from "./types";

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

// Helpers to extract property search fields from Client customFields
function getField(c: Client, name: string): string {
  if (!c.customFields || !Array.isArray(c.customFields)) return "";
  const match = c.customFields.find((f) => f.name.toLowerCase() === name.toLowerCase());
  return match?.value || "";
}

function getFieldContains(c: Client, substr: string): string {
  if (!c.customFields || !Array.isArray(c.customFields)) return "";
  const match = c.customFields.find((f) => f.name.toLowerCase().includes(substr.toLowerCase()));
  return match?.value || "";
}

interface ParsedPropertyDetails {
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  latitude: number | null;
  longitude: number | null;
  propertyClass: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  yearBuilt: string;
  lotSize: string;
  stories: string;
  garageSpaces: string;
  apn: string;
  estimatedValue: string;
  estimatedEquity: string;
  equityPercent: string;
  openMortgage: string;
  estimatedRent: string;
  valuationRange: string;
  taxAssessed: string;
  lastSalePrice: string;
  lastSaleDate: string;
  opportunityScore: number | null;
  opportunityReasons: string;
  distressIndicators: string[];
  ownerOccupied: string;
  dataSource: string;
}

function parsePropertyDetails(c: Client): ParsedPropertyDetails {
  const address = c.address || c.companyName || "Untitled Property";
  const city = c.city || "";
  const state = c.state || "";
  const zip = c.zip || "";
  const county = getField(c, "County");
  const latStr = getField(c, "Latitude");
  const lngStr = getField(c, "Longitude");
  const latitude = latStr ? Number(latStr) : null;
  const longitude = lngStr ? Number(lngStr) : null;

  const propertyClass = getField(c, "Property Class") || (c.clientType === "multi_family" ? "Multi-Family" : "Single Family");
  const bedrooms = getField(c, "Bedrooms") || getField(c, "Beds") || "";
  const bathrooms = getField(c, "Bathrooms") || getField(c, "Baths") || "";
  const sqft = getField(c, "Square Footage") || getField(c, "Sqft") || "";
  const yearBuilt = getField(c, "Year Built") || "";
  const lotSize = getField(c, "Lot Size") || "";
  const stories = getField(c, "Stories") || "";
  const garageSpaces = getField(c, "Garage Spaces") || "";
  const apn = getField(c, "APN") || "";

  const estimatedValue = getField(c, "Estimated Value") || (c.dealValue > 0 ? `$${c.dealValue.toLocaleString()}` : "—");
  const estimatedEquity = getField(c, "Estimated Equity") || "—";
  let equityPercent = getField(c, "Equity Percent");
  if (!equityPercent && c.dealValue > 0 && estimatedEquity !== "—") {
    const rawEq = Number(estimatedEquity.replace(/[^0-9.]/g, "")) || 0;
    if (rawEq > 0) {
      equityPercent = `${Math.min(100, Math.round((rawEq / c.dealValue) * 100))}%`;
    }
  }

  const openMortgage = getField(c, "Open Mortgage Balance") || "—";
  const estimatedRent = getField(c, "Estimated Rent") || "";
  const valuationRange = getField(c, "Valuation Range") || "";
  const taxAssessed = getFieldContains(c, "tax assessed") || "—";
  const lastSalePrice = getFieldContains(c, "last sale price") || "—";
  const lastSaleDate = getFieldContains(c, "last sale date") || "";

  const scoreStr = getField(c, "Opportunity Score");
  const scoreNum = scoreStr ? parseInt(scoreStr.replace(/[^0-9]/g, ""), 10) : null;
  const opportunityScore = Number.isFinite(scoreNum) ? scoreNum : null;
  const opportunityReasons = getField(c, "Opportunity Reasons");

  const rawDistress = getField(c, "Distress Indicators");
  const distressIndicators: string[] = [];
  if (rawDistress) {
    rawDistress.split(",").map((s) => s.trim()).filter(Boolean).forEach((d) => {
      if (!distressIndicators.includes(d)) distressIndicators.push(d);
    });
  }
  // Check individual boolean flags if present
  if (getField(c, "Is Absentee") === "true" && !distressIndicators.includes("Absentee Owner")) distressIndicators.push("Absentee Owner");
  if (getField(c, "Is Vacant") === "true" && !distressIndicators.includes("Vacant Property")) distressIndicators.push("Vacant Property");
  if (getField(c, "Is Tax Delinquent") === "true" && !distressIndicators.includes("Tax Delinquent")) distressIndicators.push("Tax Delinquent");
  if (getField(c, "Is Pre-Foreclosure") === "true" && !distressIndicators.includes("Pre-Foreclosure")) distressIndicators.push("Pre-Foreclosure");
  if (getField(c, "Is Foreclosure") === "true" && !distressIndicators.includes("Foreclosure")) distressIndicators.push("Foreclosure");
  if (getField(c, "Is Probate") === "true" && !distressIndicators.includes("Probate")) distressIndicators.push("Probate");
  if (getField(c, "Is Bankruptcy") === "true" && !distressIndicators.includes("Bankruptcy")) distressIndicators.push("Bankruptcy");
  if (getField(c, "Has Liens") === "true" && !distressIndicators.includes("Open Liens")) distressIndicators.push("Open Liens");
  if (getField(c, "Has Code Violations") === "true" && !distressIndicators.includes("Code Violations")) distressIndicators.push("Code Violations");

  const ownerOccupied = getField(c, "Owner Occupied") || (distressIndicators.some((d) => d.toLowerCase().includes("absentee")) ? "No (Absentee)" : "");
  const dataSource = getField(c, "Data Source") || c.leadSource || "Unified";

  return {
    address,
    city,
    state,
    zip,
    county,
    latitude,
    longitude,
    propertyClass,
    bedrooms,
    bathrooms,
    sqft,
    yearBuilt,
    lotSize,
    stories,
    garageSpaces,
    apn,
    estimatedValue,
    estimatedEquity,
    equityPercent,
    openMortgage,
    estimatedRent,
    valuationRange,
    taxAssessed,
    lastSalePrice,
    lastSaleDate,
    opportunityScore,
    opportunityReasons,
    distressIndicators,
    ownerOccupied,
    dataSource,
  };
}

function renderScoreBadge(score: number) {
  let bg = "rgba(16, 185, 129, 0.15)";
  let color = "#10b981";
  let border = "1px solid rgba(16, 185, 129, 0.3)";
  if (score >= 90) {
    bg = "rgba(16, 185, 129, 0.2)";
    color = "#10b981";
    border = "1px solid #10b981";
  } else if (score >= 75) {
    bg = "rgba(132, 204, 22, 0.15)";
    color = "#84cc16";
    border = "1px solid rgba(132, 204, 22, 0.4)";
  } else if (score >= 50) {
    bg = "rgba(245, 158, 11, 0.15)";
    color = "#f59e0b";
    border = "1px solid rgba(245, 158, 11, 0.4)";
  } else {
    bg = "rgba(239, 68, 68, 0.15)";
    color = "#ef4444";
    border = "1px solid rgba(239, 68, 68, 0.4)";
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        borderRadius: "6px",
        background: bg,
        color,
        border,
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      <span>🔥</span>
      <span>{score}/100 Score</span>
    </span>
  );
}

function renderDistressBadge(badge: string) {
  const b = badge.toLowerCase();
  let bg = "rgba(245, 158, 11, 0.15)";
  let color = "#f59e0b";

  if (b.includes("vacant") || b.includes("tax")) {
    bg = "rgba(239, 68, 68, 0.15)";
    color = "#ef4444";
  } else if (b.includes("foreclosure")) {
    bg = "rgba(220, 38, 38, 0.2)";
    color = "#f87171";
  } else if (b.includes("probate")) {
    bg = "rgba(168, 85, 247, 0.15)";
    color = "#c084fc";
  } else if (b.includes("bankruptcy") || b.includes("lien")) {
    bg = "rgba(225, 29, 72, 0.15)";
    color = "#fb7185";
  }

  return (
    <span
      key={badge}
      style={{
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "12px",
        background: bg,
        color,
        fontWeight: 600,
        display: "inline-block",
      }}
    >
      {badge}
    </span>
  );
}

export default function Opportunities({ onOpenCreativeHub }: { onOpenCreativeHub: (opportunity?: Client) => void }) {
  const [opportunities, setOpportunities] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // View state: Cards vs Table
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [distressFilter, setDistressFilter] = useState("all");
  const [loiFilter, setLoiFilter] = useState("all");

  // AI Deal Explanation Modal
  const [selectedPropertyForExplanation, setSelectedPropertyForExplanation] = useState<{
    client: Client;
    details: ParsedPropertyDetails;
  } | null>(null);
  const [explanation, setExplanation] = useState<PropertyDealExplanation | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  useEffect(() => {
    let active = true;
    api.clients()
      .then((response) => {
        if (!active) return;
        setOpportunities(response.clients.filter((client) => !client.archived && client.stage !== "Closing"));
        setLoading(false);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Unable to load opportunities.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
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
          const propAddr =
            opp.address && opp.companyName && opp.address !== opp.companyName
              ? `${opp.companyName} — ${opp.address}`
              : opp.address || opp.companyName || "Subject Property";
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

  const handleOpenAiDeal = async (opp: Client, details: ParsedPropertyDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPropertyForExplanation({ client: opp, details });
    setExplanation(null);
    setLoadingExplanation(true);
    try {
      const rawVal = opp.dealValue || Number(details.estimatedValue.replace(/[^0-9.]/g, "")) || 0;
      const rawEq = Number(details.estimatedEquity.replace(/[^0-9.]/g, "")) || 0;
      const propPayload = {
        id: opp.id,
        address_line1: details.address,
        city: details.city,
        state: details.state,
        zip: details.zip,
        county: details.county,
        latitude: details.latitude,
        longitude: details.longitude,
        property_type: details.propertyClass,
        estimated_value: rawVal,
        estimated_equity: rawEq,
        equity_percent: Number(details.equityPercent.replace(/[^0-9.]/g, "")) || (rawVal > 0 ? Math.round((rawEq / rawVal) * 100) : 0),
        bedrooms: Number(details.bedrooms) || undefined,
        bathrooms: Number(details.bathrooms) || undefined,
        square_feet: Number(details.sqft.replace(/[^0-9.]/g, "")) || undefined,
        year_built: Number(details.yearBuilt) || undefined,
        revzenta_opportunity_score: details.opportunityScore || 75,
        opportunity_score_reasons: details.opportunityReasons ? details.opportunityReasons.split(", ") : [],
        is_absentee_owner: details.distressIndicators.some((d) => d.toLowerCase().includes("absentee")),
        is_vacant: details.distressIndicators.some((d) => d.toLowerCase().includes("vacant")),
        tax_delinquent: details.distressIndicators.some((d) => d.toLowerCase().includes("tax")),
        is_pre_foreclosure: details.distressIndicators.some((d) => d.toLowerCase().includes("pre-foreclosure")),
        is_probate: details.distressIndicators.some((d) => d.toLowerCase().includes("probate")),
      };
      const res = await api.explainProperty({ property: propPayload });
      setExplanation(res.explanation);
    } catch (err: any) {
      console.error("AI Deal Analysis failed:", err);
    } finally {
      setLoadingExplanation(false);
    }
  };

  // Filter and search logic
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      const details = parsePropertyDetails(opp);

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullAddr = `${details.address} ${details.city} ${details.state} ${details.zip} ${details.county}`.toLowerCase();
        const contact = (opp.contactName || opp.companyName || "").toLowerCase();
        if (!fullAddr.includes(q) && !contact.includes(q)) return false;
      }

      // Stage filter
      if (stageFilter !== "all") {
        if ((opp.stage || "").toLowerCase() !== stageFilter.toLowerCase()) return false;
      }

      // Distress filter
      if (distressFilter !== "all") {
        const match = details.distressIndicators.some((d) =>
          d.toLowerCase().includes(distressFilter.toLowerCase())
        );
        if (!match) return false;
      }

      // LOI filter
      if (loiFilter !== "all") {
        const loi = getLoiStatus(opp);
        if (loi.toLowerCase() !== loiFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [opportunities, searchQuery, stageFilter, distressFilter, loiFilter]);

  const uniqueStages = useMemo(() => {
    const set = new Set<string>();
    opportunities.forEach((o) => {
      if (o.stage) set.add(o.stage);
    });
    return Array.from(set);
  }, [opportunities]);

  return (
    <section style={{ padding: "24px", maxWidth: "1380px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>🎯 Opportunities</h1>
            <span style={{ fontSize: "12px", padding: "3px 9px", borderRadius: "12px", background: "rgba(214, 255, 63, 0.15)", color: "var(--lime, #d6ff3f)", fontWeight: 700 }}>
              {filteredOpportunities.length} Active Deals
            </span>
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--muted, #94a3b8)", fontSize: "14px" }}>
            Active wholesale properties converted from Property Search with complete valuation, equity, distress, and physical intelligence.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* View Mode Toggle */}
          <div style={{ display: "inline-flex", background: "rgba(0,0,0,0.25)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-color, #334155)" }}>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: viewMode === "cards" ? "var(--lime, #d6ff3f)" : "transparent",
                color: viewMode === "cards" ? "#0f172a" : "var(--muted, #94a3b8)",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <span>⊞</span>
              <span>Cards View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: viewMode === "table" ? "var(--lime, #d6ff3f)" : "transparent",
                color: viewMode === "table" ? "#0f172a" : "var(--muted, #94a3b8)",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <span>☰</span>
              <span>Table View</span>
            </button>
          </div>

          <button type="button" className="btn btn-primary" onClick={() => onOpenCreativeHub()}>
            + New Deal
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "14px 16px",
          background: "var(--card-bg, #1e293b)",
          border: "1px solid var(--border-color, #334155)",
          borderRadius: "10px",
          marginBottom: "24px",
        }}
      >
        <div style={{ flex: "1 1 240px", position: "relative" }}>
          <input
            type="text"
            className="input"
            placeholder="Search address, city, county, or owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", fontSize: "13px", padding: "8px 12px" }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {/* Stage Filter */}
          <select
            className="input"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{ fontSize: "13px", padding: "8px 10px" }}
          >
            <option value="all">All Stages</option>
            {uniqueStages.map((s) => (
              <option key={s} value={s}>
                Stage: {s}
              </option>
            ))}
          </select>

          {/* Distress Filter */}
          <select
            className="input"
            value={distressFilter}
            onChange={(e) => setDistressFilter(e.target.value)}
            style={{ fontSize: "13px", padding: "8px 10px" }}
          >
            <option value="all">All Distress Types</option>
            <option value="absentee">Absentee Owner</option>
            <option value="vacant">Vacant Property</option>
            <option value="tax">Tax Delinquent</option>
            <option value="foreclosure">Pre / Foreclosure</option>
            <option value="probate">Probate</option>
            <option value="liens">Open Liens</option>
          </select>

          {/* LOI Filter */}
          <select
            className="input"
            value={loiFilter}
            onChange={(e) => setLoiFilter(e.target.value)}
            style={{ fontSize: "13px", padding: "8px 10px" }}
          >
            <option value="all">All LOI Status</option>
            <option value="sent">LOI: Sent</option>
            <option value="unsent">LOI: Unsent</option>
          </select>

          {(searchQuery || stageFilter !== "all" || distressFilter !== "all" || loiFilter !== "all") && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearchQuery("");
                setStageFilter("all");
                setDistressFilter("all");
                setLoiFilter("all");
              }}
              style={{ fontSize: "12px" }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted, #94a3b8)" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>⏳</div>
          <div>Loading converted opportunities with intelligence dossiers...</div>
        </div>
      )}

      {error && (
        <div role="alert" style={{ padding: "16px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#f87171", marginBottom: "20px" }}>
          {error}
        </div>
      )}

      {!loading && !error && filteredOpportunities.length === 0 && (
        <div style={{ padding: "48px 24px", border: "1px dashed var(--border-color, #334155)", borderRadius: "12px", textAlign: "center", color: "var(--muted, #94a3b8)", background: "var(--card-bg, #1e293b)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "var(--ink, #f8fafc)" }}>No matching opportunities</h3>
          <p style={{ margin: 0, fontSize: "13px", maxWidth: "500px", marginInline: "auto" }}>
            Convert properties from the <strong>Property Search</strong> tab or create a new deal in <strong>Creative Hub</strong> to track them here with complete property data.
          </p>
        </div>
      )}

      {/* ── View 1: CARDS GRID VIEW (Matching Property Search) ────────────────────── */}
      {!loading && !error && filteredOpportunities.length > 0 && viewMode === "cards" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "18px" }}>
          {filteredOpportunities.map((opportunity) => {
            const details = parsePropertyDetails(opportunity);
            const loiStatus = getLoiStatus(opportunity);
            const isSent = loiStatus === "Sent";

            return (
              <div
                key={opportunity.id}
                style={{
                  background: "var(--card-bg, #1e293b)",
                  border: "1px solid var(--border-color, #334155)",
                  borderRadius: "12px",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                }}
              >
                <div>
                  {/* Property Street View Photo */}
                  <div style={{ marginBottom: "12px", borderRadius: "8px", overflow: "hidden" }}>
                    <PropertyImage
                      address={details.address}
                      city={details.city}
                      state={details.state}
                      zip={details.zip}
                      latitude={details.latitude}
                      longitude={details.longitude}
                      mode="street"
                      streetHeight={180}
                    />
                  </div>

                  {/* Top Bar: Opportunity Score Badge + Property Class + Stage */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {details.opportunityScore != null ? (
                        renderScoreBadge(details.opportunityScore)
                      ) : (
                        <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "var(--muted, #94a3b8)", fontWeight: 600 }}>
                          Lead #{opportunity.id}
                        </span>
                      )}
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {details.propertyClass}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "10px",
                        background: "rgba(56, 189, 248, 0.15)",
                        color: "#38bdf8",
                      }}
                    >
                      {opportunity.stage || "Prospect"}
                    </span>
                  </div>

                  {/* Address & County */}
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700, color: "var(--ink, #f8fafc)" }}>
                    {details.address}
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--muted, #94a3b8)", marginBottom: "12px" }}>
                    {[details.city, details.state, details.zip].filter(Boolean).join(", ") || "No city/state"}
                    {details.county ? ` · ${details.county} County` : ""}
                  </div>

                  {/* Financial Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      background: "rgba(0,0,0,0.2)",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>Est. Value</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc" }}>
                        {details.estimatedValue}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>Est. Equity</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "#10b981" }}>
                        {details.equityPercent ? `${details.equityPercent} ` : ""}
                        ({details.estimatedEquity})
                      </div>
                    </div>
                    {details.openMortgage !== "—" && (
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>Mortgage Balance</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#f59e0b" }}>
                          {details.openMortgage}
                        </div>
                      </div>
                    )}
                    {details.estimatedRent && (
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>Est. Rent</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#38bdf8" }}>
                          {details.estimatedRent}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Physical Specs Line */}
                  <div style={{ fontSize: "12.5px", color: "var(--muted, #cbd5e1)", marginBottom: "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {details.bedrooms && <span>{details.bedrooms} Beds · </span>}
                    {details.bathrooms && <span>{details.bathrooms} Baths · </span>}
                    {details.sqft && <span>{details.sqft} · </span>}
                    {details.yearBuilt && <span>Built {details.yearBuilt} · </span>}
                    {details.apn && <span style={{ color: "var(--muted, #94a3b8)", fontSize: "11px" }}>APN: {details.apn}</span>}
                  </div>

                  {/* Distress Badges */}
                  {details.distressIndicators.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                      {details.distressIndicators.map((d) => renderDistressBadge(d))}
                    </div>
                  )}

                  {/* Opportunity Reasons / Intelligence Highlights */}
                  {details.opportunityReasons && (
                    <div style={{ fontSize: "11.5px", color: "var(--muted, #94a3b8)", marginBottom: "12px", background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: "6px" }}>
                      <strong>Score Insights:</strong> {details.opportunityReasons}
                    </div>
                  )}

                  {/* Owner & Provenance Tag */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", fontSize: "11px", color: "var(--muted, #94a3b8)" }}>
                    <span>👤 Owner: {opportunity.contactName || "Recorded Owner"}</span>
                    <span>📡 {details.dataSource}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--border-color, #334155)", paddingTop: "12px", flexWrap: "wrap" }}>
                  {/* LOI Toggle Button */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleLoi(opportunity, e)}
                    title={`LOI: ${loiStatus}. Click to toggle.`}
                    style={{
                      flex: "1 1 90px",
                      display: "inline-flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: isSent ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(148, 163, 184, 0.3)",
                      backgroundColor: isSent ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.1)",
                      color: isSent ? "#10b981" : "var(--muted, #94a3b8)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{isSent ? "✓" : "○"}</span>
                    <span>LOI: {loiStatus}</span>
                  </button>

                  {/* AI Deal Intelligence */}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: "1 1 90px", fontSize: "12px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "4px" }}
                    onClick={(e) => handleOpenAiDeal(opportunity, details, e)}
                  >
                    <span>🧠</span>
                    <span>AI Deal</span>
                  </button>

                  {/* Creative Hub Action */}
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ flex: "1 1 120px", fontSize: "12px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "4px" }}
                    onClick={() => onOpenCreativeHub(opportunity)}
                  >
                    <span>⚡</span>
                    <span>Creative Hub</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── View 2: EXPANDABLE TABLE VIEW ────────────────────────────────────────── */}
      {!loading && !error && filteredOpportunities.length > 0 && viewMode === "table" && (
        <div style={{ overflowX: "auto", border: "1px solid var(--border-color, #334155)", borderRadius: "10px", background: "var(--card-bg, #1e293b)" }}>
          <table className="table" style={{ width: "100%", minWidth: "960px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--border-color, #334155)" }}>
                <th style={{ width: "32px", padding: "12px 10px" }}></th>
                <th style={{ textAlign: "left", padding: "12px 10px" }}>Property &amp; Location</th>
                <th style={{ textAlign: "left", padding: "12px 10px" }}>Stage</th>
                <th style={{ textAlign: "center", padding: "12px 10px" }}>Score</th>
                <th style={{ textAlign: "left", padding: "12px 10px" }}>Beds / Baths / SqFt</th>
                <th style={{ textAlign: "right", padding: "12px 10px" }}>Est. Value</th>
                <th style={{ textAlign: "right", padding: "12px 10px" }}>Est. Equity</th>
                <th style={{ textAlign: "left", padding: "12px 10px" }}>Distress</th>
                <th style={{ textAlign: "center", padding: "12px 10px" }}>LOI</th>
                <th style={{ textAlign: "right", padding: "12px 10px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpportunities.map((opportunity) => {
                const details = parsePropertyDetails(opportunity);
                const loiStatus = getLoiStatus(opportunity);
                const isSent = loiStatus === "Sent";
                const isExpanded = expandedId === opportunity.id;

                return (
                  <tr key={opportunity.id} style={{ borderBottom: "1px solid var(--border-color, #334155)" }}>
                    {/* Expand Toggle */}
                    <td style={{ padding: "13px 10px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : opportunity.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--muted, #94a3b8)",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                        title={isExpanded ? "Collapse Property Details" : "Expand Property Details"}
                      >
                        {isExpanded ? "▼" : "▶"}
                      </button>
                    </td>

                    {/* Property & Address */}
                    <td style={{ padding: "13px 10px" }}>
                      <div
                        style={{ fontWeight: 700, color: "var(--ink, #f8fafc)", cursor: "pointer" }}
                        onClick={() => setExpandedId(isExpanded ? null : opportunity.id)}
                      >
                        {details.address}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted, #94a3b8)" }}>
                        {[details.city, details.state, details.zip].filter(Boolean).join(", ")}
                        {details.county ? ` · ${details.county} County` : ""}
                      </div>
                    </td>

                    {/* Stage */}
                    <td style={{ padding: "13px 10px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "10px",
                          background: "rgba(56, 189, 248, 0.15)",
                          color: "#38bdf8",
                        }}
                      >
                        {opportunity.stage || "Prospect"}
                      </span>
                    </td>

                    {/* Opportunity Score */}
                    <td style={{ padding: "13px 10px", textAlign: "center" }}>
                      {details.opportunityScore != null ? renderScoreBadge(details.opportunityScore) : "—"}
                    </td>

                    {/* Specs */}
                    <td style={{ padding: "13px 10px", fontSize: "12.5px" }}>
                      {details.bedrooms ? `${details.bedrooms}b ` : "— "}
                      {details.bathrooms ? `/ ${details.bathrooms}ba ` : ""}
                      {details.sqft ? `· ${details.sqft}` : ""}
                    </td>

                    {/* Deal Value */}
                    <td style={{ padding: "13px 10px", textAlign: "right", fontWeight: 700, color: "#f8fafc" }}>
                      {details.estimatedValue}
                    </td>

                    {/* Equity */}
                    <td style={{ padding: "13px 10px", textAlign: "right", fontWeight: 700, color: "#10b981" }}>
                      {details.equityPercent ? `${details.equityPercent} ` : ""}
                      <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--muted, #94a3b8)" }}>
                        ({details.estimatedEquity})
                      </span>
                    </td>

                    {/* Distress Badges */}
                    <td style={{ padding: "13px 10px" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxWidth: "180px" }}>
                        {details.distressIndicators.length > 0 ? (
                          details.distressIndicators.slice(0, 2).map((d) => renderDistressBadge(d))
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>None</span>
                        )}
                        {details.distressIndicators.length > 2 && (
                          <span style={{ fontSize: "10px", color: "var(--muted, #94a3b8)" }}>
                            +{details.distressIndicators.length - 2}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* LOI Toggle */}
                    <td style={{ padding: "13px 10px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleLoi(opportunity, e)}
                        title={`LOI: ${loiStatus}. Click to toggle.`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "3px 8px",
                          borderRadius: "9999px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                          border: isSent ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(148, 163, 184, 0.3)",
                          backgroundColor: isSent ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.1)",
                          color: isSent ? "#10b981" : "var(--muted, #94a3b8)",
                        }}
                      >
                        <span>{isSent ? "✓" : "○"}</span>
                        <span>{loiStatus}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "13px 10px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={(e) => handleOpenAiDeal(opportunity, details, e)}
                        >
                          🧠 AI
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => onOpenCreativeHub(opportunity)}
                        >
                          Creative Hub
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Expandable Detail Accordion (Rendered below table if an opportunity is expanded) */}
          {expandedId && (
            <div style={{ padding: "18px 24px", background: "rgba(0,0,0,0.35)", borderTop: "2px solid var(--border-color, #334155)" }}>
              {(() => {
                const opp = opportunities.find((o) => o.id === expandedId);
                if (!opp) return null;
                const details = parsePropertyDetails(opp);

                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink, #f8fafc)" }}>
                          🏡 Full Property Intelligence Dossier: {details.address}
                        </h3>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted, #94a3b8)" }}>
                          All assessor, valuation, and distress data imported from Property Search.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setExpandedId(null)}
                      >
                        ✕ Close
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                      {/* Section 1: Physical Characteristics */}
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", marginBottom: "8px" }}>
                          🏡 Physical Characteristics
                        </div>
                        <div style={{ fontSize: "12.5px", display: "flex", flexDirection: "column", gap: "5px", color: "var(--ink, #f8fafc)" }}>
                          <div><strong>Layout:</strong> {details.bedrooms || "—"} Beds / {details.bathrooms || "—"} Baths</div>
                          <div><strong>Living Area:</strong> {details.sqft || "—"}</div>
                          <div><strong>Year Built:</strong> {details.yearBuilt || "—"}</div>
                          <div><strong>Property Class:</strong> {details.propertyClass}</div>
                          <div><strong>APN:</strong> {details.apn || "—"}</div>
                          <div><strong>County:</strong> {details.county || "—"}</div>
                          <div><strong>Lot Size:</strong> {details.lotSize || "—"}</div>
                          <div><strong>Stories:</strong> {details.stories || "—"}</div>
                          {details.garageSpaces && <div><strong>Garage Spaces:</strong> {details.garageSpaces}</div>}
                        </div>
                      </div>

                      {/* Section 2: Financial & Valuation Profile */}
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--lime, #d6ff3f)", textTransform: "uppercase", marginBottom: "8px" }}>
                          💰 Financial &amp; Equity Profile
                        </div>
                        <div style={{ fontSize: "12.5px", display: "flex", flexDirection: "column", gap: "5px", color: "var(--ink, #f8fafc)" }}>
                          <div><strong>Estimated Value:</strong> <span style={{ color: "var(--lime, #d6ff3f)", fontWeight: 700 }}>{details.estimatedValue}</span></div>
                          <div><strong>Estimated Equity:</strong> <span style={{ color: "#10b981", fontWeight: 700 }}>{details.estimatedEquity}</span> {details.equityPercent && `(${details.equityPercent})`}</div>
                          <div><strong>Mortgage Balance:</strong> <span style={{ color: "#f59e0b", fontWeight: 600 }}>{details.openMortgage}</span></div>
                          {details.estimatedRent && <div><strong>Estimated Rent:</strong> <span style={{ color: "#38bdf8", fontWeight: 600 }}>{details.estimatedRent}</span></div>}
                          {details.valuationRange && <div><strong>Valuation Range:</strong> {details.valuationRange}</div>}
                          <div><strong>Tax Assessed:</strong> {details.taxAssessed}</div>
                          <div><strong>Last Sale Price:</strong> {details.lastSalePrice}</div>
                          {details.lastSaleDate && <div><strong>Last Sale Date:</strong> {details.lastSaleDate}</div>}
                        </div>
                      </div>

                      {/* Section 3: Opportunity & Distress Indicators */}
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "#c084fc", textTransform: "uppercase", marginBottom: "8px" }}>
                          ⚡ Opportunity &amp; Distress
                        </div>
                        <div style={{ fontSize: "12.5px", display: "flex", flexDirection: "column", gap: "6px", color: "var(--ink, #f8fafc)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong>Opportunity Score:</strong>
                            {details.opportunityScore != null ? renderScoreBadge(details.opportunityScore) : "—"}
                          </div>
                          <div><strong>Score Insights:</strong> {details.opportunityReasons || "No specific distress points recorded"}</div>
                          <div>
                            <strong>Distress Badges:</strong>{" "}
                            {details.distressIndicators.length > 0 ? (
                              <div style={{ display: "inline-flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                                {details.distressIndicators.map((d) => renderDistressBadge(d))}
                              </div>
                            ) : (
                              "None detected"
                            )}
                          </div>
                          <div><strong>Owner Occupied:</strong> {details.ownerOccupied || "—"}</div>
                          <div><strong>Data Source:</strong> {details.dataSource}</div>
                        </div>
                      </div>

                      {/* Section 4: Owner & Outreach */}
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "#f43f5e", textTransform: "uppercase", marginBottom: "8px" }}>
                          👤 Owner &amp; Outreach
                        </div>
                        <div style={{ fontSize: "12.5px", display: "flex", flexDirection: "column", gap: "5px", color: "var(--ink, #f8fafc)" }}>
                          <div><strong>Owner Name:</strong> {opp.contactName || opp.companyName || "Property Owner"}</div>
                          <div><strong>Phone:</strong> {opp.phone || "No phone recorded"}</div>
                          <div><strong>Email:</strong> {opp.email || "No email recorded"}</div>
                          <div><strong>Stage:</strong> {opp.stage || "Prospect"}</div>
                          <div><strong>LOI Dispatched:</strong> {getLoiStatus(opp)}</div>
                          <div style={{ marginTop: "8px" }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ width: "100%", fontSize: "12px" }}
                              onClick={() => onOpenCreativeHub(opp)}
                            >
                              Open Deal in Creative Hub →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── AI Deal Analysis Modal ────────────────────────────────────────────── */}
      {selectedPropertyForExplanation && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "var(--card-bg, #1e293b)",
              border: "1px solid var(--border-color, #334155)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🧠</span>
                  <span>Revzenta Deal Intelligence</span>
                </h2>
                <div style={{ fontSize: "13px", color: "var(--muted, #94a3b8)" }}>
                  {selectedPropertyForExplanation.details.address}, {selectedPropertyForExplanation.details.city}, {selectedPropertyForExplanation.details.state}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedPropertyForExplanation(null)}
                style={{ padding: "4px 10px", fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            {/* Property Photos: Street View + Satellite */}
            <PropertyImage
              address={selectedPropertyForExplanation.details.address}
              city={selectedPropertyForExplanation.details.city}
              state={selectedPropertyForExplanation.details.state}
              zip={selectedPropertyForExplanation.details.zip}
              latitude={selectedPropertyForExplanation.details.latitude}
              longitude={selectedPropertyForExplanation.details.longitude}
              mode="both"
              satelliteHeight={200}
            />

            {loadingExplanation ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <div style={{ fontSize: "24px", marginBottom: "12px" }}>✨</div>
                <div>Analyzing property equity, market spread, and wholesale angles...</div>
              </div>
            ) : explanation ? (
              <div style={{ marginTop: "16px" }}>
                {/* Headline & Summary */}
                <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(139, 92, 246, 0.1)", border: "1px solid #8b5cf6", marginBottom: "18px" }}>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", color: "#c084fc" }}>
                    {explanation.headline}
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5" }}>
                    {explanation.summary}
                  </p>
                </div>

                {/* Score Breakdown */}
                <div style={{ marginBottom: "18px" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 600 }}>
                    Opportunity Score Breakdown ({explanation.opportunityScoreBreakdown.totalScore}/100)
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", textAlign: "center" }}>
                    <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color, #334155)" }}>
                      <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>Equity Cushion</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#10b981" }}>
                        {explanation.opportunityScoreBreakdown.equityScore}/35
                      </div>
                    </div>
                    <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color, #334155)" }}>
                      <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>Distress Factors</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#f59e0b" }}>
                        {explanation.opportunityScoreBreakdown.distressScore}/40
                      </div>
                    </div>
                    <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color, #334155)" }}>
                      <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>Valuation Spread</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#3b82f6" }}>
                        {explanation.opportunityScoreBreakdown.spreadScore}/25
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", marginTop: "8px", fontStyle: "italic" }}>
                    {explanation.opportunityScoreBreakdown.explanation}
                  </div>
                </div>

                {/* Strengths & Risks */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>✓</span>
                      <span>Key Deal Strengths</span>
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", lineHeight: "1.5" }}>
                      {explanation.keyStrengths.map((s, idx) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#f87171", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>⚠️</span>
                      <span>Risk Factors</span>
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", lineHeight: "1.5" }}>
                      {explanation.riskFactors.map((r, idx) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommended Strategies */}
                {explanation.recommendedStrategies && explanation.recommendedStrategies.length > 0 && (
                  <div style={{ marginBottom: "18px" }}>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 600 }}>
                      Recommended Wholesale &amp; Exit Strategies
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {explanation.recommendedStrategies.map((strat, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            background: "rgba(0,0,0,0.2)",
                            border: "1px solid var(--border-color, #334155)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--lime, #d6ff3f)" }}>{strat.strategy}</span>
                            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted, #94a3b8)" }}>
                              {strat.rationale}
                            </p>
                          </div>
                          <div style={{ textAlign: "right", marginLeft: "14px" }}>
                            <span style={{ fontSize: "14px", fontWeight: 700, color: "#10b981" }}>
                              {strat.suitabilityScore}%
                            </span>
                            <div style={{ fontSize: "10px", color: "var(--muted, #94a3b8)" }}>Suitability</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                {explanation.dataDisclaimer && (
                  <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", borderTop: "1px solid var(--border-color, #334155)", paddingTop: "10px" }}>
                    ℹ️ {explanation.dataDisclaimer}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
