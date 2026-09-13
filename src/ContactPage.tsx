import { useState, type FormEvent } from "react";
import ThemeToggle from "./ThemeToggle";

interface ContactPageProps {
  onBack: () => void;
  onSignIn: () => void;
  onLaunchApp: () => void;
}

export default function ContactPage({ onBack, onSignIn, onLaunchApp }: ContactPageProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("support");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !message.trim()) {
      setError("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Dispatch inquiry via the public intake API
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notes: `[Department: ${department.toUpperCase()}] Subject: ${subject}\n\n${message.trim()}`,
          leadSource: "website_contact_page",
        }),
      });

      if (!res.ok) {
        throw new Error("Unable to transmit inquiry. Please email support@revzenta.com directly.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please email support@revzenta.com.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rw-page" style={{ minHeight: "100vh", backgroundColor: "var(--rw-bg)", color: "var(--rw-text)" }}>
      {/* Top Navigation Bar */}
      <header className="rw-nav">
        <div className="rw-container rw-nav-inner">
          <div className="rw-brand" onClick={onBack} style={{ cursor: "pointer" }}>
            <div className="rw-brand-icon">R</div>
            <span>Revzenta</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBack}
              style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              ← Back to Overview
            </button>
            <ThemeToggle />
            <button type="button" className="btn btn-ghost" onClick={onSignIn}>
              Sign In
            </button>
            <button type="button" className="btn btn-primary" onClick={onLaunchApp}>
              Launch CRM
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="rw-container" style={{ maxWidth: "980px", margin: "40px auto 80px", padding: "0 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "44px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 600,
              backgroundColor: "var(--rw-primary-dim)",
              color: "var(--rw-primary)",
              marginBottom: "14px",
            }}
          >
            <span>💬</span> We&apos;re Here to Help
          </div>
          <h1 style={{ fontSize: "38px", fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            Contact &amp; Support Hub
          </h1>
          <p style={{ fontSize: "15px", color: "var(--rw-text-dim)", maxWidth: "580px", margin: "0 auto", lineHeight: 1.6 }}>
            Have a question about Revzenta CRM, need technical assistance, or want to discuss enterprise onboarding? Reach our dedicated team below.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "32px", alignItems: "start" }}>
          {/* Direct Department Cards */}
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px", color: "var(--rw-text)" }}>
              Direct Inquiries
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ padding: "18px 20px", borderRadius: "10px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "18px" }}>🎫</span>
                  <strong style={{ fontSize: "15px", color: "var(--rw-text)" }}>Platform Customer Support</strong>
                </div>
                <p style={{ margin: "0 0 6px", fontSize: "13px", color: "var(--rw-text-dim)" }}>
                  Technical troubleshooting, workflow questions, and bug reports.
                </p>
                <a href="mailto:support@revzenta.com" style={{ fontSize: "13.5px", color: "var(--rw-primary)", fontWeight: 700, textDecoration: "none" }}>
                  support@revzenta.com →
                </a>
              </div>

              <div style={{ padding: "18px 20px", borderRadius: "10px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "18px" }}>💼</span>
                  <strong style={{ fontSize: "15px", color: "var(--rw-text)" }}>Sales &amp; Enterprise Demos</strong>
                </div>
                <p style={{ margin: "0 0 6px", fontSize: "13px", color: "var(--rw-text-dim)" }}>
                  Team licenses, high-volume PropStream/BatchLeads migrations, and custom buy boxes.
                </p>
                <a href="mailto:sales@revzenta.com" style={{ fontSize: "13.5px", color: "var(--rw-primary)", fontWeight: 700, textDecoration: "none" }}>
                  sales@revzenta.com →
                </a>
              </div>

              <div style={{ padding: "18px 20px", borderRadius: "10px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "18px" }}>⚖️</span>
                  <strong style={{ fontSize: "15px", color: "var(--rw-text)" }}>Privacy &amp; Compliance Office</strong>
                </div>
                <p style={{ margin: "0 0 6px", fontSize: "13px", color: "var(--rw-text-dim)" }}>
                  CCPA data purge requests, TCPA suppression registry, and legal inquiries.
                </p>
                <a href="mailto:privacy@revzenta.com" style={{ fontSize: "13.5px", color: "var(--rw-primary)", fontWeight: 700, textDecoration: "none" }}>
                  privacy@revzenta.com →
                </a>
              </div>

              <div style={{ padding: "16px 20px", borderRadius: "10px", backgroundColor: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--rw-border)", fontSize: "12.5px", color: "var(--rw-text-dim)", lineHeight: 1.6 }}>
                <strong>Support Hours:</strong> Monday – Friday, 8:00 AM – 7:00 PM EST.<br />
                <strong>Critical SLA Incidents:</strong> Triaged 24 hours / 7 days a week.
              </div>
            </div>
          </div>

          {/* Interactive Form */}
          <div style={{ padding: "28px 30px", borderRadius: "14px", backgroundColor: "var(--rw-surface)", border: "1px solid var(--rw-border)", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px", color: "var(--rw-text)" }}>
              Send a Message
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--rw-text-dim)" }}>
              Fill out this form and a specialist will respond within 4 business hours.
            </p>

            {submitted ? (
              <div style={{ textAlign: "center", padding: "36px 16px" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎉</div>
                <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--rw-text)", margin: "0 0 8px" }}>
                  Inquiry Received!
                </h3>
                <p style={{ fontSize: "13.5px", color: "var(--rw-text-dim)", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Thank you, <strong>{fullName}</strong>. Your message has been routed to our {department.toUpperCase()} desk. A confirmation has been logged and we will be in touch shortly.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSubmitted(false);
                    setFullName("");
                    setEmail("");
                    setPhone("");
                    setSubject("");
                    setMessage("");
                  }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {error && (
                  <div style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", fontSize: "13px" }}>
                    {error}
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--rw-text)", marginBottom: "6px" }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Miller"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--rw-border)", backgroundColor: "var(--rw-bg)", color: "var(--rw-text)", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--rw-text)", marginBottom: "6px" }}>
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@wholesalecapital.com"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--rw-border)", backgroundColor: "var(--rw-bg)", color: "var(--rw-text)", fontSize: "14px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--rw-text)", marginBottom: "6px" }}>
                      Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 019-2834"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--rw-border)", backgroundColor: "var(--rw-bg)", color: "var(--rw-text)", fontSize: "14px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--rw-text)", marginBottom: "6px" }}>
                    Inquiry Category *
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--rw-border)", backgroundColor: "var(--rw-bg)", color: "var(--rw-text)", fontSize: "14px", boxSizing: "border-box" }}
                  >
                    <option value="support">Customer Support &amp; Technical Help</option>
                    <option value="sales">Sales &amp; Enterprise Demo Request</option>
                    <option value="billing">Billing, Subscription &amp; Invoices</option>
                    <option value="escrow">Title Company &amp; Escrow Partner Hub</option>
                    <option value="privacy">CCPA Data Privacy &amp; Legal</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--rw-text)", marginBottom: "6px" }}>
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Question regarding Title Company access portal"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--rw-border)", backgroundColor: "var(--rw-bg)", color: "var(--rw-text)", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--rw-text)", marginBottom: "6px" }}>
                    Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe what you need assistance with..."
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--rw-border)", backgroundColor: "var(--rw-bg)", color: "var(--rw-text)", fontSize: "14px", boxSizing: "border-box", resize: "vertical" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 700, marginTop: "4px" }}
                >
                  {submitting ? "Transmitting…" : "Submit Inquiry →"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--rw-border)", padding: "24px 0", textAlign: "center", fontSize: "13px", color: "var(--rw-text-muted)" }}>
        <div className="rw-container">
          © {new Date().getFullYear()} Revzenta LLC. All rights reserved. · Global Support &amp; Communication Center
        </div>
      </footer>
    </div>
  );
}
