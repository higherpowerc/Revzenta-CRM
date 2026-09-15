
import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "./api";
import type { User } from "./types";
import revzentaLogo from "./assets/revzenta-logo.png";
import { ALL_US_STATES, getStateComplianceRule } from "./stateWholesaleCompliance";

interface SignupProps {
  onSuccess: (user: User) => void;
  onSignIn: () => void;
  initialTier?: string;
}

type Tier = "starter" | "pro" | "scale";

const PLANS = {
  starter: {
    name: "Starter Wholesaler",
    badge: "⚡ Starter",
    monthly: 24.99,
    annual: 19.99,
    color: "#06b6d4",
    borderColor: "rgba(6,182,212,0.35)",
    glowColor: "rgba(6,182,212,0.15)",
    features: [
      "Unlimited pipeline leads & contacts",
      "Inbound Webhook lead ingestion",
      "PropStream CSV & BatchLeads import",
      "Cash buyer directory & criteria tagging",
      "Daily task management & reminders",
      "Wholesale ROI / MAO calculator",
      "Dark / Light mode adaptive UI",
    ],
  },
  pro: {
    name: "Wholesale Pro",
    badge: "🔥 Pro",
    monthly: 59.99,
    annual: 47.99,
    color: "#8b5cf6",
    borderColor: "rgba(139,92,246,0.45)",
    glowColor: "rgba(139,92,246,0.18)",
    features: [
      "Everything in Starter",
      "1-Click RentCast property specs & AVM",
      "Automated Buy Box Matcher scoring",
      "Document & Transaction Hub",
      "Digital e-signatures for PSA & Assignment",
      "Inspection & EMD countdown clocks",
      "Shared Title Company Escrow Portal",
    ],
  },
  scale: {
    name: "Scale Empire",
    badge: "👑 Scale",
    monthly: 79,
    annual: 63.2,
    color: "#f59e0b",
    borderColor: "rgba(245,158,11,0.45)",
    glowColor: "rgba(245,158,11,0.15)",
    features: [
      "Everything in Pro",
      "Multi-seat team accounts & permissions",
      "Role-based tab controls (Acquisitions vs Dispo)",
      "Custom state contract templates & riders",
      "Priority API rate limits",
      "Dedicated onboarding specialist",
      "24/7 Priority support",
    ],
  },
};

export default function Signup({ onSuccess, onSignIn, initialTier = "pro" }: SignupProps) {
  const [selectedTier, setSelectedTier] = useState<Tier>(() => {
    const t = initialTier.toLowerCase();
    return (t === "starter" || t === "scale" ? t : "pro") as Tier;
  });
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [operatingState, setOperatingState] = useState("TX");
  const [isLicensed, setIsLicensed] = useState<"yes" | "no" | "">("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [stateAgreementAgreed, setStateAgreementAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const readHash = () => {
      const h = window.location.hash;
      const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
      const sp = new URLSearchParams(q);
      const t = sp.get("tier") || "";
      if (t === "starter" || t === "pro" || t === "scale") setSelectedTier(t as Tier);
      const s = sp.get("state") || "";
      if (s && ALL_US_STATES.some(st => st.code.toUpperCase() === s.toUpperCase())) {
        setOperatingState(s.toUpperCase());
      }
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const plan = PLANS[selectedTier];
  const price = billing === "annual" ? plan.annual : plan.monthly;
  const tierOrder: Tier[] = ["starter", "pro", "scale"];
  const stateRule = getStateComplianceRule(operatingState);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { setError("Please agree to the Master Customer Agreement, Terms, and Privacy Policy."); return; }
    if (!stateAgreementAgreed) {
      setError(`Please review and accept the ${stateRule.name} Wholesaling Compliance Schedule & Statutory Addendum.`);
      return;
    }
    if (stateRule.category === "license_required" && !isLicensed) {
      setError(`Please confirm your real estate licensing status for ${stateRule.name}.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.signup({
        workspaceName: workspaceName.trim(),
        email: email.trim().toLowerCase(),
        password,
        tier: selectedTier,
        billing,
        skipStripe: false,
        state: operatingState,
        isLicensed: isLicensed === "yes",
        licenseNumber: licenseNumber.trim(),
        stateAgreementStatute: stateRule.citation,
      });
      if (res.checkoutUrl) {
        setSuccess("Redirecting to secure checkout — your workspace activates after payment…");
        setTimeout(() => { window.location.href = res.checkoutUrl!; }, 800);
        return;
      }
      if (res.user) {
        setSuccess(res.message || "Account created! Welcome to Revzenta CRM 🎉");
        setTimeout(() => { onSuccess(res.user!); }, 1200);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agreed, stateAgreementAgreed, operatingState, stateRule, isLicensed, licenseNumber, workspaceName, email, password, selectedTier, billing, onSuccess]);

  const inp: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "9px", padding: "11px 14px",
    fontSize: "14px", color: "#f1f5f9",
    outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
    colorScheme: "dark",
  };

  const focus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = plan.color;
    e.target.style.boxShadow = `0 0 0 3px ${plan.glowColor}`;
  };
  const blur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(255,255,255,0.1)";
    e.target.style.boxShadow = "none";
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#060b18 0%,#0a0f1e 40%,#0d1128 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "24px 16px 60px",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      color: "#f1f5f9",
      colorScheme: "dark",
    }}>
      {/* Header */}
      <div style={{ width: "100%", maxWidth: "960px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <a href="#/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <img src={revzentaLogo} alt="Revzenta" style={{ height: "42px", width: "auto", borderRadius: "8px" }} />
        </a>
        <button type="button" onClick={onSignIn} style={{
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "8px", color: "#94a3b8", padding: "8px 16px", fontSize: "14px", cursor: "pointer",
        }}>
          Already have an account? <strong>Sign In</strong>
        </button>
      </div>

      <div style={{ width: "100%", maxWidth: "960px" }}>
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: "20px", padding: "5px 14px", fontSize: "13px", color: "#a5b4fc", marginBottom: "16px",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
            Secure Checkout • Instant Access After Payment
          </div>
          <h1 className="signup-title" style={{
            margin: "0 0 10px", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800,
            letterSpacing: "-0.5px", lineHeight: 1.2,
          }}>
            Revzenta: The Ultimate Wholesale Platform
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "16px" }}>
            Choose your plan, launch your workspace, and close more off-market deals.
          </p>
        </div>

        {/* Billing toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "28px" }}>
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "4px", display: "flex" }}>
            {(["monthly", "annual"] as const).map(b => (
              <button key={b} type="button" onClick={() => setBilling(b)} style={{
                padding: "6px 18px", borderRadius: "7px", border: "none", fontSize: "13px", fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
                background: billing === b ? "rgba(99,102,241,0.9)" : "transparent",
                color: billing === b ? "#fff" : "#64748b",
              }}>
                {b === "monthly" ? "Monthly" : "Annual — Save 20%"}
              </button>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "36px" }}>
          {tierOrder.map(t => {
            const p = PLANS[t];
            const isSelected = selectedTier === t;
            return (
              <button key={t} type="button" onClick={() => {
                setSelectedTier(t);
                window.history.replaceState(null, "", `#/signup?tier=${t}`);
              }} style={{
                background: isSelected ? `linear-gradient(145deg,${p.glowColor},rgba(15,23,42,0.95))` : "rgba(15,23,42,0.7)",
                color: "#f1f5f9",
                border: `2px solid ${isSelected ? p.color : "rgba(255,255,255,0.08)"}`,
                borderRadius: "14px", padding: "18px 16px", cursor: "pointer", textAlign: "left",
                transition: "all 0.25s", position: "relative",
                boxShadow: isSelected ? `0 0 30px ${p.glowColor}` : "none",
              }}>
                {t === "pro" && (
                  <div style={{
                    position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)",
                    background: "linear-gradient(90deg,#8b5cf6,#6366f1)", color: "#fff",
                    fontSize: "10px", fontWeight: 700, padding: "2px 10px", borderRadius: "10px", whiteSpace: "nowrap",
                  }}>MOST POPULAR</div>
                )}
                <div style={{ fontSize: "20px", marginBottom: "4px" }}>{p.badge}</div>
                <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "10px" }}>{p.name}</div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: isSelected ? p.color : "#f1f5f9", lineHeight: 1 }}>
                  ${billing === "annual" ? p.annual : p.monthly}
                  <span style={{ fontSize: "14px", fontWeight: 400, color: "#64748b" }}>/mo</span>
                </div>
                {isSelected && <div style={{ marginTop: "10px", fontSize: "12px", color: p.color, fontWeight: 600 }}>✓ Selected</div>}
              </button>
            );
          })}
        </div>

        {/* Two-column: features + form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", alignItems: "start" }}>
          {/* Left */}
          <div style={{
            background: "rgba(15,23,42,0.8)", border: `1px solid ${plan.borderColor}`,
            borderRadius: "16px", padding: "28px", boxShadow: `0 0 40px ${plan.glowColor}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <span style={{ fontSize: "24px" }}>{plan.badge.split(" ")[0]}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "18px", color: "#f1f5f9" }}>{plan.name}</div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>Billed {billing === "annual" ? "annually — save 20%" : "monthly"} • cancel anytime</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "6px" }}>
              <span style={{ fontSize: "42px", fontWeight: 800, color: plan.color }}>${price}</span>
              <span style={{ fontSize: "15px", color: "#64748b" }}>/month</span>
            </div>
            {billing === "annual" && (
              <div style={{ fontSize: "13px", color: "#4ade80", marginBottom: "16px" }}>
                You save ${(plan.monthly - plan.annual) * 12}/year with annual billing
              </div>
            )}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "20px", marginTop: "16px" }}>
              <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "14px" }}>What's included</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: "flex", gap: "10px", fontSize: "14px", color: "#cbd5e1" }}>
                    <span style={{ color: plan.color, flexShrink: 0 }}>✓</span><span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "24px", paddingTop: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {[["🔒","Powered by Stripe — bank-grade encryption"],["🛡️","Cancel anytime — no lock-in"],["⚡","Instant access — workspace activates after payment"]].map(([icon, text]) => (
                <div key={String(text)} style={{ display: "flex", gap: "8px", fontSize: "12px", color: "#64748b" }}>
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div style={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "28px" }}>
            <h2 style={{ margin: "0 0 22px", fontSize: "20px", fontWeight: 700, color: "#f1f5f9" }}>Create Your Workspace</h2>

            {success && (
              <div style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px", color: "#4ade80", fontSize: "14px", fontWeight: 600 }}>
                {success}
              </div>
            )}
            {error && (
              <div style={{ background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.35)", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px", color: "#f87171", fontSize: "14px" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px", fontWeight: 500 }}>Company / Workspace Name *</label>
                <input type="text" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="e.g. Phoenix Wholesale Capital" required style={inp} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px", fontWeight: 500 }}>Email Address *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourbusiness.com" required autoComplete="email" style={inp} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px", fontWeight: 500 }}>Password * <span style={{ color: "#64748b", fontWeight: 400 }}>(min 8 characters)</span></label>
                <div style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a secure password" required minLength={8} autoComplete="new-password" style={{ ...inp, paddingRight: "44px" }} onFocus={focus} onBlur={blur} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: "16px", padding: "2px" }}>
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* State Selection */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500 }}>
                    Primary Operating State *
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Sets statutory wholesaling addendum
                  </span>
                </div>
                <select
                  value={operatingState}
                  onChange={(e) => {
                    setOperatingState(e.target.value);
                    setStateAgreementAgreed(false);
                    setIsLicensed("");
                  }}
                  style={{
                    ...inp,
                    cursor: "pointer",
                    background: "rgba(30, 41, 59, 0.7)",
                  }}
                  required
                >
                  {ALL_US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* State-Specific Statutory Wholesaling Advisory Box */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background:
                    stateRule.category === "license_required"
                      ? "rgba(239, 68, 68, 0.12)"
                      : stateRule.category === "mandatory_disclosure"
                      ? "rgba(245, 158, 11, 0.12)"
                      : "rgba(16, 185, 129, 0.08)",
                  border:
                    stateRule.category === "license_required"
                      ? "1px solid rgba(239, 68, 68, 0.35)"
                      : stateRule.category === "mandatory_disclosure"
                      ? "1px solid rgba(245, 158, 11, 0.35)"
                      : "1px solid rgba(16, 185, 129, 0.25)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
                  <strong style={{
                    color:
                      stateRule.category === "license_required"
                        ? "#f87171"
                        : stateRule.category === "mandatory_disclosure"
                        ? "#fbbf24"
                        : "#34d399",
                    fontSize: "12.5px",
                  }}>
                    {stateRule.category === "license_required"
                      ? `⚖️ ${stateRule.name} Licensing Mandate`
                      : stateRule.category === "mandatory_disclosure"
                      ? `ℹ️ ${stateRule.name} Mandatory Equitable Disclosure`
                      : `✓ ${stateRule.name} Equitable Conversion`}
                  </strong>
                  <span style={{ fontSize: "10px", color: "#94a3b8", background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px" }}>
                    {stateRule.citation}
                  </span>
                </div>

                <p style={{ margin: "0 0 8px", color: "#cbd5e1", fontSize: "12px" }}>
                  {stateRule.summary}
                </p>

                {/* If License Required: Licensing status radio questions */}
                {stateRule.category === "license_required" && (
                  <div style={{ borderTop: "1px solid rgba(239, 68, 68, 0.25)", paddingTop: "8px", marginTop: "8px" }}>
                    <div style={{ fontWeight: 600, color: "#fca5a5", marginBottom: "6px" }}>
                      Are you an actively licensed real estate agent or broker in {stateRule.name}?
                    </div>
                    <div style={{ display: "flex", gap: "16px", marginBottom: "8px", flexWrap: "wrap" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#f1f5f9" }}>
                        <input
                          type="radio"
                          name="isLicensed"
                          checked={isLicensed === "yes"}
                          onChange={() => setIsLicensed("yes")}
                          style={{ accentColor: "#ef4444" }}
                        />
                        <span>Yes, I am actively licensed</span>
                      </label>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#f1f5f9" }}>
                        <input
                          type="radio"
                          name="isLicensed"
                          checked={isLicensed === "no"}
                          onChange={() => setIsLicensed("no")}
                          style={{ accentColor: "#ef4444" }}
                        />
                        <span>No (statutory double close / exemption)</span>
                      </label>
                    </div>

                    {isLicensed === "yes" && (
                      <div style={{ marginTop: "6px" }}>
                        <input
                          type="text"
                          placeholder={`${stateRule.name} License / Registration # (e.g. OREC / IDFPR / DPOR #)`}
                          value={licenseNumber}
                          onChange={(e) => setLicenseNumber(e.target.value)}
                          style={{ ...inp, fontSize: "12px", padding: "8px 12px" }}
                        />
                      </div>
                    )}

                    {isLicensed === "no" && (
                      <div style={{ fontSize: "11px", color: "#fca5a5", background: "rgba(0,0,0,0.3)", padding: "6px 10px", borderRadius: "6px", marginTop: "4px" }}>
                        ⚠️ Notice: You must utilize permissible statutory structures such as transactional double closing (taking fee title before resale) or single-deal limits under {stateRule.citation}.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ background: `linear-gradient(135deg,${plan.glowColor},rgba(255,255,255,0.03))`, border: `1px solid ${plan.borderColor}`, borderRadius: "10px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "13px", color: "#94a3b8" }}>
                  {plan.badge.split(" ")[0]} <strong style={{ color: "#f1f5f9" }}>{plan.name}</strong>
                </div>
                <div style={{ fontWeight: 700, color: plan.color, fontSize: "15px" }}>${price}/mo</div>
              </div>

              {/* State-Specific Statutory Agreement Checkbox */}
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer", fontSize: "12.5px", color: "#cbd5e1", lineHeight: 1.5, background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <input
                  type="checkbox"
                  checked={stateAgreementAgreed}
                  onChange={e => setStateAgreementAgreed(e.target.checked)}
                  style={{ marginTop: "2px", accentColor: plan.color, width: "16px", height: "16px", flexShrink: 0 }}
                  required
                />
                <span>
                  I have read and affirmatively accept the{" "}
                  <a
                    href={`#/agreement?state=${operatingState}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: plan.color, textDecoration: "underline", fontWeight: 700 }}
                  >
                    {stateRule.name} Wholesaling Compliance Schedule &amp; Addendum
                  </a>{" "}
                  under <strong>{stateRule.citation}</strong>, and warrant that my operations adhere to all applicable real estate licensing statutes.
                </span>
              </label>

              {/* General Terms Checkbox */}
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer", fontSize: "12.5px", color: "#64748b", lineHeight: 1.5 }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: "2px", accentColor: plan.color, width: "16px", height: "16px", flexShrink: 0 }} />
                <span>
                  I agree to the{" "}
                  <a href="#/agreement" target="_blank" style={{ color: plan.color, textDecoration: "none" }}>Master Customer Agreement</a>,{" "}
                  <a href="#/terms" target="_blank" style={{ color: plan.color, textDecoration: "none" }}>Terms of Service</a>, and{" "}
                  <a href="#/privacy" target="_blank" style={{ color: plan.color, textDecoration: "none" }}>Privacy Policy</a>.
                </span>
              </label>

              <button type="submit" disabled={loading || !!success} style={{
                background: loading || success ? "rgba(99,102,241,0.4)" : `linear-gradient(135deg,${plan.color} 0%,${selectedTier === "pro" ? "#6366f1" : selectedTier === "scale" ? "#d97706" : "#0891b2"} 100%)`,
                color: "#fff", border: "none", borderRadius: "10px", padding: "14px",
                fontSize: "16px", fontWeight: 700,
                cursor: loading || success ? "not-allowed" : "pointer",
                opacity: loading || success ? 0.7 : 1, transition: "all 0.2s", marginTop: "4px",
                boxShadow: loading || success ? "none" : `0 4px 20px ${plan.glowColor}`,
              }}>
                {loading ? "Redirecting to secure checkout…" : success ? "✓ Redirecting to checkout…" : `Subscribe — ${plan.name} $${price}/mo`}
              </button>

              <p style={{ margin: 0, textAlign: "center", fontSize: "12px", color: "#475569" }}>
                Payment due today — no free trial. Your workspace activates immediately after checkout.
              </p>
            </form>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "48px", textAlign: "center", fontSize: "12px", color: "#334155" }}>
        <div style={{ marginBottom: "8px" }}>© {new Date().getFullYear()} Revzenta CRM</div>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          {[["#/privacy","Privacy"],["#/terms","Terms"],["#/security","Security"]].map(([href, label]) => (
            <a key={href} href={href} style={{ color: "#475569", textDecoration: "none" }}>{label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

