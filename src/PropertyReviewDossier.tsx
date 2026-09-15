import React, { useState } from "react";
import type { Client, PropertyDealExplanation } from "./types";
import { api } from "./api";
import PropertyImage from "./PropertyImage";

export function getLoiStatus(opp: Client): "Sent" | "Unsent" {
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

export interface ParsedPropertyDetails {
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

export function parsePropertyDetails(c: Client): ParsedPropertyDetails {
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

export interface PropertyReviewDossierProps {
  property: Client;
  onPropertyUpdated?: (updated: Client) => void;
  titleBadge?: string;
  hideTopNav?: boolean;
  onBack?: () => void;
  backLabel?: string;
}

export default function PropertyReviewDossier({
  property,
  onPropertyUpdated,
  titleBadge,
  hideTopNav = false,
  onBack,
  backLabel = "Back",
}: PropertyReviewDossierProps) {
  const revDetails = parsePropertyDetails(property);
  const fullAddress = [revDetails.address, revDetails.city, revDetails.state, revDetails.zip]
    .filter(Boolean)
    .join(", ");
  const loiStatus = getLoiStatus(property);

  // AI Deal Explanation Modal state
  const [showAiModal, setShowAiModal] = useState(false);
  const [explanation, setExplanation] = useState<PropertyDealExplanation | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  const handleOpenAiDeal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAiModal(true);
    setExplanation(null);
    setLoadingExplanation(true);
    try {
      const rawVal = property.dealValue || Number(revDetails.estimatedValue.replace(/[^0-9.]/g, "")) || 0;
      const rawEq = Number(revDetails.estimatedEquity.replace(/[^0-9.]/g, "")) || 0;
      const propPayload = {
        id: property.id,
        address_line1: revDetails.address,
        city: revDetails.city,
        state: revDetails.state,
        zip: revDetails.zip,
        county: revDetails.county,
        latitude: revDetails.latitude,
        longitude: revDetails.longitude,
        property_type: revDetails.propertyClass,
        estimated_value: rawVal,
        estimated_equity: rawEq,
        equity_percent: Number(revDetails.equityPercent.replace(/[^0-9.]/g, "")) || (rawVal > 0 ? Math.round((rawEq / rawVal) * 100) : 0),
        bedrooms: Number(revDetails.bedrooms) || undefined,
        bathrooms: Number(revDetails.bathrooms) || undefined,
        square_feet: Number(revDetails.sqft.replace(/[^0-9.]/g, "")) || undefined,
        year_built: Number(revDetails.yearBuilt) || undefined,
        revzenta_opportunity_score: revDetails.opportunityScore || 75,
        opportunity_score_reasons: revDetails.opportunityReasons ? revDetails.opportunityReasons.split(", ") : [],
        is_absentee_owner: revDetails.distressIndicators.some((d) => d.toLowerCase().includes("absentee")),
        is_vacant: revDetails.distressIndicators.some((d) => d.toLowerCase().includes("vacant")),
        tax_delinquent: revDetails.distressIndicators.some((d) => d.toLowerCase().includes("tax")),
        is_pre_foreclosure: revDetails.distressIndicators.some((d) => d.toLowerCase().includes("pre-foreclosure")),
        is_probate: revDetails.distressIndicators.some((d) => d.toLowerCase().includes("probate")),
      };
      const res = await api.explainProperty({ property: propPayload });
      setExplanation(res.explanation);
    } catch (err: any) {
      console.error("AI Deal Analysis failed:", err);
    } finally {
      setLoadingExplanation(false);
    }
  };

  const handleToggleLoi = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = getLoiStatus(property);
    const nextStatus = current === "Sent" ? "Unsent" : "Sent";
    const existing = (property.customFields || []).filter(
      (f) => f.name.toLowerCase() !== "loi status" && f.name.toLowerCase() !== "loi"
    );
    const updatedFields = [...existing, { name: "LOI Status", value: nextStatus.toLowerCase() }];
    try {
      const res = await api.updateClient(property.id, {
        customFields: updatedFields,
        offersCount: nextStatus === "Sent" ? Math.max(1, property.offersCount || 1) : 0,
      });

      if (nextStatus === "Sent" && (!property.offersCount || property.offersCount === 0)) {
        try {
          const propAddr =
            property.address && property.companyName && property.address !== property.companyName
              ? `${property.companyName} — ${property.address}`
              : property.address || property.companyName || "Subject Property";
          await api.createOffer({
            clientId: property.id,
            propertyAddress: propAddr,
            sellerName: property.contactName || "Property Owner",
            sellerEmail: property.email || "",
            sellerPhone: property.phone || "",
            cashOfferAmount: property.dealValue || 250000,
            offerType: "cash",
            selectedOffers: ["cash"],
            status: "Sent",
            emailStatus: "sent",
            notes: `Official Letter of Intent (LOI) dispatched for ${property.companyName || property.address}`,
          });
        } catch (offerErr) {
          console.warn("Could not auto-create offer record in repository:", offerErr);
        }
      }

      if (res.client) {
        onPropertyUpdated?.(res.client);
      }
    } catch (err) {
      console.error("Failed to update LOI status", err);
    }
  };

  return (
    <>
      {/* Optional Top Navigation & Breadcrumb */}
      {!hideTopNav && onBack && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "20px",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--border, #30363d)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onBack}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: 700,
                fontSize: "13px",
                padding: "8px 16px",
              }}
            >
              <span>←</span>
              <span>{backLabel}</span>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {titleBadge && <span style={{ fontSize: "13px", color: "var(--muted, #64748b)" }}>{titleBadge} /</span>}
              <strong style={{ fontSize: "14px", color: "var(--ink, #0f172a)" }}>
                Review Calculation &amp; Property Intelligence
              </strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "12px",
                backgroundColor:
                  loiStatus === "Sent" ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                color: loiStatus === "Sent" ? "#059669" : "var(--muted, #64748b)",
                border: `1px solid ${
                  loiStatus === "Sent" ? "#10b981" : "var(--border, #30363d)"
                }`,
              }}
            >
              LOI Status: {loiStatus}
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "12px",
                backgroundColor: "rgba(14, 165, 233, 0.12)",
                color: "var(--blue, #0284c7)",
                border: "1px solid rgba(14, 165, 233, 0.3)",
              }}
            >
              Stage: {property.stage || "Prospect"}
            </span>
          </div>
        </div>
      )}

      {/* ── FULL PROPERTY INFORMATION VIEW (ABOVE) ── */}
      <div
        style={{
          background: "var(--card-bg, #121216)",
          border: "1px solid var(--border, #30363d)",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "var(--shadow, 0 10px 30px rgba(0,0,0,0.15))",
        }}
      >
        {/* Header Row: Street View Photo + Core Information */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "24px",
            alignItems: "start",
            marginBottom: "24px",
          }}
        >
          {/* Left: Street View Image */}
          <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border, #30363d)" }}>
            <PropertyImage
              address={revDetails.address}
              city={revDetails.city}
              state={revDetails.state}
              zip={revDetails.zip}
              latitude={revDetails.latitude}
              longitude={revDetails.longitude}
              mode="street"
              streetHeight={260}
            />
          </div>

          {/* Right: Property Address, Badges & Motivation Highlights */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: "rgba(14, 165, 233, 0.12)",
                  color: "var(--blue, #0284c7)",
                  letterSpacing: "0.04em",
                }}
              >
                {revDetails.propertyClass}
              </span>
              {revDetails.apn && (
                <span style={{ fontSize: "11.5px", color: "var(--muted, #64748b)", fontFamily: "monospace" }}>
                  APN: {revDetails.apn}
                </span>
              )}
              {revDetails.dataSource && (
                <span style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>
                  Source: {revDetails.dataSource}
                </span>
              )}
            </div>

            <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 800, color: "var(--ink, #0f172a)" }}>
              {revDetails.address}
            </h1>
            <p style={{ margin: "0 0 14px", fontSize: "15px", color: "var(--muted, #64748b)" }}>
              {[revDetails.city, revDetails.state, revDetails.zip, revDetails.county ? `${revDetails.county} County` : ""]
                .filter(Boolean)
                .join(", ")}
            </p>

            {/* Opportunity Score and Distress Badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {revDetails.opportunityScore != null && (
                <span
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 800,
                    padding: "4px 10px",
                    borderRadius: "8px",
                    background:
                      revDetails.opportunityScore >= 80
                        ? "rgba(16, 185, 129, 0.15)"
                        : revDetails.opportunityScore >= 60
                        ? "rgba(245, 158, 11, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                    color:
                      revDetails.opportunityScore >= 80
                        ? "#059669"
                        : revDetails.opportunityScore >= 60
                        ? "#b45309"
                        : "#dc2626",
                    border: `1px solid ${
                      revDetails.opportunityScore >= 80
                        ? "#10b981"
                        : revDetails.opportunityScore >= 60
                        ? "#f59e0b"
                        : "#ef4444"
                    }`,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <span>🎯</span>
                  <span>Opportunity Score: {revDetails.opportunityScore}/100</span>
                </span>
              )}

              {revDetails.distressIndicators.map((distress) => (
                <span
                  key={distress}
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 700,
                    padding: "4px 9px",
                    borderRadius: "6px",
                    background: "rgba(239, 68, 68, 0.12)",
                    color: "#dc2626",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>⚠️</span>
                  <span>{distress}</span>
                </span>
              ))}

              {revDetails.ownerOccupied && (
                <span
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 600,
                    padding: "4px 9px",
                    borderRadius: "6px",
                    background: "var(--panel-2, #16161b)",
                    color: "var(--ink-dim, #334155)",
                    border: "1px solid var(--border, #30363d)",
                  }}
                >
                  Occupancy: {revDetails.ownerOccupied}
                </span>
              )}
            </div>

            {revDetails.opportunityReasons && (
              <div
                style={{
                  fontSize: "12.5px",
                  color: "var(--ink, #0f172a)",
                  background: "var(--panel-2, #16161b)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #30363d)",
                  lineHeight: "1.5",
                }}
              >
                <strong style={{ color: "var(--primary, #00a89f)" }}>💡 Underwriting Highlights:</strong>{" "}
                {revDetails.opportunityReasons}
              </div>
            )}
          </div>
        </div>

        {/* Core Financial Stat Metric Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              background: "var(--panel-2, #16161b)",
              border: "1px solid var(--border, #30363d)",
              borderRadius: "8px",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
              Estimated Market Value
            </div>
            <div style={{ fontSize: "19px", fontWeight: 800, color: "var(--primary, #00a89f)", marginTop: "4px" }}>
              {revDetails.estimatedValue}
            </div>
            {revDetails.valuationRange && (
              <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", marginTop: "2px" }}>
                Range: {revDetails.valuationRange}
              </div>
            )}
          </div>

          <div
            style={{
              background: "var(--panel-2, #16161b)",
              border: "1px solid var(--border, #30363d)",
              borderRadius: "8px",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
              Estimated Equity
            </div>
            <div style={{ fontSize: "19px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
              {revDetails.estimatedEquity}
            </div>
            {revDetails.equityPercent && (
              <div style={{ fontSize: "11px", color: "#059669", marginTop: "2px", fontWeight: 600 }}>
                {revDetails.equityPercent} Equity Cushion
              </div>
            )}
          </div>

          <div
            style={{
              background: "var(--panel-2, #16161b)",
              border: "1px solid var(--border, #30363d)",
              borderRadius: "8px",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
              Open Mortgage
            </div>
            <div style={{ fontSize: "19px", fontWeight: 800, color: "var(--ink, #0f172a)", marginTop: "4px" }}>
              {revDetails.openMortgage}
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", marginTop: "2px" }}>
              Estimated Debt Balance
            </div>
          </div>

          <div
            style={{
              background: "var(--panel-2, #16161b)",
              border: "1px solid var(--border, #30363d)",
              borderRadius: "8px",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
              Estimated Market Rent
            </div>
            <div style={{ fontSize: "19px", fontWeight: 800, color: "var(--blue, #0284c7)", marginTop: "4px" }}>
              {revDetails.estimatedRent ? `$${revDetails.estimatedRent}/mo` : "—"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", marginTop: "2px" }}>
              Gross Cash Flow Base
            </div>
          </div>

          <div
            style={{
              background: "var(--panel-2, #16161b)",
              border: "1px solid var(--border, #30363d)",
              borderRadius: "8px",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
              Tax Assessed Value
            </div>
            <div style={{ fontSize: "19px", fontWeight: 800, color: "var(--ink, #0f172a)", marginTop: "4px" }}>
              {revDetails.taxAssessed}
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", marginTop: "2px" }}>
              County Assessor Record
            </div>
          </div>

          <div
            style={{
              background: "var(--panel-2, #16161b)",
              border: "1px solid var(--border, #30363d)",
              borderRadius: "8px",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
              Last Transaction
            </div>
            <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--ink, #0f172a)", marginTop: "4px" }}>
              {revDetails.lastSalePrice}
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", marginTop: "2px" }}>
              {revDetails.lastSaleDate || "Sale date unrecorded"}
            </div>
          </div>
        </div>

        {/* Detailed 4-Column Intelligence Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            background: "var(--panel-2, #16161b)",
            padding: "18px",
            borderRadius: "10px",
            border: "1px solid var(--border, #30363d)",
          }}
        >
          {/* Column 1: Physical Specifications */}
          <div>
            <h3 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 800, color: "var(--blue, #0284c7)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              📐 Physical Specs
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Bedrooms:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.bedrooms || "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Bathrooms:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.bathrooms || "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Square Feet:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.sqft ? `${revDetails.sqft} sqft` : "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Year Built:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.yearBuilt || "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Lot Size:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.lotSize || "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Stories:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.stories || "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Garage Spaces:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.garageSpaces || "—"}</strong>
              </div>
            </div>
          </div>

          {/* Column 2: Valuation & Assessor */}
          <div>
            <h3 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 800, color: "var(--primary, #00a89f)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              📊 Assessor &amp; Valuation
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>AVM Value:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.estimatedValue}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Valuation Range:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.valuationRange || "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Tax Assessed:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.taxAssessed}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Last Sale Price:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.lastSalePrice}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Last Sale Date:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.lastSaleDate || "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>APN / Parcel:</span>
                <strong style={{ color: "var(--ink, #0f172a)", fontFamily: "monospace" }}>{revDetails.apn || "—"}</strong>
              </div>
            </div>
          </div>

          {/* Column 3: Ownership & Contact */}
          <div>
            <h3 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 800, color: "var(--amber, #d97706)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              👤 Ownership &amp; Contact
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Owner Name:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>
                  {property.contactName || property.companyName || "Property Owner"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Phone:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{property.phone || "No phone recorded"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Email:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{property.email || "No email recorded"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>Owner Occupied:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.ownerOccupied || "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted, #64748b)" }}>County:</span>
                <strong style={{ color: "var(--ink, #0f172a)" }}>{revDetails.county || "—"}</strong>
              </div>
            </div>
          </div>

          {/* Column 4: Deal Intelligence & Actions */}
          <div>
            <h3 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 800, color: "var(--violet, #7c3aed)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              ⚡ Intelligence &amp; Actions
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
              <div>
                <span style={{ color: "var(--muted, #64748b)", fontSize: "11px", display: "block" }}>DISPATCHED PSA / LOI:</span>
                <strong style={{ color: loiStatus === "Sent" ? "#059669" : "var(--muted, #64748b)" }}>
                  {loiStatus === "Sent" ? "✓ Dispatched Proposal" : "Pending Proposal"}
                </strong>
              </div>
              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: "1 1 auto", fontSize: "11.5px" }}
                  onClick={handleOpenAiDeal}
                >
                  🧠 AI Deal Analysis
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${loiStatus === "Sent" ? "btn-secondary" : "btn-primary"}`}
                  style={{ flex: "1 1 auto", fontSize: "11.5px" }}
                  onClick={handleToggleLoi}
                >
                  {loiStatus === "Sent" ? "Mark LOI Unsent" : "Mark LOI Sent"}
                </button>
              </div>
              <div style={{ marginTop: "4px" }}>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "12px", color: "var(--primary, #00a89f)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                  <span>🗺️</span>
                  <span>Open in Google Maps ↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Deal Analysis Modal ────────────────────────────────────────────── */}
      {showAiModal && (
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
              background: "var(--card-bg, #121216)",
              border: "1px solid var(--border, #30363d)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "var(--shadow, 0 10px 30px rgba(0,0,0,0.5))",
              color: "var(--ink, #0f172a)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", color: "var(--ink, #0f172a)" }}>
                  <span>🧠</span>
                  <span>Revzenta Deal Intelligence</span>
                </h2>
                <div style={{ fontSize: "13px", color: "var(--muted, #64748b)" }}>
                  {revDetails.address}, {revDetails.city}, {revDetails.state}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAiModal(false)}
                style={{ padding: "4px 10px", fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            {/* Property Photos: Street View + Satellite */}
            <PropertyImage
              address={revDetails.address}
              city={revDetails.city}
              state={revDetails.state}
              zip={revDetails.zip}
              latitude={revDetails.latitude}
              longitude={revDetails.longitude}
              mode="both"
              satelliteHeight={200}
            />

            {loadingExplanation ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted, #64748b)" }}>
                <div style={{ fontSize: "24px", marginBottom: "12px" }}>✨</div>
                <div>Analyzing property equity, market spread, and wholesale angles...</div>
              </div>
            ) : explanation ? (
              <div style={{ marginTop: "16px" }}>
                <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(124, 58, 237, 0.1)", border: "1px solid rgba(124, 58, 237, 0.4)", marginBottom: "18px" }}>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", color: "var(--violet, #7c3aed)" }}>
                    {explanation.headline}
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "var(--ink, #0f172a)" }}>
                    {explanation.summary}
                  </p>
                </div>

                <div style={{ marginBottom: "18px" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                    Opportunity Score Breakdown ({explanation.opportunityScoreBreakdown.totalScore}/100)
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", textAlign: "center" }}>
                    <div style={{ padding: "10px", borderRadius: "8px", background: "var(--panel-2, #16161b)", border: "1px solid var(--border, #30363d)" }}>
                      <div style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>Equity Cushion</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#059669" }}>
                        {explanation.opportunityScoreBreakdown.equityScore}/35
                      </div>
                    </div>
                    <div style={{ padding: "10px", borderRadius: "8px", background: "var(--panel-2, #16161b)", border: "1px solid var(--border, #30363d)" }}>
                      <div style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>Motivation Level</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--blue, #0284c7)" }}>
                        {explanation.opportunityScoreBreakdown.distressScore}/35
                      </div>
                    </div>
                    <div style={{ padding: "10px", borderRadius: "8px", background: "var(--panel-2, #16161b)", border: "1px solid var(--border, #30363d)" }}>
                      <div style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>Spread Feasibility</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--violet, #7c3aed)" }}>
                        {explanation.opportunityScoreBreakdown.spreadScore}/30
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strengths & Risks */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#059669", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>✓</span>
                      <span>Key Deal Strengths</span>
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", lineHeight: "1.5", color: "var(--ink, #0f172a)" }}>
                      {(explanation.keyStrengths || []).map((s, idx) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#dc2626", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>⚠️</span>
                      <span>Risk Factors</span>
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", lineHeight: "1.5", color: "var(--ink, #0f172a)" }}>
                      {(explanation.riskFactors || []).map((r, idx) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommended Strategies */}
                {explanation.recommendedStrategies && explanation.recommendedStrategies.length > 0 && (
                  <div style={{ marginBottom: "18px" }}>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                      Recommended Wholesale &amp; Exit Strategies
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {explanation.recommendedStrategies.map((strat, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            background: "var(--panel-2, #16161b)",
                            border: "1px solid var(--border, #30363d)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary, #00a89f)" }}>{strat.strategy}</span>
                            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted, #64748b)" }}>
                              {strat.rationale}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
