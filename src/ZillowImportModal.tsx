import React, { useState } from "react";
import type { Client, PropertyEnrichmentResult } from "./types";
import { api } from "./api";
import { extractAddressFromUrl } from "./urlAddressParser";

interface Props {
  stages: string[];
  onClose: () => void;
  onSaved: (created: Client) => void;
  onSaveAndUnderwrite?: (created: Client) => void;
}

export default function ZillowImportModal({
  stages,
  onClose,
  onSaved,
  onSaveAndUnderwrite,
}: Props) {
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchSuccess, setFetchSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Security & Quota warning modal state
  const [showHardStopModal, setShowHardStopModal] = useState(false);
  const [hardStopInfo, setHardStopInfo] = useState<{ message: string; callsThisMonth?: number; monthlyLimit?: number } | null>(null);
  const [showSecurityBlockModal, setShowSecurityBlockModal] = useState(false);
  const [securityBlockMsg, setSecurityBlockMsg] = useState<string | null>(null);

  // Property Form State (populated on fetch)
  const [enriched, setEnriched] = useState<PropertyEnrichmentResult | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [estimatedValue, setEstimatedValue] = useState<number>(0);
  const [estimatedEquity, setEstimatedEquity] = useState<number>(0);
  const [openMortgage, setOpenMortgage] = useState<number>(0);
  const [bedrooms, setBedrooms] = useState<number | "">("");
  const [bathrooms, setBathrooms] = useState<number | "">("");
  const [squareFootage, setSquareFootage] = useState<number | "">("");
  const [yearBuilt, setYearBuilt] = useState<number | "">("");
  const [propertyClass, setPropertyClass] = useState<string>("single_family");
  const [selectedStage, setSelectedStage] = useState<string>(stages[0] || "New Lead");
  const [estimatedRent, setEstimatedRent] = useState<number>(0);
  const [showComps, setShowComps] = useState(false);
  const [showManualForm, setShowManualForm] = useState(true);

  // Common high-contrast theme-adaptive styles for preview inputs
  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "36px",
    padding: "0 11px",
    borderRadius: "6px",
    border: "1px solid var(--border, #30363d)",
    backgroundColor: "var(--bg-soft, #16161b)",
    color: "var(--ink, #f8fafc)",
    fontSize: "13px",
    fontWeight: 500,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11.5px",
    fontWeight: 700,
    color: "var(--ink-dim, #94a3b8)",
    marginBottom: "5px",
    letterSpacing: "0.01em",
  };

  const handleFetch = async (overrideUrl?: string) => {
    const raw = (overrideUrl ?? urlInput).trim();
    if (!raw) {
      setFetchError("Please paste a Zillow URL or address.");
      return;
    }

    setFetching(true);
    setFetchError(null);
    setFetchSuccess(null);

    const parsed = extractAddressFromUrl(raw);
    if (parsed.isUrl && !parsed.authorized) {
      setSecurityBlockMsg(parsed.rejectionReason || "Unauthorized Domain. For security reasons, only links from authorized real estate platforms (Zillow, Redfin, Realtor.com, Trulia, Homes.com) are permitted.");
      setShowSecurityBlockModal(true);
      setFetching(false);
      return;
    }

    const queryAddress = parsed.address || raw;

    try {
      const res = await api.lookupProperty(queryAddress);
      if (res.property) {
        const p = res.property;
        setEnriched(p);

        if (p.source === "not_found") {
          setFetchError(
            p.message ||
              `Could not find property records for "${queryAddress}". You can still fill in the details manually below.`
          );
        } else if (p.source === "unconfigured") {
          setFetchError(
            p.message ||
              "RentCast API key is not configured. Add your key in Settings > Integrations."
          );
        } else {
          setFetchSuccess(`✓ Successfully verified MLS data from ${parsed.isUrl ? parsed.source.toUpperCase() : "address"}`);
        }

        // Populate fields
        setAddress(p.addressLine1 || queryAddress);
        setCity(p.city || "");
        setState(p.state || "");
        setZip(p.zipCode || "");

        if (p.ownerName) {
          const parts = p.ownerName.trim().split(/\s+/);
          if (parts.length >= 2) {
            setOwnerFirstName(parts[0]);
            setOwnerLastName(parts.slice(1).join(" "));
          } else {
            setOwnerFirstName(p.ownerName);
            setOwnerLastName("");
          }
        }

        if (p.bedrooms != null) setBedrooms(p.bedrooms);
        if (p.bathrooms != null) setBathrooms(p.bathrooms);
        if (p.squareFootage != null) setSquareFootage(p.squareFootage);
        if (p.yearBuilt != null) setYearBuilt(p.yearBuilt);

        if (p.propertyType) {
          const pt = p.propertyType.toLowerCase();
          if (pt.includes("commercial")) setPropertyClass("commercial");
          else if (pt.includes("multi")) setPropertyClass("multi_family");
          else setPropertyClass("single_family");
        }

        if (p.estimatedValue && p.estimatedValue > 0) {
          setEstimatedValue(p.estimatedValue);
          // Mortgage balances are private banking data not exposed on public listing URLs or basic MLS.
          // Default open mortgage to 0 (unverified) and calculate initial equity from public valuation.
          setOpenMortgage(0);
          setEstimatedEquity(p.estimatedValue);
        }

        if (p.estimatedRent) {
          setEstimatedRent(p.estimatedRent);
        }
      }
    } catch (e: any) {
      const msg = e?.message || "";
      const isHardStop = e?.body?.code === "RENTCAST_HARD_STOP" ||
        msg.includes("RENTCAST_HARD_STOP") ||
        (e?.status === 429 && msg.toLowerCase().includes("monthly limit"));

      if (isHardStop) {
        setHardStopInfo({
          message: e?.body?.error || msg || "Monthly RentCast API limit reached. Outbound API requests have been paused to protect your account.",
          callsThisMonth: e?.body?.usage?.callsThisMonth,
          monthlyLimit: e?.body?.usage?.monthlyLimit,
        });
        setShowHardStopModal(true);
        if (queryAddress && !address) {
          setAddress(queryAddress);
        }
      } else {
        setFetchError(msg || "Failed to fetch property details.");
      }
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async (andUnderwrite = false) => {
    if (!address.trim()) {
      setSaveError("Property Address is required.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const fullContact = [ownerFirstName.trim(), ownerLastName.trim()].filter(Boolean).join(" ");
      const sellerDisplayName = fullContact || "Unknown Owner";
      const fullStreet = address.trim();

      const customFields = [
        { name: "Auto Enriched", value: new Date().toISOString() },
        { name: "Assignment Value", value: "5000" },
        { name: "Assignment Fee", value: "$5,000" },
        { name: "Owner First Name", value: ownerFirstName.trim() },
        { name: "Owner Last Name", value: ownerLastName.trim() },
        { name: "Bedrooms", value: bedrooms !== "" ? String(bedrooms) : "" },
        { name: "Bathrooms", value: bathrooms !== "" ? String(bathrooms) : "" },
        { name: "Square Footage", value: squareFootage !== "" ? String(squareFootage) : "" },
        { name: "Year Built", value: yearBuilt !== "" ? String(yearBuilt) : "" },
        { name: "Estimated Value", value: estimatedValue > 0 ? `$${estimatedValue.toLocaleString()}` : "" },
        { name: "Estimated Equity", value: estimatedEquity > 0 ? `$${estimatedEquity.toLocaleString()}` : "" },
        { name: "Open Mortgage Balance", value: openMortgage > 0 ? `$${openMortgage.toLocaleString()}` : "" },
        {
          name: "Property Class",
          value:
            propertyClass === "single_family"
              ? "Single Family"
              : propertyClass === "multi_family"
              ? "Multi Family"
              : propertyClass === "commercial"
              ? "Commercial"
              : "Single Family",
        },
      ];

      if (estimatedRent > 0) {
        customFields.push({ name: "Rent Estimate", value: `$${estimatedRent.toLocaleString()}/mo` });
      }
      if (urlInput.trim()) {
        customFields.push({ name: "Listing URL", value: urlInput.trim() });
      }

      const payload: any = {
        companyName: fullStreet,
        contactName: sellerDisplayName,
        address: fullStreet,
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        clientType: propertyClass,
        stage: selectedStage,
        dealValue: estimatedValue > 0 ? estimatedValue : 0,
        leadSource: "Zillow Import",
        services: ["Wholesale Underwriting"],
        customFields,
      };

      const res = await api.createClient(payload);
      if (res.client) {
        if (andUnderwrite && onSaveAndUnderwrite) {
          onSaveAndUnderwrite(res.client);
        } else {
          onSaved(res.client);
        }
        onClose();
      }
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save property to Creative Hub.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          width: "100%",
          maxWidth: "760px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "14px",
          backgroundColor: "var(--panel-2, #141418)",
          border: "1px solid var(--border, #30363d)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
          color: "var(--ink, #f8fafc)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border, #30363d)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(180deg, rgba(56, 189, 248, 0.08) 0%, transparent 100%)",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>🔗</span> Property URL Link
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "var(--muted, #94a3b8)" }}>
              Paste any Zillow, Redfin, or Realtor.com URL to automatically pull MLS specs, AVM valuation, and comps into Creative Hub.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted, #94a3b8)",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* URL Input Bar */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--muted, #94a3b8)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Property URL Link (Zillow, Redfin, Realtor.com)
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFetch();
                  }
                }}
                placeholder="e.g. https://www.zillow.com/homedetails/5500-Grand-Lake-Dr-San-Antonio-TX-78244/26194726_zpid/"
                style={{
                  flex: 1,
                  height: "40px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #30363d)",
                  backgroundColor: "var(--panel, #16161b)",
                  color: "var(--ink, #f8fafc)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => handleFetch()}
                disabled={fetching || !urlInput.trim()}
                style={{
                  height: "40px",
                  padding: "0 18px",
                  borderRadius: "8px",
                  backgroundColor: "#38bdf8",
                  color: "#0b1320",
                  fontWeight: 700,
                  fontSize: "13px",
                  border: "none",
                  cursor: fetching || !urlInput.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{fetching ? "⏳" : "⚡"}</span>
                <span>{fetching ? "Fetching MLS..." : "Fetch Specs"}</span>
              </button>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>Examples:</span>
              <button
                type="button"
                onClick={() => {
                  const demo = "https://www.zillow.com/homedetails/5500-Grand-Lake-Dr-San-Antonio-TX-78244/26194726_zpid/";
                  setUrlInput(demo);
                  handleFetch(demo);
                }}
                style={{
                  background: "none",
                  border: "1px dashed rgba(56, 189, 248, 0.4)",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  color: "#38bdf8",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Sample Zillow Property (San Antonio, TX)
              </button>
            </div>
          </div>

          {/* Feedback messages */}
          {fetchError && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", fontSize: "12.5px" }}>
              {fetchError}
            </div>
          )}
          {fetchSuccess && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#34d399", fontSize: "12.5px" }}>
              {fetchSuccess}
            </div>
          )}

          {/* Property Form / Review Details */}
          {(enriched || address || showManualForm) && (
            <div
              style={{
                backgroundColor: "var(--panel, #121216)",
                border: "1px solid var(--border, #30363d)",
                borderRadius: "10px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border, #30363d)", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink, #f8fafc)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>📋</span>
                    <span>Creative Hub Data Preview</span>
                  </span>
                  {!enriched && !address && (
                    <span style={{ fontSize: "11px", color: "var(--ink-dim, #94a3b8)", backgroundColor: "var(--panel-2, #16161b)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border, #30363d)" }}>
                      Manual Entry / MLS Preview
                    </span>
                  )}
                </div>
                {enriched?.estimatedRent ? (
                  <span style={{ fontSize: "12px", color: "var(--lime, #d6ff3f)", fontWeight: 700, background: "rgba(214, 255, 63, 0.12)", border: "1px solid rgba(214, 255, 63, 0.25)", padding: "2px 8px", borderRadius: "4px" }}>
                    Market Rent: ${enriched.estimatedRent.toLocaleString()}/mo
                  </span>
                ) : null}
              </div>

              {/* Address Fields */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>
                    Street Address <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 5500 Grand Lake Dr"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="ZIP Code"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Owner Names */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>
                    Owner First Name
                  </label>
                  <input
                    type="text"
                    value={ownerFirstName}
                    onChange={(e) => setOwnerFirstName(e.target.value)}
                    placeholder="Owner First Name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Owner Last Name
                  </label>
                  <input
                    type="text"
                    value={ownerLastName}
                    onChange={(e) => setOwnerLastName(e.target.value)}
                    placeholder="Owner Last Name"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Valuation & Financial Metrics (Opportunities Table Columns) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ ...labelStyle, color: "var(--blue, #38bdf8)" }}>
                    Estimated Value (AVM) <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--ink-dim, #94a3b8)" }}>• Public Records</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "10px", top: "9px", fontSize: "12px", color: "var(--ink-dim, #94a3b8)" }}>$</span>
                    <input
                      type="number"
                      value={estimatedValue || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setEstimatedValue(val);
                        setEstimatedEquity(Math.max(0, val - (openMortgage || 0)));
                      }}
                      placeholder="0"
                      style={{
                        ...inputStyle,
                        paddingLeft: "24px",
                        borderColor: "rgba(56, 189, 248, 0.5)",
                        color: "var(--blue, #38bdf8)",
                        fontWeight: 700,
                        fontSize: "13.5px",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, color: "var(--amber, #fbbf24)" }}>
                    Open Mortgage Balance <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--ink-dim, #94a3b8)" }}>• Private (Verify)</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "10px", top: "9px", fontSize: "12px", color: "var(--ink-dim, #94a3b8)" }}>$</span>
                    <input
                      type="number"
                      value={openMortgage || ""}
                      onChange={(e) => {
                        const mortgage = Number(e.target.value) || 0;
                        setOpenMortgage(mortgage);
                        setEstimatedEquity(Math.max(0, (estimatedValue || 0) - mortgage));
                      }}
                      placeholder="Ask homeowner on call"
                      style={{
                        ...inputStyle,
                        paddingLeft: "24px",
                        color: "var(--ink, #f8fafc)",
                        fontWeight: 600,
                        fontSize: "13.5px",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, color: "var(--green, #34d399)" }}>
                    Estimated Equity <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--ink-dim, #94a3b8)" }}>• Value − Mortgage</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "10px", top: "9px", fontSize: "12px", color: "var(--ink-dim, #94a3b8)" }}>$</span>
                    <input
                      type="number"
                      value={estimatedEquity || ""}
                      onChange={(e) => setEstimatedEquity(Number(e.target.value) || 0)}
                      placeholder="0"
                      style={{
                        ...inputStyle,
                        paddingLeft: "24px",
                        borderColor: "rgba(52, 211, 153, 0.5)",
                        color: "var(--green, #34d399)",
                        fontWeight: 700,
                        fontSize: "13.5px",
                      }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "11px", color: "var(--ink-dim, #94a3b8)", marginTop: "-4px", lineHeight: "1.4" }}>
                🔒 <em>Mortgage balances are private banking data protected by federal law (GLBA / FCRA). We pull public tax appraisals and comps. Enter the mortgage payoff once confirmed with the homeowner.</em>
              </div>

              {/* Physical Specifications (Opportunities Table Columns) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1.2fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>
                    Bedrooms
                  </label>
                  <input
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="3"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Bathrooms
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="2"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Square Footage
                  </label>
                  <input
                    type="number"
                    value={squareFootage}
                    onChange={(e) => setSquareFootage(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="1800"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Year Built
                  </label>
                  <input
                    type="number"
                    value={yearBuilt}
                    onChange={(e) => setYearBuilt(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="1985"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Property Class
                  </label>
                  <select
                    value={propertyClass}
                    onChange={(e) => setPropertyClass(e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    <option value="single_family">Single Family</option>
                    <option value="multi_family">Multi Family</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
              </div>

              {/* Pipeline Stage Assignment */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--ink-dim, #94a3b8)" }}>
                  Pipeline Stage:
                </span>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  style={{ ...inputStyle, width: "auto", minWidth: "160px", cursor: "pointer" }}
                >
                  {stages.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                {enriched?.comps && enriched.comps.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowComps(!showComps)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--blue, #38bdf8)",
                      fontSize: "12px",
                      cursor: "pointer",
                      marginLeft: "auto",
                      textDecoration: "underline",
                      fontWeight: 600,
                    }}
                  >
                    {showComps ? "Hide Nearby Comps" : `View ${enriched.comps.length} Nearby MLS Comps`}
                  </button>
                )}
              </div>

              {/* Comps List drawer */}
              {showComps && enriched?.comps && enriched.comps.length > 0 && (
                <div style={{ marginTop: "8px", padding: "12px", borderRadius: "8px", background: "var(--bg-soft, #16161b)", border: "1px solid var(--border, #30363d)", maxHeight: "150px", overflowY: "auto" }}>
                  <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--ink-dim, #94a3b8)", marginBottom: "8px" }}>
                    Recent MLS Comparable Sales:
                  </div>
                  {enriched.comps.map((c, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", padding: "4px 0", borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))" }}>
                      <span style={{ color: "var(--ink, #f8fafc)", fontWeight: 500 }}>{c.address} ({c.distanceMiles} mi)</span>
                      <strong style={{ color: "var(--lime, #d6ff3f)" }}>${c.price.toLocaleString()} · {c.bedrooms}b/{c.bathrooms}ba · {c.squareFootage} sqft</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {saveError && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", fontSize: "12.5px" }}>
              {saveError}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border, #30363d)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--panel, #121216)",
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={saving}
            style={{ height: "38px", padding: "0 16px" }}
          >
            Cancel
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            {onSaveAndUnderwrite && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || !address.trim()}
                style={{
                  height: "38px",
                  padding: "0 16px",
                  borderRadius: "7px",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  backgroundColor: "rgba(56, 189, 248, 0.12)",
                  color: "#38bdf8",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: saving || !address.trim() ? "not-allowed" : "pointer",
                }}
              >
                📐 Save &amp; Underwrite Deal
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving || !address.trim()}
              style={{
                height: "38px",
                padding: "0 20px",
                borderRadius: "7px",
                border: "none",
                backgroundColor: "var(--primary, #d6ff3f)",
                color: "#000",
                fontWeight: 800,
                fontSize: "13px",
                cursor: saving || !address.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>{saving ? "⏳" : "💾"}</span>
              <span>{saving ? "Saving..." : "Save to Creative Hub"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🛑 RentCast Quota Limit & Hard Stop Pop-up Warning Modal */}
      {showHardStopModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
          onClick={() => setShowHardStopModal(false)}
        >
          <div
            style={{
              backgroundColor: "var(--card-bg, #18191d)",
              border: "1px solid #ef4444",
              boxShadow: "0 20px 40px rgba(239, 68, 68, 0.25)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "520px",
              padding: "24px",
              color: "var(--text, #f8fafc)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <span style={{ fontSize: "32px" }}>🛑</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#ef4444" }}>
                  RentCast Monthly Quota Limit Reached
                </h3>
                <div style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", marginTop: "2px" }}>
                  Hard Stop Protection is Active
                </div>
              </div>
            </div>

            <div style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text-muted, #cbd5e1)", marginBottom: "16px" }}>
              <p style={{ margin: "0 0 10px" }}>
                {hardStopInfo?.message || "Your monthly RentCast API allowance has been reached. Outbound live MLS / AVM lookup requests have been paused to protect your account against accidental billing overages."}
              </p>
              {hardStopInfo?.monthlyLimit ? (
                <div style={{ padding: "10px 14px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: "12px", fontWeight: 600 }}>
                  Usage: {hardStopInfo.callsThisMonth ?? hardStopInfo.monthlyLimit} / {hardStopInfo.monthlyLimit} calls used this month.
                </div>
              ) : null}
            </div>

            <div style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
              💡 <strong>Tip:</strong> You can still save this property to Creative Hub by filling in the details manually below, or raise your monthly limit in <strong>Connections &gt; RentCast API Guard</strong>.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowHardStopModal(false);
                  setShowManualForm(true);
                }}
                style={{ height: "36px", padding: "0 16px", borderRadius: "6px", fontSize: "13px" }}
              >
                ✏️ Fill Details Manually
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setShowHardStopModal(false);
                  onClose();
                  window.location.hash = "#/connections";
                }}
                style={{ height: "36px", padding: "0 16px", borderRadius: "6px", fontSize: "13px", background: "#ef4444", borderColor: "#dc2626", color: "#fff", fontWeight: 700 }}
              >
                ⚙️ Manage Limit in Connections
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ Unauthorized Property URL Security Block Warning Modal */}
      {showSecurityBlockModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
          onClick={() => setShowSecurityBlockModal(false)}
        >
          <div
            style={{
              backgroundColor: "var(--card-bg, #18191d)",
              border: "1px solid #f59e0b",
              boxShadow: "0 20px 40px rgba(245, 158, 11, 0.25)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "520px",
              padding: "24px",
              color: "var(--text, #f8fafc)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <span style={{ fontSize: "32px" }}>🛡️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#f59e0b" }}>
                  Security Alert: Unauthorized Domain
                </h3>
                <div style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", marginTop: "2px" }}>
                  URL Domain Whitelist Active
                </div>
              </div>
            </div>

            <div style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text-muted, #cbd5e1)", marginBottom: "16px" }}>
              <p style={{ margin: "0 0 10px" }}>
                {securityBlockMsg || "For system security and anti-abuse safeguards, only links from authorized real estate platforms (Zillow, Redfin, Realtor.com, Trulia, Homes.com) or standard physical street addresses can enter the CRM."}
              </p>
              <div style={{ padding: "10px 14px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", color: "#fcd34d", fontSize: "12px" }}>
                🔒 Internal LAN IP addresses, localhost, and non-whitelisted domains are strictly prohibited to protect your workspace against SSRF exploits.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowSecurityBlockModal(false)}
                style={{ height: "36px", padding: "0 18px", borderRadius: "6px", fontSize: "13px", background: "#f59e0b", borderColor: "#d97706", color: "#000", fontWeight: 700 }}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
