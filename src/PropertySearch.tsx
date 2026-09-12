import { useState, useEffect, useCallback, type FormEvent } from "react";
import { api, ApiError } from "./api";
import type { PropertyItem, SavedSearchItem, PropertyDealExplanation, DevSystemStatus, User, RegisteredProviderInfo, DistressAlertItem } from "./types";
import { money } from "./types";

interface Props {
  user: User;
  onNavigateToLead?: (clientId: number) => void;
}

export default function PropertySearch({ user, onNavigateToLead }: Props) {
  // Search state
  const [naturalQuery, setNaturalQuery] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);
  const [usedAiFlag, setUsedAiFlag] = useState(false);
  const [modelUsed, setModelUsed] = useState<string | undefined>(undefined);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [stateFilter, setStateFilter] = useState("");
  const [countyFilter, setCountyFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [zipFilter, setZipFilter] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [minEquityPct, setMinEquityPct] = useState("");
  const [minBeds, setMinBeds] = useState("");
  const [minBaths, setMinBaths] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [isAbsentee, setIsAbsentee] = useState(false);
  const [isVacant, setIsVacant] = useState(false);
  const [isTaxDelinquent, setIsTaxDelinquent] = useState(false);
  const [isPreForeclosure, setIsPreForeclosure] = useState(false);
  const [isProbate, setIsProbate] = useState(false);
  const [sortBy, setSortBy] = useState<"revzenta_opportunity_score" | "estimated_value" | "estimated_equity">("revzenta_opportunity_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Results state
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [selectedPropertyForExplanation, setSelectedPropertyForExplanation] = useState<PropertyItem | null>(null);
  const [explanation, setExplanation] = useState<PropertyDealExplanation | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // Saved Searches
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);

  // Dev Command Center (Admin Only)
  const [showDevCenter, setShowDevCenter] = useState(false);
  const [devStatus, setDevStatus] = useState<DevSystemStatus | null>(null);
  const [devQuerySql, setDevQuerySql] = useState("SELECT id, address_line1, city, state, estimated_value, revzenta_opportunity_score FROM properties LIMIT 5");
  const [devQueryResult, setDevQueryResult] = useState<any | null>(null);
  const [runningDevQuery, setRunningDevQuery] = useState(false);

  // Converting to lead
  const [convertingId, setConvertingId] = useState<number | null>(null);

  // Enrichment state
  const [enrichingId, setEnrichingId] = useState<number | null>(null);
  const [providers, setProviders] = useState<RegisteredProviderInfo[]>([]);
  const [showProvidersModal, setShowProvidersModal] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Distress Alerts state
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [distressAlerts, setDistressAlerts] = useState<DistressAlertItem[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [scanningDistress, setScanningDistress] = useState(false);

  // Build current structured filters object
  const buildFiltersObject = useCallback(() => {
    const filters: any = {
      sortBy,
      sortOrder,
    };
    if (stateFilter.trim()) filters.state = stateFilter.trim().toUpperCase();
    if (countyFilter.trim()) filters.county = countyFilter.trim();
    if (cityFilter.trim()) filters.city = cityFilter.trim();
    if (zipFilter.trim()) filters.zip = zipFilter.trim();
    if (minValue) filters.minValue = Number(minValue);
    if (maxValue) filters.maxValue = Number(maxValue);
    if (minEquityPct) filters.minEquityPct = Number(minEquityPct);
    if (minBeds) filters.minBeds = Number(minBeds);
    if (minBaths) filters.minBaths = Number(minBaths);
    if (propertyType) filters.propertyTypes = [propertyType];
    if (isAbsentee) filters.isAbsenteeOwner = true;
    if (isVacant) filters.isVacant = true;
    if (isTaxDelinquent) filters.taxDelinquent = true;
    if (isPreForeclosure) filters.isPreForeclosure = true;
    if (isProbate) filters.isProbate = true;
    return filters;
  }, [
    stateFilter, countyFilter, cityFilter, zipFilter, minValue, maxValue,
    minEquityPct, minBeds, minBaths, propertyType, isAbsentee, isVacant,
    isTaxDelinquent, isPreForeclosure, isProbate, sortBy, sortOrder
  ]);

  // Execute search
  const runSearch = useCallback(async (customFilters?: any) => {
    setLoading(true);
    setError(null);
    try {
      const filters = customFilters || buildFiltersObject();
      const res = await api.searchProperties(filters);
      setProperties(res.properties);
      setTotalCount(res.total);
    } catch (err: any) {
      setError(err.message || "Failed to search properties.");
    } finally {
      setLoading(false);
    }
  }, [buildFiltersObject]);

  // Load registered providers
  const loadProviders = useCallback(async () => {
    try {
      setLoadingProviders(true);
      const res = await api.getProviders();
      setProviders(res.providers || []);
    } catch (err) {
      console.error("Failed to load providers:", err);
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  // Load distress alerts
  const loadDistressAlerts = useCallback(async () => {
    try {
      setLoadingAlerts(true);
      const res = await api.getDistressAlerts({ limit: 50 });
      setDistressAlerts(res.alerts || []);
      setUnreadAlertCount(res.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load distress alerts:", err);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  // Initial load: search once & load providers + distress alerts
  useEffect(() => {
    runSearch();
    loadProviders();
    loadDistressAlerts();
  }, [loadProviders, loadDistressAlerts]);

  // Natural Language AI Search
  const handleAiSearch = async (e?: FormEvent, overridePrompt?: string) => {
    if (e) e.preventDefault();
    const prompt = (overridePrompt !== undefined ? overridePrompt : naturalQuery).trim();
    if (!prompt) {
      runSearch();
      return;
    }

    setIsTranslating(true);
    setError(null);
    try {
      const res = await api.translateSearch(prompt);
      setAiInterpretation(res.interpretation);
      setUsedAiFlag(res.usedAI);
      setModelUsed(res.model);

      // Apply translated filters to UI state
      setStateFilter(res.filters.state || "");
      setCountyFilter(res.filters.county || "");
      setCityFilter(res.filters.city || "");
      setZipFilter(res.filters.zip || "");
      setMinValue(res.filters.minValue !== undefined ? String(res.filters.minValue) : "");
      setMaxValue(res.filters.maxValue !== undefined ? String(res.filters.maxValue) : "");
      setMinEquityPct(res.filters.minEquityPct !== undefined ? String(res.filters.minEquityPct) : "");
      setMinBeds(res.filters.minBeds !== undefined ? String(res.filters.minBeds) : "");
      setMinBaths(res.filters.minBaths !== undefined ? String(res.filters.minBaths) : "");
      setPropertyType(res.filters.propertyTypes && res.filters.propertyTypes[0] ? res.filters.propertyTypes[0] : "");
      setIsAbsentee(Boolean(res.filters.isAbsenteeOwner));
      setIsVacant(Boolean(res.filters.isVacant));
      setIsTaxDelinquent(Boolean(res.filters.taxDelinquent));
      setIsPreForeclosure(Boolean(res.filters.isPreForeclosure));
      setIsProbate(Boolean(res.filters.isProbate));

      // Immediately run search with translated filters
      await runSearch(res.filters);
    } catch (err: any) {
      setError(err.message || "AI search translation failed.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Convert Property to Lead
  const handleConvertToLead = async (prop: PropertyItem) => {
    setConvertingId(prop.id);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.convertPropertyToLead(prop.id);
      if (res.duplicate) {
        setSuccessMsg(`⚠️ ${res.message}`);
      } else {
        setSuccessMsg(`✅ ${res.message}`);
      }
      if (onNavigateToLead && res.clientId) {
        setTimeout(() => {
          onNavigateToLead(res.clientId);
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || "Failed to convert property to lead.");
    } finally {
      setConvertingId(null);
    }
  };

  // Explain Property Deal
  const handleExplainDeal = async (prop: PropertyItem) => {
    setSelectedPropertyForExplanation(prop);
    setExplanation(null);
    setLoadingExplanation(true);
    try {
      const res = await api.explainProperty({ propertyId: prop.id, property: prop });
      setExplanation(res.explanation);
    } catch (err: any) {
      setError(err.message || "Failed to analyze property deal.");
    } finally {
      setLoadingExplanation(false);
    }
  };

  // Saved Searches
  const loadSavedSearches = async () => {
    try {
      const res = await api.getSavedSearches();
      setSavedSearches(res.savedSearches);
    } catch (err: any) {
      console.error("Failed to load saved searches:", err);
    }
  };

  const handleOpenSavedSearches = () => {
    setShowSavedSearches(true);
    loadSavedSearches();
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) return;
    setSavingSearch(true);
    try {
      await api.saveSearch(saveSearchName.trim(), buildFiltersObject(), naturalQuery);
      setSaveSearchName("");
      loadSavedSearches();
      setSuccessMsg("Search criteria saved successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to save search.");
    } finally {
      setSavingSearch(false);
    }
  };

  const handleExecuteSavedSearch = async (s: SavedSearchItem) => {
    setLoading(true);
    setShowSavedSearches(false);
    try {
      const res = await api.executeSavedSearch(s.id);
      setProperties(res.properties);
      setTotalCount(res.total);
      if (s.natural_language_query) setNaturalQuery(s.natural_language_query);
      setAiInterpretation(`Executed saved search "${s.name}"`);
    } catch (err: any) {
      setError(err.message || "Failed to execute saved search.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSavedSearch = async (id: number) => {
    try {
      await api.deleteSavedSearch(id);
      loadSavedSearches();
    } catch (err: any) {
      setError(err.message || "Failed to delete saved search.");
    }
  };

  // Dev Command Center (Admin)
  const handleOpenDevCenter = async () => {
    setShowDevCenter(true);
    try {
      const res = await api.getDevCommandCenterStatus();
      setDevStatus(res.status);
    } catch (err: any) {
      console.error("Failed to fetch dev status:", err);
    }
  };

  const handleRunDevQuery = async () => {
    if (!devQuerySql.trim()) return;
    setRunningDevQuery(true);
    try {
      const res = await api.analyzeDevQuery(devQuerySql.trim());
      setDevQueryResult(res);
    } catch (err: any) {
      setDevQueryResult({ allowed: false, error: err.message });
    } finally {
      setRunningDevQuery(false);
    }
  };

  // Live Multi-Source Property Enrichment
  const handleLiveEnrich = async (prop: PropertyItem) => {
    setEnrichingId(prop.id);
    setError(null);
    try {
      const fullAddress = `${prop.address_line1}, ${prop.city}, ${prop.state} ${prop.zip}`;
      const res = await api.enrichProperty(fullAddress, { propertyId: prop.id, forceRefresh: true });
      if (res.success && res.property) {
        setSuccessMsg(`Enriched "${prop.address_line1}" via ${res.sources.join(" + ")} in ${res.executionTimeMs}ms!`);
        // Refresh properties list to show updated values
        runSearch();
      } else {
        setError(res.message || "Enrichment completed with no updated fields.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to live enrich property.");
    } finally {
      setEnrichingId(null);
    }
  };

  // Toggle Saved Search Distress Alert
  const handleToggleSavedSearchAlert = async (s: SavedSearchItem) => {
    try {
      const res = await api.toggleSavedSearchAlert(s.id);
      loadSavedSearches();
      setSuccessMsg(`Distress alerts for "${s.name}" turned ${res.savedSearch.alert_enabled ? "ON" : "OFF"}.`);
    } catch (err: any) {
      setError(err.message || "Failed to toggle alert.");
    }
  };

  // Run On-Demand Distress Check
  const handleScanDistress = async () => {
    setScanningDistress(true);
    setError(null);
    try {
      const res = await api.runDistressCheck();
      setSuccessMsg(`Distress scan complete: ${res.newAlertsCreated} new alerts across ${res.scannedSearches} searches (${res.executionTimeMs}ms)`);
      loadDistressAlerts();
    } catch (err: any) {
      setError(err.message || "Failed to run distress scan.");
    } finally {
      setScanningDistress(false);
    }
  };

  // Mark Alerts as Read
  const handleMarkAlertsRead = async (alertIds?: number[]) => {
    try {
      await api.markAlertsRead(alertIds);
      loadDistressAlerts();
    } catch (err: any) {
      console.error("Failed to mark alerts as read:", err);
    }
  };

  // Score badge helper
  const renderScoreBadge = (score: number) => {
    let color = "#10b981"; // green
    let bg = "rgba(16, 185, 129, 0.12)";
    let label = "High Opportunity";

    if (score < 60) {
      color = "#94a3b8"; // slate
      bg = "rgba(148, 163, 184, 0.12)";
      label = "Baseline";
    } else if (score < 75) {
      color = "#3b82f6"; // blue
      bg = "rgba(59, 130, 246, 0.12)";
      label = "Solid Deal";
    }

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          borderRadius: "999px",
          backgroundColor: bg,
          color,
          fontWeight: 600,
          fontSize: "12px",
          border: `1px solid ${color}40`,
        }}
        title={`Revzenta Opportunity Score: ${score}/100`}
      >
        <span>🔥</span>
        <span>{score}/100</span>
        <span style={{ fontSize: "10px", opacity: 0.85 }}>({label})</span>
      </span>
    );
  };

  return (
    <div className="property-search-page" style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
            <span>🌐</span>
            <span>Property Intelligence & Nationwide Search</span>
          </h1>
          <p style={{ margin: 0, color: "var(--text-muted, #94a3b8)", fontSize: "14px" }}>
            Real-time property discovery, AI query translation, off-market distress signals & Revzenta Opportunity Scores.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn ${unreadAlertCount > 0 ? "btn-primary" : "btn-secondary"}`}
            onClick={() => { setShowAlertsModal(true); loadDistressAlerts(); }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            title="Automated Property Distress Alerts & Pre-Foreclosure Monitor"
          >
            <span>🚨</span>
            <span>Distress Alerts</span>
            {unreadAlertCount > 0 && (
              <span style={{
                background: "#ef4444", color: "#fff", fontSize: "11px", fontWeight: 700,
                borderRadius: "999px", padding: "1px 6px", marginLeft: "2px"
              }}>
                {unreadAlertCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setShowProvidersModal(true); loadProviders(); }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            title="Configured Data Providers & Conflict Resolution Engine"
          >
            <span>📡</span>
            <span>Providers ({providers.filter(p => p.isAvailable).length}/{providers.length || 2})</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenSavedSearches}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span>📁</span>
            <span>Saved Searches</span>
          </button>

          {user.role === "admin" && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleOpenDevCenter}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              title="Dev Command Center (Admin telemetry & query performance)"
            >
              <span>⚙️</span>
              <span>Dev Console</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#ef4444", marginBottom: "16px" }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", color: "#10b981", marginBottom: "16px" }}>
          {successMsg}
        </div>
      )}

      {/* AI Natural Language Search Card */}
      <div style={{
        background: "var(--card-bg, #1e293b)",
        border: "1px solid var(--border-color, #334155)",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "20px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
      }}>
        <form onSubmit={(e) => handleAiSearch(e)}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 500px", position: "relative" }}>
              <input
                type="text"
                className="input"
                style={{ width: "100%", paddingLeft: "38px", height: "46px", fontSize: "15px" }}
                placeholder="Ask Gemini AI: e.g. Find absentee owners in Maricopa County with properties worth $300k-$600k and >40% equity..."
                value={naturalQuery}
                onChange={(e) => setNaturalQuery(e.target.value)}
              />
              <span style={{ position: "absolute", left: "12px", top: "14px", fontSize: "18px" }}>✨</span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isTranslating || loading}
              style={{ height: "46px", padding: "0 20px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              {isTranslating ? "Translating with AI..." : "Search with AI"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowFilters(!showFilters)}
              style={{ height: "46px", padding: "0 16px" }}
            >
              {showFilters ? "Hide Filters ▲" : "Filters & Criteria ▼"}
            </button>
          </div>
        </form>

        {/* Quick Sample Queries */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontWeight: 500 }}>Try queries:</span>
          {[
            "Absentee owners in Maricopa County $300k-$600k >40% equity",
            "Vacant houses with back taxes in Florida under $250k",
            "Pre-foreclosure single family in Dallas Texas with high equity",
          ].map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => {
                setNaturalQuery(sample);
                handleAiSearch(undefined, sample);
              }}
              style={{
                fontSize: "12px",
                padding: "4px 10px",
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border-color, #334155)",
                color: "var(--text-muted, #cbd5e1)",
                cursor: "pointer",
              }}
            >
              {sample}
            </button>
          ))}
        </div>

        {/* AI Interpretation Banner */}
        {aiInterpretation && (
          <div style={{
            marginTop: "16px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: usedAiFlag ? "rgba(139, 92, 246, 0.1)" : "rgba(59, 130, 246, 0.1)",
            border: `1px solid ${usedAiFlag ? "#8b5cf6" : "#3b82f6"}`,
            fontSize: "13px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <strong>{usedAiFlag ? "✨ Gemini AI Interpretation:" : "🎯 Search Criteria Applied:"}</strong> {aiInterpretation}
            </div>
            {modelUsed && (
              <span style={{ fontSize: "11px", opacity: 0.7, marginLeft: "10px" }}>Model: {modelUsed}</span>
            )}
          </div>
        )}

        {/* Advanced Filters Drawer */}
        {showFilters && (
          <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--border-color, #334155)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>State (2-Letter)</label>
                <input
                  type="text"
                  maxLength={2}
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="AZ, FL, TX..."
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>County</label>
                <input
                  type="text"
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="Maricopa, Cook..."
                  value={countyFilter}
                  onChange={(e) => setCountyFilter(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>City</label>
                <input
                  type="text"
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="Phoenix, Tampa..."
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>ZIP Code</label>
                <input
                  type="text"
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="85001..."
                  value={zipFilter}
                  onChange={(e) => setZipFilter(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Min Value ($)</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="200000"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Max Value ($)</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="600000"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Min Equity %</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="40"
                  value={minEquityPct}
                  onChange={(e) => setMinEquityPct(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Property Type</label>
                <select
                  className="input"
                  style={{ width: "100%" }}
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="Single Family">Single Family</option>
                  <option value="Multi-Family">Multi-Family</option>
                  <option value="Condo">Condo / Townhouse</option>
                </select>
              </div>
            </div>

            {/* Motivation Toggles */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>Distress & Seller Motivations:</label>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={isAbsentee} onChange={(e) => setIsAbsentee(e.target.checked)} />
                  <span>Absentee Owner</span>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={isVacant} onChange={(e) => setIsVacant(e.target.checked)} />
                  <span>Vacant Property</span>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={isTaxDelinquent} onChange={(e) => setIsTaxDelinquent(e.target.checked)} />
                  <span>Tax Delinquent</span>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={isPreForeclosure} onChange={(e) => setIsPreForeclosure(e.target.checked)} />
                  <span>Pre-Foreclosure</span>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={isProbate} onChange={(e) => setIsProbate(e.target.checked)} />
                  <span>Probate / Estate</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => runSearch()}
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setStateFilter(""); setCountyFilter(""); setCityFilter(""); setZipFilter("");
                    setMinValue(""); setMaxValue(""); setMinEquityPct(""); setPropertyType("");
                    setIsAbsentee(false); setIsVacant(false); setIsTaxDelinquent(false);
                    setIsPreForeclosure(false); setIsProbate(false);
                    runSearch({});
                  }}
                >
                  Reset
                </button>
              </div>

              {/* Save current search */}
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Name this search..."
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  style={{ width: "200px" }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!saveSearchName.trim() || savingSearch}
                  onClick={handleSaveSearch}
                >
                  {savingSearch ? "Saving..." : "Save Search"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <span style={{ fontSize: "16px", fontWeight: 600 }}>
            {loading ? "Searching properties..." : `${totalCount} Properties Found`}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>Sort by:</span>
          <select
            className="input"
            value={sortBy}
            onChange={(e) => {
              const val = e.target.value as any;
              setSortBy(val);
              runSearch({ ...buildFiltersObject(), sortBy: val });
            }}
            style={{ padding: "4px 8px", fontSize: "13px" }}
          >
            <option value="revzenta_opportunity_score">Revzenta Opportunity Score</option>
            <option value="estimated_value">Estimated Value</option>
            <option value="estimated_equity">Estimated Equity</option>
          </select>
        </div>
      </div>

      {/* Properties Table / Grid */}
      {properties.length === 0 && !loading ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          background: "var(--card-bg, #1e293b)",
          borderRadius: "12px",
          border: "1px dashed var(--border-color, #334155)"
        }}>
          <span style={{ fontSize: "36px", display: "block", marginBottom: "12px" }}>🔍</span>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "18px" }}>No Properties Found</h3>
          <p style={{ margin: "0 0 16px 0", color: "var(--text-muted, #94a3b8)", fontSize: "14px" }}>
            Try widening your geographic boundaries or loosening equity and distress requirements.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => runSearch({})}>
            View All Properties
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
          {properties.map((prop) => {
            const equityPct = prop.estimated_value > 0
              ? Math.round((prop.estimated_equity / prop.estimated_value) * 100)
              : 0;

            return (
              <div
                key={prop.id}
                style={{
                  background: "var(--card-bg, #1e293b)",
                  border: "1px solid var(--border-color, #334155)",
                  borderRadius: "12px",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
              >
                <div>
                  {/* Top bar: Score Badge & Property Type */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    {renderScoreBadge(prop.revzenta_opportunity_score || 0)}
                    <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {prop.property_type || "Single Family"}
                    </span>
                  </div>

                  {/* Address */}
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700 }}>
                    {prop.address_line1}
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", marginBottom: "12px" }}>
                    {prop.city}, {prop.state} {prop.zip} · {prop.county} County
                  </div>

                  {/* Financial Grid */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    background: "rgba(0,0,0,0.2)",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    marginBottom: "12px"
                  }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>Est. Value</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc" }}>
                        ${prop.estimated_value ? prop.estimated_value.toLocaleString() : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>Est. Equity</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "#10b981" }}>
                        {equityPct}% (${prop.estimated_equity ? Math.round(prop.estimated_equity).toLocaleString() : "0"})
                      </div>
                    </div>
                  </div>

                  {/* Specs */}
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #cbd5e1)", marginBottom: "12px" }}>
                    {prop.bedrooms ? `${prop.bedrooms} Beds · ` : ""}
                    {prop.bathrooms ? `${prop.bathrooms} Baths · ` : ""}
                    {prop.square_feet ? `${prop.square_feet.toLocaleString()} SqFt · ` : ""}
                    {prop.year_built ? `Built ${prop.year_built}` : ""}
                  </div>

                  {/* Distress Tags */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                    {prop.is_absentee_owner && (
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                        Absentee Owner
                      </span>
                    )}
                    {prop.is_vacant && (
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                        Vacant
                      </span>
                    )}
                    {prop.tax_delinquent && (
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                        Tax Delinquent
                      </span>
                    )}
                    {prop.is_pre_foreclosure && (
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(220, 38, 38, 0.2)", color: "#f87171" }}>
                        Pre-Foreclosure
                      </span>
                    )}
                    {prop.is_probate && (
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}>
                        Probate
                      </span>
                    )}
                  </div>

                  {/* Source & Provenance Tag */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <span>📡</span>
                      <span>Source: {prop.source_provider || "unified"}</span>
                    </span>
                    {prop.updated_at && (
                      <span style={{ fontSize: "10px" }}>
                        Synced {new Date(prop.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: "flex", gap: "6px", borderTop: "1px solid var(--border-color, #334155)", paddingTop: "12px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: "1 1 90px", fontSize: "11px", padding: "6px 8px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "4px" }}
                    disabled={enrichingId === prop.id}
                    onClick={() => handleLiveEnrich(prop)}
                    title="Live multi-source refresh (RentCast + Attom Data Solutions)"
                  >
                    <span>{enrichingId === prop.id ? "⏳" : "🔄"}</span>
                    <span>{enrichingId === prop.id ? "Enriching..." : "Live Enrich"}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: "1 1 90px", fontSize: "11px", padding: "6px 8px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "4px" }}
                    onClick={() => handleExplainDeal(prop)}
                  >
                    <span>🧠</span>
                    <span>AI Deal</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: "1 1 90px", fontSize: "11px", padding: "6px 8px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "4px" }}
                    disabled={convertingId === prop.id}
                    onClick={() => handleConvertToLead(prop)}
                  >
                    <span>➕</span>
                    <span>{convertingId === prop.id ? "Adding..." : "Convert"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Deal Analysis Modal */}
      {selectedPropertyForExplanation && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: "20px"
        }}>
          <div style={{
            background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)",
            borderRadius: "14px", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto",
            padding: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🧠</span>
                  <span>Revzenta Deal Intelligence</span>
                </h2>
                <div style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
                  {selectedPropertyForExplanation.address_line1}, {selectedPropertyForExplanation.city}, {selectedPropertyForExplanation.state}
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

            {loadingExplanation ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <div style={{ fontSize: "24px", marginBottom: "12px" }}>✨</div>
                <div>Analyzing property equity, market spread, and wholesale angles...</div>
              </div>
            ) : explanation ? (
              <div>
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
                      <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>Equity Cushion</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#10b981" }}>
                        {explanation.opportunityScoreBreakdown.equityScore}/35
                      </div>
                    </div>
                    <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color, #334155)" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>Distress Factors</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#f59e0b" }}>
                        {explanation.opportunityScoreBreakdown.distressScore}/40
                      </div>
                    </div>
                    <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color, #334155)" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>Valuation Spread</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#3b82f6" }}>
                        {explanation.opportunityScoreBreakdown.spreadScore}/25
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginTop: "8px", fontStyle: "italic" }}>
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

                {/* Strategy Suitability */}
                <div style={{ marginBottom: "18px" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: 600 }}>
                    Recommended Wholesale Exit Strategies
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
                          alignItems: "center"
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, fontSize: "13px" }}>{strat.strategy}</span>
                          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>
                            {strat.rationale}
                          </p>
                        </div>
                        <div style={{ textAlign: "right", marginLeft: "14px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#10b981" }}>
                            {strat.suitabilityScore}%
                          </span>
                          <div style={{ fontSize: "10px", color: "var(--text-muted, #94a3b8)" }}>Suitability</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disclaimer */}
                <div style={{ fontSize: "11px", color: "var(--text-muted, #64748b)", borderTop: "1px solid var(--border-color, #334155)", paddingTop: "10px" }}>
                  ℹ️ {explanation.dataDisclaimer}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Saved Searches Drawer Modal */}
      {showSavedSearches && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: "20px"
        }}>
          <div style={{
            background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)",
            borderRadius: "14px", width: "100%", maxWidth: "560px", maxHeight: "80vh", overflowY: "auto",
            padding: "24px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Saved Searches</h2>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSavedSearches(false)}
                style={{ padding: "4px 10px" }}
              >
                ✕
              </button>
            </div>

            {savedSearches.length === 0 ? (
              <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "14px" }}>
                No saved searches found. Save your favorite criteria from the Filters bar.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {savedSearches.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color, #334155)",
                      background: "rgba(0,0,0,0.2)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>{s.name}</h4>
                      {s.natural_language_query && (
                        <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>
                          "{s.natural_language_query}"
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <button
                        type="button"
                        className={`btn ${s.alert_enabled ? "btn-primary" : "btn-secondary"}`}
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        onClick={() => handleToggleSavedSearchAlert(s)}
                        title={s.alert_enabled ? "Distress alerts active. Click to disable." : "Click to enable automated distress alerts for this search"}
                      >
                        {s.alert_enabled ? "🔔 Alerts On" : "🔕 Alerts Off"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => handleExecuteSavedSearch(s)}
                      >
                        Run
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "12px", color: "#f87171" }}
                        onClick={() => handleDeleteSavedSearch(s.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dev Command Center Modal (Admin Only) */}
      {showDevCenter && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: "20px"
        }}>
          <div style={{
            background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)",
            borderRadius: "14px", width: "100%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto",
            padding: "24px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚙️</span>
                <span>Revzenta Dev Command Center (Admin Observability)</span>
              </h2>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDevCenter(false)}
                style={{ padding: "4px 10px" }}
              >
                ✕
              </button>
            </div>

            {devStatus && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color, #334155)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>DB Driver</div>
                    <div style={{ fontSize: "15px", fontWeight: 700, textTransform: "uppercase" }}>{devStatus.database.driver}</div>
                    <div style={{ fontSize: "11px", color: devStatus.database.isHealthy ? "#10b981" : "#ef4444" }}>
                      {devStatus.database.isHealthy ? "● Healthy" : "● Unhealthy"}
                    </div>
                  </div>
                  <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color, #334155)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>Properties Ingested</div>
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>{devStatus.database.propertiesTotal}</div>
                  </div>
                  <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color, #334155)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>Gemini AI Model</div>
                    <div style={{ fontSize: "14px", fontWeight: 700 }}>{devStatus.geminiAi.model}</div>
                    <div style={{ fontSize: "10px", color: devStatus.geminiAi.isConfigured ? "#10b981" : "#f59e0b" }}>
                      {devStatus.geminiAi.isConfigured ? "Key: Configured" : "Offline NLP Fallback"}
                    </div>
                  </div>
                  <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color, #334155)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>Memory (RSS)</div>
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>{devStatus.memoryUsage.rssMb} MB</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted, #94a3b8)" }}>Uptime: {devStatus.uptimeSeconds}s</div>
                  </div>
                </div>

                <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginBottom: "16px" }}>
                  Active Providers: {devStatus.providers.activeProviders.join(", ") || "None"}
                </div>
              </div>
            )}

            {/* Read-only Query Tester */}
            <div>
              <h4 style={{ margin: "0 0 6px 0", fontSize: "14px" }}>Read-Only SQL Query Performance Tester</h4>
              <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>
                Strictly restricted to SELECT/EXPLAIN queries. Destructive statements (DROP, DELETE, UPDATE) are blocked server-side.
              </p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input
                  type="text"
                  className="input"
                  value={devQuerySql}
                  onChange={(e) => setDevQuerySql(e.target.value)}
                  style={{ flex: 1, fontFamily: "monospace", fontSize: "12px" }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={runningDevQuery}
                  onClick={handleRunDevQuery}
                >
                  {runningDevQuery ? "Running..." : "Explain / Run"}
                </button>
              </div>

              {devQueryResult && (
                <div style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "#0f172a",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  maxHeight: "220px",
                  overflowY: "auto",
                  border: "1px solid var(--border-color, #334155)"
                }}>
                  {devQueryResult.error ? (
                    <div style={{ color: "#ef4444" }}>Error: {devQueryResult.error}</div>
                  ) : (
                    <div>
                      <div style={{ color: "#10b981", marginBottom: "6px" }}>
                        ✓ {devQueryResult.rowCount} rows returned in {devQueryResult.executionTimeMs}ms
                      </div>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(devQueryResult.rows, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Distress Alerts Drawer / Modal */}
      {showAlertsModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: "20px"
        }}>
          <div style={{
            background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)",
            borderRadius: "14px", width: "100%", maxWidth: "720px", maxHeight: "85vh", overflowY: "auto",
            padding: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🚨</span>
                  <span>Property Distress Alerts & Off-Market Monitor</span>
                </h2>
                <div style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
                  Real-time alerts for pre-foreclosures, tax delinquencies, vacancies, and high opportunity scores.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAlertsModal(false)}
                style={{ padding: "4px 10px", fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            {/* Top Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>
                  {distressAlerts.length} Total Alerts
                </span>
                {unreadAlertCount > 0 && (
                  <span style={{
                    fontSize: "11px", fontWeight: 700, background: "#ef4444", color: "#fff",
                    padding: "2px 8px", borderRadius: "12px"
                  }}>
                    {unreadAlertCount} Unread
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                  disabled={scanningDistress}
                  onClick={handleScanDistress}
                >
                  {scanningDistress ? "Scanning..." : "⚡ Run Distress Scan"}
                </button>
                {unreadAlertCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                    onClick={() => handleMarkAlertsRead()}
                  >
                    Mark All Read
                  </button>
                )}
              </div>
            </div>

            {/* Alerts List */}
            {loadingAlerts ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)" }}>
                Loading distress alerts...
              </div>
            ) : distressAlerts.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "40px 20px", background: "rgba(0,0,0,0.15)",
                borderRadius: "10px", border: "1px dashed var(--border-color, #334155)"
              }}>
                <span style={{ fontSize: "28px", display: "block", marginBottom: "8px" }}>🛡️</span>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "15px" }}>No Active Distress Alerts</h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
                  Saved searches with alert monitoring enabled will automatically trigger notifications when new distressed properties are detected.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {distressAlerts.map((alert) => {
                  const severityColors: Record<string, string> = {
                    urgent: "#ef4444",
                    high: "#f59e0b",
                    medium: "#3b82f6",
                    low: "#94a3b8",
                  };
                  const color = severityColors[alert.severity] || "#3b82f6";

                  return (
                    <div
                      key={alert.id}
                      style={{
                        background: alert.is_read ? "rgba(0,0,0,0.2)" : "rgba(239, 68, 68, 0.04)",
                        border: `1px solid ${alert.is_read ? "var(--border-color, #334155)" : color + "60"}`,
                        borderLeft: `4px solid ${color}`,
                        borderRadius: "10px",
                        padding: "14px 16px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
                            padding: "2px 6px", borderRadius: "4px", background: `${color}20`, color
                          }}>
                            {alert.severity}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>
                            {new Date(alert.created_at).toLocaleString()}
                          </span>
                        </div>
                        {!alert.is_read && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "2px 8px", fontSize: "11px" }}
                            onClick={() => handleMarkAlertsRead([alert.id])}
                          >
                            Mark Read
                          </button>
                        )}
                      </div>

                      <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: 700 }}>
                        {alert.headline}
                      </h4>

                      {alert.property && (
                        <div style={{
                          display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap",
                          fontSize: "12px", color: "var(--text-muted, #cbd5e1)", marginBottom: "10px"
                        }}>
                          <span>Est. Value: <strong>${alert.property.estimated_value?.toLocaleString() || "—"}</strong></span>
                          <span>Est. Equity: <strong style={{ color: "#10b981" }}>${alert.property.estimated_equity?.toLocaleString() || "0"}</strong></span>
                          <span>Score: <strong>{alert.property.revzenta_opportunity_score || 0}/100</strong></span>
                        </div>
                      )}

                      {/* Action buttons on alert */}
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        {alert.property && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ fontSize: "11px", padding: "4px 10px" }}
                            disabled={convertingId === alert.property.id}
                            onClick={() => {
                              if (alert.property) handleConvertToLead(alert.property as any);
                            }}
                          >
                            ➕ Convert Property to Lead
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: "11px", padding: "4px 10px" }}
                          onClick={() => {
                            setShowAlertsModal(false);
                            if (alert.property) {
                              runSearch({ state: alert.property.state, city: alert.property.city });
                            }
                          }}
                        >
                          🔍 View Market
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Providers Modal */}
      {showProvidersModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: "20px"
        }}>
          <div style={{
            background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)",
            borderRadius: "14px", width: "100%", maxWidth: "680px", maxHeight: "85vh", overflowY: "auto",
            padding: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📡</span>
                  <span>Registered Data Providers & Conflict Resolution</span>
                </h2>
                <div style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
                  Multi-provider ingestion layer with deterministic valuation blending & provenance tracking.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowProvidersModal(false)}
                style={{ padding: "4px 10px", fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            {loadingProviders ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)" }}>
                Checking provider statuses...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                {providers.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid var(--border-color, #334155)",
                      borderRadius: "10px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>{p.name}</h4>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "12px",
                        background: p.isAvailable ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.15)",
                        color: p.isAvailable ? "#10b981" : "#94a3b8"
                      }}>
                        {p.isAvailable ? "🟢 Configured & Active" : "⚪ Offline / Key Unset"}
                      </span>
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--text-muted, #cbd5e1)", marginBottom: "8px" }}>
                      Supported Domains:
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {p.types.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: "11px", padding: "2px 8px", borderRadius: "6px",
                            background: "rgba(255,255,255,0.06)", color: "var(--text-muted, #94a3b8)"
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Architecture Details */}
            <div style={{
              background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: "10px", padding: "16px"
            }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#60a5fa", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>⚖️</span>
                <span>Deterministic Conflict Resolution Pipeline</span>
              </h4>
              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", lineHeight: "1.6", color: "var(--text-muted, #cbd5e1)" }}>
                <li><strong>Valuation Blending:</strong> Resolves discrepancies using confidence-weighted averages and flags valuation spreads exceeding 20%.</li>
                <li><strong>Specification Priority:</strong> Verified public records and county assessor records take precedence over secondary AVM estimates.</li>
                <li><strong>Distress Union:</strong> Motivations (pre-foreclosure, tax delinquency, vacant, absentee) are union-merged across all registered providers to ensure zero missed wholesale opportunities.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
