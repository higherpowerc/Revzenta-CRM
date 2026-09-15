import React, { useState } from "react";
import { api } from "./api";
import type { User, SubscriberOnboardingData } from "./types";
import revzentaLogo from "./assets/revzenta-logo.png";

interface SubscriberOnboardingProps {
  user: User;
  onComplete: (user: User) => void;
}

export const SubscriberOnboarding: React.FC<SubscriberOnboardingProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Operating Identity & Market
  const [operatingType, setOperatingType] = useState<"business" | "individual">("business");
  const [legalName, setLegalName] = useState(user.orgName || "");
  const [primaryMarketCity, setPrimaryMarketCity] = useState("Detroit, MI");

  // Step 2: Communications & Title
  const [useAlternateEmail, setUseAlternateEmail] = useState(false);
  const [alternateEmail, setAlternateEmail] = useState("");
  const [preferredTitleCompany, setPreferredTitleCompany] = useState("");

  const [seedDemoLead, setSeedDemoLead] = useState(true);

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!legalName.trim()) {
        setError(
          operatingType === "business"
            ? "Please enter your registered Business / Entity Name."
            : "Please enter your Full Legal Name."
        );
        return;
      }
      if (!primaryMarketCity.trim()) {
        setError("Please enter your primary operating market (City, State).");
        return;
      }
      setStep(2);
    }
  };

  const handleFinish = async () => {
    setError(null);
    if (useAlternateEmail && !alternateEmail.trim()) {
      setError("Please enter your alternate communications email address.");
      return;
    }
    if (useAlternateEmail && !alternateEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const finalEmail = useAlternateEmail && alternateEmail.trim() ? alternateEmail.trim() : user.email;
      const payload: SubscriberOnboardingData = {
        operatingType,
        legalName: legalName.trim(),
        companyLegalName: legalName.trim(),
        primaryMarketCity: primaryMarketCity.trim(),
        useAlternateEmail,
        communicationsEmail: finalEmail,
        preferredTitleCompany: preferredTitleCompany.trim(),
        seedDemoLead,
      };

      const res = await api.completeSubscriberOnboarding(payload);
      if (res && res.user) {
        onComplete(res.user);
      } else {
        setError("Unable to save onboarding setup. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred while saving your onboarding setup.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "8px",
    padding: "11px 14px",
    color: "#f8fafc",
    fontSize: "14px",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "#cbd5e1",
    marginBottom: "6px",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "linear-gradient(135deg, #090d16 0%, #0d1527 50%, #07090e 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        overflowY: "auto",
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: "absolute",
          width: "550px",
          height: "550px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(214, 255, 63, 0.08) 0%, rgba(59, 130, 246, 0.04) 50%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "640px",
          background: "rgba(15, 23, 42, 0.96)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "18px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(214, 255, 63, 0.12)",
          padding: "36px",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Header Branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: "20px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src={revzentaLogo} alt="Revzenta" style={{ height: "32px", width: "auto" }} />
            <div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.3px" }}>
                Revzenta Wholesale Workspace
              </div>
              <div style={{ fontSize: "12px", color: "var(--lime, #d6ff3f)", fontWeight: 600 }}>
                Mandatory Setup &amp; Calibration
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              background: "rgba(214, 255, 63, 0.12)",
              color: "var(--lime, #d6ff3f)",
              padding: "4px 10px",
              borderRadius: "20px",
              border: "1px solid rgba(214, 255, 63, 0.3)",
            }}
          >
            Step {step} of 2
          </div>
        </div>

        {/* Stepper Indicator */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "28px" }}>
          {[
            { num: 1, title: "1. Operating Identity & Market" },
            { num: 2, title: "2. Communications & Title" },
          ].map((s) => {
            const isDone = s.num < step;
            const isCurrent = s.num === step;
            return (
              <div key={s.num} style={{ textAlign: "center" }}>
                <div
                  style={{
                    height: "4px",
                    borderRadius: "2px",
                    background: isCurrent ? "var(--lime, #d6ff3f)" : isDone ? "#3b82f6" : "rgba(255,255,255,0.1)",
                    transition: "all 0.3s ease",
                    marginBottom: "6px",
                  }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? "var(--lime, #d6ff3f)" : isDone ? "#cbd5e1" : "#64748b",
                  }}
                >
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "13px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {/* STEP 1: Operating Identity & Market */}
        {step === 1 && (
          <div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "19px", fontWeight: 700, color: "#f8fafc" }}>
              How do you operate your real estate business?
            </h2>
            <p style={{ margin: "0 0 22px 0", fontSize: "13px", color: "#94a3b8", lineHeight: 1.5 }}>
              Choose whether you make wholesale offers and sign agreements as an individual or under a registered business entity.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Operating Type Selector */}
              <div>
                <label style={labelStyle}>Operating Structure *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setOperatingType("business")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: `2px solid ${operatingType === "business" ? "var(--lime, #d6ff3f)" : "rgba(255,255,255,0.1)"}`,
                      background: operatingType === "business" ? "rgba(214, 255, 63, 0.08)" : "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "18px" }}>🏢</span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>Business Entity</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.3 }}>
                      Operate under an LLC, Corp, or Partnership
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOperatingType("individual")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: `2px solid ${operatingType === "individual" ? "var(--lime, #d6ff3f)" : "rgba(255,255,255,0.1)"}`,
                      background: operatingType === "individual" ? "rgba(214, 255, 63, 0.08)" : "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "18px" }}>👤</span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>Individual</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.3 }}>
                      Operate under your personal legal name
                    </span>
                  </button>
                </div>
              </div>

              {/* Name Field */}
              <div>
                <label style={labelStyle}>
                  {operatingType === "business" ? "Legal Business / Entity Name *" : "Full Legal Name *"}
                </label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder={operatingType === "business" ? "e.g. Apex Real Estate Acquisitions LLC" : "e.g. Marcus Vance"}
                  style={inputStyle}
                  required
                />
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "5px", display: "block" }}>
                  {operatingType === "business"
                    ? "Pre-filled as Buyer/Assignor on state Purchase & Sale Agreements (PSA) and assignment contracts."
                    : "Your personal legal name will appear as Buyer/Assignor on state contracts and transaction documents."}
                </span>
              </div>

              {/* Primary Market */}
              <div>
                <label style={labelStyle}>Primary Operating Market (City, State) *</label>
                <input
                  type="text"
                  value={primaryMarketCity}
                  onChange={(e) => setPrimaryMarketCity(e.target.value)}
                  placeholder="e.g. Detroit, MI or Dallas-Fort Worth, TX"
                  style={inputStyle}
                  required
                />
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "5px", display: "block" }}>
                  Intelligent Search, property pipeline, and comp lookups will default to this geographic territory.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Communications & Title */}
        {step === 2 && (
          <div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "19px", fontWeight: 700, color: "#f8fafc" }}>
              Communications &amp; Title Setup
            </h2>
            <p style={{ margin: "0 0 22px 0", fontSize: "13px", color: "#94a3b8", lineHeight: 1.5 }}>
              Choose your communication email for sellers, buyers, and title companies, and optionally list your preferred title company.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Communications Email Choice */}
              <div>
                <label style={labelStyle}>Email for Transaction Communications *</label>
                <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#94a3b8" }}>
                  Which email address would you like to use when communicating with sellers, buyers, and title companies?
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      background: !useAlternateEmail ? "rgba(214, 255, 63, 0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${!useAlternateEmail ? "rgba(214, 255, 63, 0.4)" : "rgba(255,255,255,0.1)"}`,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="email_choice"
                      checked={!useAlternateEmail}
                      onChange={() => setUseAlternateEmail(false)}
                      style={{ accentColor: "var(--lime, #d6ff3f)", cursor: "pointer" }}
                    />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc" }}>
                        Use my signup email address
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--lime, #d6ff3f)" }}>
                        {user.email}
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      background: useAlternateEmail ? "rgba(214, 255, 63, 0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${useAlternateEmail ? "rgba(214, 255, 63, 0.4)" : "rgba(255,255,255,0.1)"}`,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="email_choice"
                      checked={useAlternateEmail}
                      onChange={() => setUseAlternateEmail(true)}
                      style={{ accentColor: "var(--lime, #d6ff3f)", cursor: "pointer" }}
                    />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc" }}>
                        Use an alternate email address
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                        Specify a separate inbox for deal communications and contracts
                      </div>
                    </div>
                  </label>

                  {useAlternateEmail && (
                    <div style={{ marginTop: "6px" }}>
                      <input
                        type="email"
                        value={alternateEmail}
                        onChange={(e) => setAlternateEmail(e.target.value)}
                        placeholder="e.g. acquisitions@mycompany.com"
                        style={inputStyle}
                        required
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Title Company (Optional) */}
              <div>
                <label style={labelStyle}>Title Company Name (Optional)</label>
                <input
                  type="text"
                  value={preferredTitleCompany}
                  onChange={(e) => setPreferredTitleCompany(e.target.value)}
                  placeholder="e.g. First American Title, Fidelity National, or local closing attorney"
                  style={inputStyle}
                />
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "5px", display: "block" }}>
                  Not required to get started. You can always add or update your title company later inside Title Hub.
                </span>
              </div>

              {/* Seed Demo Lead Option */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  background: "rgba(214, 255, 63, 0.05)",
                  border: "1px solid rgba(214, 255, 63, 0.2)",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  marginTop: "4px",
                }}
              >
                <input
                  type="checkbox"
                  checked={seedDemoLead}
                  onChange={(e) => setSeedDemoLead(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--lime, #d6ff3f)", cursor: "pointer" }}
                />
                <span style={{ fontSize: "13px", color: "#e2e8f0" }}>
                  <strong>Seed a sample distressed opportunity</strong> in Hunters Hub with complete underwriting and comp data
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: step > 1 ? "space-between" : "flex-end",
            alignItems: "center",
            marginTop: "28px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "20px",
          }}
        >
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                padding: "10px 18px",
                color: "#94a3b8",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ← Back to Step 1
            </button>
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={handleNext}
              style={{
                background: "linear-gradient(90deg, #d6ff3f, #bef264)",
                color: "#0f172a",
                border: "none",
                borderRadius: "8px",
                padding: "11px 26px",
                fontSize: "14px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(214, 255, 63, 0.25)",
              }}
            >
              Continue to Step 2 →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={loading}
              style={{
                background: "linear-gradient(90deg, #d6ff3f, #bef264)",
                color: "#0f172a",
                border: "none",
                borderRadius: "8px",
                padding: "12px 28px",
                fontSize: "14px",
                fontWeight: 800,
                cursor: loading ? "wait" : "pointer",
                boxShadow: "0 4px 20px rgba(214, 255, 63, 0.35)",
              }}
            >
              {loading ? "Activating Workspace..." : "Complete Setup & Enter Workspace 🚀"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
