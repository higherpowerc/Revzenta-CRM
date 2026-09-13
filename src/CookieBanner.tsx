import { useState, useEffect } from "react";

interface CookieBannerProps {
  onOpenCookiePolicy?: () => void;
}

export default function CookieBanner({ onOpenCookiePolicy }: CookieBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("crm:cookie-consent");
      if (!consent) {
        // Delay slightly for smooth page load
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // If localStorage is unavailable, don't block
    }
  }, []);

  const handleAccept = (type: "all" | "essential") => {
    try {
      localStorage.setItem("crm:cookie-consent", JSON.stringify({ type, timestamp: new Date().toISOString() }));
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent banner"
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 40px)",
        maxWidth: "880px",
        zIndex: 9999,
        backgroundColor: "var(--rw-surface, #0f172a)",
        border: "1px solid var(--rw-border, #1e293b)",
        borderRadius: "14px",
        padding: "18px 24px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "20px",
        flexWrap: "wrap",
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <div style={{ flex: 1, minWidth: "280px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ fontSize: "16px" }}>🍪</span>
          <strong style={{ fontSize: "14px", color: "var(--rw-text, #f8fafc)" }}>
            Privacy &amp; Cookie Preferences
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--rw-text-dim, #94a3b8)", lineHeight: 1.5 }}>
          Revzenta uses essential session cookies and local storage to power your workspace authentication and security. We <strong>never</strong> sell your data or deploy third-party advertising tracking pixels. Read our{" "}
          <a
            href="#cookies"
            onClick={(e) => {
              e.preventDefault();
              if (onOpenCookiePolicy) onOpenCookiePolicy();
              else window.location.hash = "#cookies";
            }}
            style={{ color: "var(--rw-primary, #10b981)", textDecoration: "underline", fontWeight: 600 }}
          >
            Cookie Policy
          </a>{" "}
          for full details.
        </p>
      </div>

      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => handleAccept("essential")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            backgroundColor: "transparent",
            border: "1px solid var(--rw-border, #334155)",
            color: "var(--rw-text, #f8fafc)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Essential Only
        </button>
        <button
          type="button"
          onClick={() => handleAccept("all")}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            backgroundColor: "var(--rw-primary, #10b981)",
            border: "none",
            color: "var(--rw-primary-ink, #ffffff)",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
            transition: "all 0.15s ease",
          }}
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
