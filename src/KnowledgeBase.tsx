import { useState, useMemo } from "react";
import ThemeToggle from "./ThemeToggle";

interface KnowledgeBaseProps {
  onBack: () => void;
  onSignIn: () => void;
  onLaunchApp: () => void;
  onOpenContact?: () => void;
}

interface Article {
  id: string;
  category: "getting-started" | "property-search" | "buy-box" | "escrow-title" | "contracts" | "compliance";
  title: string;
  excerpt: string;
  body: string[];
}

const ARTICLES: Article[] = [
  {
    id: "quick-start",
    category: "getting-started",
    title: "Quick Start: Workspace Setup & First Lead Import",
    excerpt: "Learn how to configure your team pipeline stages, invite disposition specialists, and import contacts.",
    body: [
      "1. Setting Your Pipeline Stages: Navigate to Settings > Pipeline Stages to customize your wholesale deal funnel (e.g. Inbound Lead, Property Under Review, Offer Sent, Contract Locked, In Escrow, Sold).",
      "2. Importing Existing Leads: Use the CSV Importer to bring over records from PropStream, BatchLeads, or Podio. Revzenta automatically normalizes parcel addresses and phone numbers.",
      "3. Role-Based Permissions: Invite team members with Admin or View-Only roles to restrict sensitive financial controls.",
    ],
  },
  {
    id: "ai-property-search",
    category: "property-search",
    title: "Using AI Natural Language Property Search",
    excerpt: "Query distressed inventory, absentee owners, and high equity deals using everyday conversational English.",
    body: [
      "Revzenta integrates a Gemini-powered Natural Language Search engine capable of translating natural questions into targeted multi-criteria filters.",
      "Example Prompts: 'Find single-family homes in Maricopa County with over 40% equity and absentee owners' or 'Show vacant properties under $300k with tax delinquency'.",
      "One-Click Conversion: Any matching property card can be instantly converted into an active CRM lead with full valuation details pulled from county assessor records.",
    ],
  },
  {
    id: "buy-box-matcher",
    category: "buy-box",
    title: "Buy Box Matcher: Instant Cash Buyer Dispo Engine",
    excerpt: "Match incoming contracts with vetted cash buyers based on zip code, property type, and target discount margins.",
    body: [
      "1. Registering Cash Buyers: Add your cash buyers with their purchase criteria (target zip codes, minimum discount spread, property classifications, and verified Proof of Funds).",
      "2. Automated Match Scoring: When a wholesale contract is locked up, the Buy Box Matcher scores and ranks every buyer in your VIP roster who meets the deal specs.",
      "3. One-Click Dispo Blast: Dispatch notification emails with anonymized deal sheets directly to the top 5 matching buyers with proof-of-funds verification.",
    ],
  },
  {
    id: "escrow-hub-access",
    category: "escrow-title",
    title: "Title Company & Escrow Officer Portal Access",
    excerpt: "How title companies and closing attorneys access their secure guest portion without needing full CRM seats.",
    body: [
      "1. Guest Title Portal: Title companies access their designated files via secure magic links (`#/escrow?token=...`) without touching your private lead database.",
      "2. Uploading Settlement Statements: Escrow officers can directly upload Preliminary Closing Disclosures, Earnest Money Deposit receipts, and Title Commitments.",
      "3. Milestone Tracking: Both your disposition team and the title officer can mark key milestones (Clear to Close, Payoff Ordered, Funded & Recorded) in real time.",
    ],
  },
  {
    id: "contract-generator",
    category: "contracts",
    title: "Automated Purchase Contracts, LOIs & Assignment Agreements",
    excerpt: "Generate compliant real estate purchase agreements and assignment of contract forms in seconds.",
    body: [
      "1. Generating an Offer: Inside any property card, click 'Generate LOI / Contract'. Revzenta pre-fills parcel legal descriptions, seller names, offer amounts, earnest money, and inspection contingency dates.",
      "2. Assignment Agreements: Once a cash buyer is matched, generate an Assignment of Purchase and Sale Agreement outlining your assignment fee and deposit terms.",
      "3. Exporting & E-Signing: Download print-ready PDFs or transmit agreements directly to sellers and assignees via integrated email dispatch.",
    ],
  },
  {
    id: "ccpa-privacy-purge",
    category: "compliance",
    title: "Data Privacy, CCPA Data Purge & TCPA DNC Safeguards",
    excerpt: "How to permanently erase homeowner records upon request and maintain permanent suppression registries.",
    body: [
      "1. One-Click CCPA Purge: Under Settings > Compliance, paste a homeowner's phone number or address to trigger a permanent database purge.",
      "2. Permanent Suppression Registry: When a contact is purged, their cryptographic hash is permanently stored in the suppression registry to prevent accidental re-imports from future CSV uploads.",
      "3. Privacy Eye: Use the eye toggle in the top navigation during screen recordings or team calls to dynamically blur all sensitive seller names, addresses, and phone numbers.",
    ],
  },
];

export default function KnowledgeBase({ onBack, onSignIn, onLaunchApp, onOpenContact }: KnowledgeBaseProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openArticleId, setOpenArticleId] = useState<string | null>("quick-start");

  const categories = [
    { id: "all", label: "All Topics", icon: "📚" },
    { id: "getting-started", label: "Getting Started", icon: "🚀" },
    { id: "property-search", label: "Property Search & AI", icon: "🔍" },
    { id: "buy-box", label: "Buy Box & Dispo", icon: "🎯" },
    { id: "escrow-title", label: "Title & Escrow Hub", icon: "📑" },
    { id: "contracts", label: "Contracts & E-Sign", icon: "✍️" },
    { id: "compliance", label: "Privacy & Compliance", icon: "🛡️" },
  ];

  const filteredArticles = useMemo(() => {
    return ARTICLES.filter((a) => {
      const matchesCategory = selectedCategory === "all" || a.category === selectedCategory;
      const matchesQuery =
        !query.trim() ||
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.excerpt.toLowerCase().includes(query.toLowerCase()) ||
        a.body.some((b) => b.toLowerCase().includes(query.toLowerCase()));
      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, query]);

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
      <main className="rw-container" style={{ maxWidth: "1020px", margin: "40px auto 80px", padding: "0 24px" }}>
        {/* Header Hero */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
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
              marginBottom: "12px",
            }}
          >
            <span>📖</span> Knowledge Base &amp; Help Center
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            How Can We Help You Scale?
          </h1>
          <p style={{ fontSize: "15px", color: "var(--rw-text-dim)", maxWidth: "540px", margin: "0 auto 24px", lineHeight: 1.6 }}>
            Explore setup walkthroughs, underwriting formulas, escrow coordination workflows, and API guides.
          </p>

          {/* Search Box */}
          <div style={{ maxWidth: "560px", margin: "0 auto", position: "relative" }}>
            <input
              type="search"
              placeholder="Search guides (e.g., escrow portal, buy box, property search, CCPA)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 20px 14px 44px",
                borderRadius: "12px",
                border: "1px solid var(--rw-border)",
                backgroundColor: "var(--rw-surface)",
                color: "var(--rw-text)",
                fontSize: "15px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                boxSizing: "border-box",
              }}
            />
            <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", fontSize: "18px", opacity: 0.6 }}>
              🔍
            </span>
          </div>
        </div>

        {/* Categories Carousel / Tabs */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "16px", marginBottom: "28px" }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                border: selectedCategory === cat.id ? "1px solid var(--rw-primary)" : "1px solid var(--rw-border)",
                backgroundColor: selectedCategory === cat.id ? "var(--rw-primary)" : "var(--rw-surface)",
                color: selectedCategory === cat.id ? "var(--rw-primary-ink)" : "var(--rw-text)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Articles List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredArticles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "var(--rw-surface)", borderRadius: "12px", border: "1px solid var(--rw-border)" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔎</div>
              <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "var(--rw-text)" }}>No matching articles found</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--rw-text-dim)" }}>
                Try searching for broader keywords like &quot;lead&quot;, &quot;escrow&quot;, or &quot;contract&quot;.
              </p>
            </div>
          ) : (
            filteredArticles.map((article) => {
              const isOpen = openArticleId === article.id;
              return (
                <div
                  key={article.id}
                  style={{
                    backgroundColor: "var(--rw-surface)",
                    border: "1px solid var(--rw-border)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    transition: "border-color 0.2s ease",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenArticleId(isOpen ? null : article.id)}
                    style={{
                      width: "100%",
                      padding: "20px 24px",
                      background: "none",
                      border: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      textAlign: "left",
                      cursor: "pointer",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <h3 style={{ margin: "0 0 4px", fontSize: "16.5px", fontWeight: 700, color: "var(--rw-text)" }}>
                        {article.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--rw-text-dim)" }}>
                        {article.excerpt}
                      </p>
                    </div>
                    <span style={{ fontSize: "18px", color: "var(--rw-text-dim)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
                      ▼
                    </span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: "0 24px 24px", borderTop: "1px solid var(--rw-border)", paddingTop: "18px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", lineHeight: 1.7, color: "var(--rw-text-dim)" }}>
                        {article.body.map((paragraph, i) => (
                          <p key={i} style={{ margin: 0 }}>
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Still Need Help Box */}
        <div
          style={{
            marginTop: "48px",
            padding: "28px 32px",
            borderRadius: "14px",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--rw-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: 700, color: "var(--rw-text)" }}>
              Can&apos;t find what you&apos;re looking for?
            </h3>
            <p style={{ margin: 0, fontSize: "13.5px", color: "var(--rw-text-dim)" }}>
              Our platform support team is available Monday through Friday.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenContact ? onOpenContact : () => (window.location.hash = "#contact")}
          >
            Contact Support Desk →
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--rw-border)", padding: "24px 0", textAlign: "center", fontSize: "13px", color: "var(--rw-text-muted)" }}>
        <div className="rw-container">
          © {new Date().getFullYear()} Revzenta LLC. All rights reserved. · Revzenta Self-Service Documentation
        </div>
      </footer>
    </div>
  );
}
