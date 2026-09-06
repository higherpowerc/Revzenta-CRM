import { useState, useEffect, useMemo } from "react";
import { api } from "./api";
import type { Transaction, Client, Buyer } from "./types";

interface Props {
  crmBusinessName?: string;
}

const STATE_OPTIONS = [
  { value: "US General", label: "US General Standard" },
  { value: "TX", label: "Texas (Prop Code § 5.086 Disclosure)" },
  { value: "FL", label: "Florida (Wholesale & Assignment Disclosure)" },
  { value: "CA", label: "California (Civil Code § 1624 / 1689)" },
  { value: "GA", label: "Georgia (GREC Wholesale Disclosure)" },
  { value: "NC", label: "North Carolina (Wholesale Assignment Addendum)" },
  { value: "AZ", label: "Arizona (Equitable Interest Disclosure)" },
];

export interface WholesaleStepDef {
  step: 1 | 2 | 3 | 4 | 5;
  title: string;
  shortTitle: string;
  icon: string;
  badge: string;
  description: string;
  actionHint: string;
}

export const WHOLESALE_STEPS: WholesaleStepDef[] = [
  {
    step: 1,
    title: "1. Under Contract (PSA)",
    shortTitle: "1. Contract (PSA)",
    icon: "📝",
    badge: "Assignable Clause",
    description: "Sign purchase & sale agreement with seller containing 'and/or assigns' clause.",
    actionHint: "PSA Signed with Seller",
  },
  {
    step: 2,
    title: "2. Open Escrow & EMD",
    shortTitle: "2. Open Escrow",
    icon: "🏦",
    badge: "Escrow Opened",
    description: "Send signed PSA to title company/closing attorney and deposit Earnest Money (EMD).",
    actionHint: "EMD Deposited to Title",
  },
  {
    step: 3,
    title: "3. Find Cash Buyer",
    shortTitle: "3. Find Cash Buyer",
    icon: "🎯",
    badge: "Buyer Disposition",
    description: "Market equitable interest to vetted cash buyers and flippers on your buyers list.",
    actionHint: "Cash Buyer Identified",
  },
  {
    step: 4,
    title: "4. Sign Assignment Agreement",
    shortTitle: "4. Sign Assignment",
    icon: "✍️",
    badge: "Wholesaler & Investor",
    description: "Cash buyer (Investor) signs assignment agreement transferring rights for assignment fee.",
    actionHint: "Wholesaler & Investor Executed",
  },
  {
    step: 5,
    title: "5. Collect Fee & Close",
    shortTitle: "5. Close & Payout",
    icon: "💰",
    badge: "Fee Disbursed",
    description: "Send both contracts to title. Buyer funds deal; title pays seller and wires wholesaler fee.",
    actionHint: "Assignment Fee Paid",
  },
];

export function getDealWholesaleStep(tx: Transaction): 1 | 2 | 3 | 4 | 5 {
  if (tx.titleStatus === "closed" || tx.status === "closed") {
    return 5;
  }
  if (tx.contractType === "assignment") {
    if (tx.titleStatus === "clear_to_close" || (tx.status === "signed" && tx.titleStatus === "payoff_ordered")) {
      return 5;
    }
    return 4;
  }
  // For PSA / pre-assignment deals:
  if (tx.buyerId || (tx.buyerName && !tx.buyerName.toLowerCase().includes("assigns") && tx.buyerName.trim() !== "" && tx.buyerName !== "Buyer")) {
    return 3;
  }
  if (tx.emdStatus === "deposited" || tx.emdStatus === "hard" || tx.titleStatus === "prelim_review" || tx.titleStatus === "payoff_ordered") {
    return 3;
  }
  if (tx.titleStatus === "opened" || tx.emdStatus === "pending") {
    return 2;
  }
  return 1;
}


export default function TransactionHub({ crmBusinessName }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [properties, setProperties] = useState<Client[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab
  // Active view tab
  const [activeTab, setActiveTab] = useState<"process" | "clocks" | "contracts" | "title">("process");
  const [stepFilter, setStepFilter] = useState<number | "all">("all");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [titlePacketModalTx, setTitlePacketModalTx] = useState<Transaction | null>(null);
  const [titlePacketEmail, setTitlePacketEmail] = useState("");
  const [signRequestModalTx, setSignRequestModalTx] = useState<Transaction | null>(null);
  const [signRequestEmail, setSignRequestEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [txRes, clientsRes, buyersRes] = await Promise.all([
        api.transactions(),
        api.clients(),
        api.buyers().catch(() => ({ buyers: [] })),
      ]);
      if (txRes.ok) {
        setTransactions(txRes.transactions);
      }
      if (clientsRes.clients) {
        setProperties(clientsRes.clients);
      }
      if (buyersRes.buyers) {
        setBuyers(buyersRes.buyers);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Flash message helper
  const notify = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // KPIs
  const stats = useMemo(() => {
    const totalVolume = transactions.reduce((acc, t) => acc + (t.purchasePrice || 0), 0);
    const activeInspections = transactions.filter(
      (t) => t.inspectionStatus === "active" && t.daysLeftInspection !== null && t.daysLeftInspection >= 0
    ).length;
    const urgentInspections = transactions.filter(
      (t) => t.inspectionStatus === "active" && t.inspectionUrgency === "urgent"
    ).length;
    const emdPending = transactions.filter((t) => t.emdStatus === "pending" || t.emdStatus === "deposited").length;
    const activeTitle = transactions.filter((t) => t.titleStatus !== "closed" && t.titleStatus !== "pending").length;

    return { totalVolume, activeInspections, urgentInspections, emdPending, activeTitle };
  }, [transactions]);

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const mAddr = t.propertyAddress?.toLowerCase().includes(q);
        const mSeller = t.sellerName?.toLowerCase().includes(q);
        const mBuyer = t.buyerName?.toLowerCase().includes(q);
        const mTitle = t.titleCompanyName?.toLowerCase().includes(q);
        const mOfficer = t.escrowOfficerName?.toLowerCase().includes(q);
        if (!mAddr && !mSeller && !mBuyer && !mTitle && !mOfficer) return false;
      }
      if (urgencyFilter !== "all" && t.inspectionUrgency !== urgencyFilter) return false;
      if (typeFilter !== "all" && t.contractType !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (stepFilter !== "all" && getDealWholesaleStep(t) !== stepFilter) return false;
      return true;
    });
  }, [transactions, search, urgencyFilter, typeFilter, statusFilter, stepFilter]);

  // Quick Action: Extend inspection by N days
  const handleExtendInspection = async (tx: Transaction, days = 3) => {
    try {
      const res = await api.updateTransaction(tx.id, { extendDays: days });
      if (res.ok) {
        setTransactions((prev) => prev.map((item) => (item.id === tx.id ? res.transaction : item)));
        notify("success", `Extended inspection period by ${days} days for ${tx.propertyAddress}`);
      }
    } catch (e: any) {
      notify("error", e?.message || "Failed to extend inspection.");
    }
  };

  // Quick Action: Mark inspection passed
  const handlePassInspection = async (tx: Transaction) => {
    try {
      const res = await api.updateTransaction(tx.id, { inspectionStatus: "passed" });
      if (res.ok) {
        setTransactions((prev) => prev.map((item) => (item.id === tx.id ? res.transaction : item)));
        notify("success", `Inspection passed and contingency satisfied for ${tx.propertyAddress}`);
      }
    } catch (e: any) {
      notify("error", e?.message || "Failed to update inspection.");
    }
  };

  // Quick Action: Update EMD status
  const handleUpdateEmdStatus = async (tx: Transaction, newStatus: Transaction["emdStatus"]) => {
    try {
      const res = await api.updateTransaction(tx.id, { emdStatus: newStatus });
      if (res.ok) {
        setTransactions((prev) => prev.map((item) => (item.id === tx.id ? res.transaction : item)));
        notify("success", `Updated Earnest Money status to "${newStatus.toUpperCase()}"`);
      }
    } catch (e: any) {
      notify("error", e?.message || "Failed to update EMD status.");
    }
  };

  // Quick Action: Send Title Packet Email
  const handleSendTitlePacket = async () => {
    if (!titlePacketModalTx) return;
    try {
      const res = await api.sendTitlePacket(titlePacketModalTx.id, { email: titlePacketEmail });
      if (res.ok) {
        notify("success", `Title & Escrow Packet emailed to ${titlePacketEmail || titlePacketModalTx.escrowOfficerEmail}`);
        setTitlePacketModalTx(null);
        loadData();
      }
    } catch (e: any) {
      notify("error", e?.message || "Failed to send Title Packet.");
    }
  };

  // Quick Action: Send e-signature request email
  const handleSendSignRequest = async () => {
    if (!signRequestModalTx) return;
    try {
      const res = await api.sendSignatureRequest(signRequestModalTx.id, { email: signRequestEmail });
      if (res.ok) {
        notify("success", `Signature request link emailed to ${signRequestEmail}`);
        setSignRequestModalTx(null);
        loadData();
      }
    } catch (e: any) {
      notify("error", e?.message || "Failed to send signature request.");
    }
  };

  // Copy link helper
  const copyToClipboard = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    notify("success", `Copied ${label} to clipboard!`);
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 700, color: "var(--fg)" }}>
            Document &amp; Transaction Hub
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px" }}>
            State-specific PSA &amp; Assignment generation, real-time contingency clocks, and shared Title Company portals.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            backgroundColor: "var(--accent, #3b82f6)",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <span>+</span> New Transaction / Contract
        </button>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            marginBottom: "16px",
            fontSize: "14px",
            fontWeight: 500,
            backgroundColor: statusMessage.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: statusMessage.type === "success" ? "#10b981" : "#ef4444",
            border: `1px solid ${statusMessage.type === "success" ? "#10b981" : "#ef4444"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "16px" }}
          >
            &times;
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5-STEP WHOLESALE REAL ESTATE LIFECYCLE ROADMAP BANNER
         ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "16px 20px",
          marginBottom: "20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>🧭</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--fg)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
              Standard Real Estate Wholesaling Process (Start to Finish)
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Click any milestone step below to filter active pipeline deals:
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "10px",
          }}
        >
          {WHOLESALE_STEPS.map((s) => {
            const count = transactions.filter((t) => getDealWholesaleStep(t) === s.step).length;
            const isFiltered = stepFilter === s.step;

            return (
              <div
                key={s.step}
                onClick={() => {
                  setStepFilter((prev) => (prev === s.step ? "all" : s.step));
                  if (activeTab !== "process") setActiveTab("process");
                }}
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: isFiltered ? "2px solid var(--accent, #3b82f6)" : "1px solid var(--border)",
                  backgroundColor: isFiltered
                    ? "rgba(59, 130, 246, 0.08)"
                    : "var(--card-bg, var(--panel))",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "15px" }}>{s.icon}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "10px",
                        backgroundColor: count > 0 ? "rgba(59, 130, 246, 0.15)" : "var(--border)",
                        color: count > 0 ? "var(--accent, #3b82f6)" : "var(--muted)",
                      }}
                    >
                      {count} {count === 1 ? "Deal" : "Deals"}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fg)", marginTop: "2px" }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px", lineHeight: 1.35 }}>
                    {s.description}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "10px",
                    paddingTop: "6px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "10px",
                  }}
                >
                  <span style={{ color: "var(--accent, #3b82f6)", fontWeight: 600 }}>{s.badge}</span>
                  <span style={{ color: "var(--muted)" }}>{isFiltered ? "Active Filter ✕" : "Filter →"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--card-bg, var(--panel))",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Under Contract Volume
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--fg)", marginTop: "4px" }}>
            ${stats.totalVolume.toLocaleString()}
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
            {transactions.length} total active deals
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--card-bg, var(--panel))",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Inspection Clocks Ticking
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: stats.urgentInspections > 0 ? "#ef4444" : "#f59e0b", marginTop: "4px" }}>
            {stats.activeInspections}
          </div>
          <div style={{ fontSize: "11px", color: stats.urgentInspections > 0 ? "#ef4444" : "var(--muted)", marginTop: "2px" }}>
            {stats.urgentInspections > 0 ? `${stats.urgentInspections} expire within 48h!` : "All contingencies on schedule"}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--card-bg, var(--panel))",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
            EMD Deposits Pending
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#3b82f6", marginTop: "4px" }}>
            {stats.emdPending}
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
            Earnest money in escrow / pending
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--card-bg, var(--panel))",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Escrow Files In Progress
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#10b981", marginTop: "4px" }}>
            {stats.activeTitle}
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
            Title &amp; prelim reviews underway
          </div>
        </div>
      </div>

      {/* Tabs & Filters Bar */}
      <div
        style={{
          backgroundColor: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveTab("process")}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid var(--border)",
              backgroundColor: activeTab === "process" ? "var(--accent, #3b82f6)" : "transparent",
              color: activeTab === "process" ? "#ffffff" : "var(--fg)",
            }}
          >
            🧭 5-Step Wholesale Process Board
          </button>
          <button
            onClick={() => setActiveTab("clocks")}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid var(--border)",
              backgroundColor: activeTab === "clocks" ? "var(--accent, #3b82f6)" : "transparent",
              color: activeTab === "clocks" ? "#ffffff" : "var(--fg)",
            }}
          >
            ⏱️ Contingency Clocks &amp; Deals
          </button>
          <button
            onClick={() => setActiveTab("contracts")}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid var(--border)",
              backgroundColor: activeTab === "contracts" ? "var(--accent, #3b82f6)" : "transparent",
              color: activeTab === "contracts" ? "#ffffff" : "var(--fg)",
            }}
          >
            📄 Contracts &amp; E-Sign
          </button>
          <button
            onClick={() => setActiveTab("title")}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid var(--border)",
              backgroundColor: activeTab === "title" ? "var(--accent, #3b82f6)" : "transparent",
              color: activeTab === "title" ? "#ffffff" : "var(--fg)",
            }}
          >
            🏛️ Title Company &amp; Escrow
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search address, buyer, seller..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--input-bg, var(--panel))",
              color: "var(--fg)",
              fontSize: "13px",
              minWidth: "200px",
            }}
          />

          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--input-bg, var(--panel))",
              color: "var(--fg)",
              fontSize: "13px",
            }}
          >
            <option value="all">All Clocks</option>
            <option value="urgent">🔴 Urgent (&lt; 48h)</option>
            <option value="warning">🟡 Warning (2-5d)</option>
            <option value="safe">🟢 Safe (&gt; 5d)</option>
            <option value="passed">✅ Passed / Waived</option>
          </select>

          <select
            value={stepFilter}
            onChange={(e) => setStepFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--input-bg, var(--panel))",
              color: "var(--fg)",
              fontSize: "13px",
            }}
          >
            <option value="all">All Wholesale Steps</option>
            <option value="1">Step 1: Under Contract (PSA)</option>
            <option value="2">Step 2: Open Escrow &amp; EMD</option>
            <option value="3">Step 3: Find Cash Buyer</option>
            <option value="4">Step 4: Sign Assignment (Wholesaler &amp; Investor)</option>
            <option value="5">Step 5: Collect Fee &amp; Close</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--input-bg, var(--panel))",
              color: "var(--fg)",
              fontSize: "13px",
            }}
          >
            <option value="all">All Types</option>
            <option value="psa">PSA</option>
            <option value="assignment">Assignment</option>
          </select>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          Loading transactions &amp; contingency clocks...
        </div>
      )}

      {error && (
        <div style={{ padding: "16px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: "8px", marginBottom: "20px" }}>
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div
          style={{
            backgroundColor: "var(--card-bg, var(--panel))",
            border: "1px dashed var(--border)",
            borderRadius: "8px",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📋</div>
          <h3 style={{ margin: "0 0 6px 0", color: "var(--fg)" }}>No Transactions Found</h3>
          <p style={{ color: "var(--muted)", margin: "0 0 16px 0", fontSize: "14px" }}>
            Generate your first Purchase &amp; Sale Agreement or Assignment Contract to start tracking contingency clocks.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              backgroundColor: "var(--accent, #3b82f6)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Create Contract
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB: 5-STEP WHOLESALE PROCESS KANBAN / MILESTONE BOARD
         ───────────────────────────────────────────────────────────── */}
      {!loading && activeTab === "process" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "14px 18px",
              fontSize: "13px",
              color: "var(--fg)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <strong>End-to-End Wholesale Lifecycle:</strong> Every wholesale deal follows these exact 5 stages:
              <span style={{ color: "var(--muted)", marginLeft: "6px" }}>
                1. PSA with assignable clause &rarr; 2. Open escrow &amp; EMD &rarr; 3. Market to cash buyers &rarr; 4. Assignment agreement (Wholesaler &amp; Investor) &rarr; 5. Closing &amp; title fee payout.
              </span>
            </div>
            {stepFilter !== "all" && (
              <button
                onClick={() => setStepFilter("all")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card-bg, var(--panel))",
                  fontSize: "12px",
                  color: "var(--accent, #3b82f6)",
                  cursor: "pointer",
                }}
              >
                Clear Step Filter (Show All 5 Steps)
              </button>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "14px",
              alignItems: "start",
            }}
          >
            {WHOLESALE_STEPS.filter((s) => stepFilter === "all" || stepFilter === s.step).map((col) => {
              const dealsInStep = filtered.filter((t) => getDealWholesaleStep(t) === col.step);

              return (
                <div
                  key={col.step}
                  style={{
                    backgroundColor: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "450px",
                    overflow: "hidden",
                  }}
                >
                  {/* Column Header */}
                  <div
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--border)",
                      backgroundColor: "var(--card-bg, var(--panel))",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px", color: "var(--fg)" }}>
                        <span>{col.icon}</span>
                        <span>{col.shortTitle}</span>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "8px",
                          backgroundColor: dealsInStep.length > 0 ? "rgba(59, 130, 246, 0.15)" : "var(--border)",
                          color: dealsInStep.length > 0 ? "var(--accent, #3b82f6)" : "var(--muted)",
                        }}
                      >
                        {dealsInStep.length}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                      {col.actionHint}
                    </div>
                  </div>

                  {/* Deals List */}
                  <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "10px", flex: 1, overflowY: "auto" }}>
                    {dealsInStep.length === 0 ? (
                      <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                        No deals currently in this step.
                      </div>
                    ) : (
                      dealsInStep.map((tx) => (
                        <div
                          key={tx.id}
                          style={{
                            backgroundColor: "var(--card-bg, var(--panel))",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            padding: "12px",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                padding: "2px 5px",
                                borderRadius: "3px",
                                backgroundColor: tx.contractType === "assignment" ? "rgba(147, 51, 234, 0.1)" : "rgba(59, 130, 246, 0.1)",
                                color: tx.contractType === "assignment" ? "#a855f7" : "#3b82f6",
                              }}
                            >
                              {tx.contractType.toUpperCase()}
                            </span>
                            <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                              {tx.stateJurisdiction}
                            </span>
                          </div>

                          <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--fg)", lineHeight: 1.3 }}>
                            {tx.propertyAddress}
                          </div>

                          {/* Party Information strictly displayed */}
                          <div style={{ fontSize: "11px", backgroundColor: "var(--bg-soft, rgba(0,0,0,0.02))", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                            {tx.contractType === "assignment" ? (
                              <>
                                <div style={{ color: "var(--fg)" }}>
                                  <strong style={{ color: "#a855f7" }}>Wholesaler:</strong> {tx.sellerName || crmBusinessName || "Wholesaler"}
                                </div>
                                <div style={{ color: "var(--fg)", marginTop: "2px" }}>
                                  <strong style={{ color: "#3b82f6" }}>Investor:</strong> {tx.buyerName || "Cash Buyer / Assignee"}
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ color: "var(--fg)" }}>
                                  <strong>Seller:</strong> {tx.sellerName || "Homeowner"}
                                </div>
                                <div style={{ color: "var(--muted)", marginTop: "2px" }}>
                                  <strong>Buyer:</strong> {tx.buyerName || (crmBusinessName || "Revzenta Capital LLC") + " and/or assigns"}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Financials */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", borderTop: "1px solid var(--border)", paddingTop: "6px" }}>
                            <div>
                              <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>Contract Price</span>
                              <strong style={{ color: "var(--fg)" }}>${tx.purchasePrice.toLocaleString()}</strong>
                            </div>
                            {tx.assignmentFee > 0 && (
                              <div style={{ textAlign: "right" }}>
                                <span style={{ fontSize: "10px", color: "#a855f7", display: "block", fontWeight: 600 }}>Assignment Fee</span>
                                <strong style={{ color: "#a855f7" }}>+${tx.assignmentFee.toLocaleString()}</strong>
                              </div>
                            )}
                          </div>

                          {/* Contingency / Escrow status snippet */}
                          <div style={{ fontSize: "11px", color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
                            <span>EMD: <strong style={{ color: tx.emdStatus === "hard" ? "#10b981" : "inherit" }}>{tx.emdStatus}</strong></span>
                            <span>Close: {tx.closingDate || "TBD"}</span>
                          </div>

                          {/* Card Actions */}
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                            <button
                              onClick={() => setEditingTx(tx)}
                              style={{
                                flex: 1,
                                padding: "4px 8px",
                                borderRadius: "4px",
                                border: "1px solid var(--border)",
                                backgroundColor: "var(--panel)",
                                color: "var(--fg)",
                                fontSize: "11px",
                                cursor: "pointer",
                                textAlign: "center",
                              }}
                            >
                              Manage Deal
                            </button>
                            {tx.contractPdfUrl && (
                              <a
                                href={tx.contractPdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  border: "1px solid var(--border)",
                                  backgroundColor: "var(--panel)",
                                  color: "var(--fg)",
                                  fontSize: "11px",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                PDF
                              </a>
                            )}
                            <a
                              href={tx.titlePortalUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                border: "1px solid var(--border)",
                                backgroundColor: "var(--panel)",
                                color: "var(--fg)",
                                fontSize: "11px",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                            >
                              Title
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: CONTINGENCY CLOCKS & DEALS
         ───────────────────────────────────────────────────────────── */}
      {!loading && activeTab === "clocks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filtered.map((tx) => {
            const urgencyColor =
              tx.inspectionUrgency === "urgent"
                ? "#ef4444"
                : tx.inspectionUrgency === "warning"
                ? "#f59e0b"
                : tx.inspectionUrgency === "safe"
                ? "#10b981"
                : "#64748b";

            const progressPct =
              tx.inspectionDays > 0 && tx.daysLeftInspection !== null
                ? Math.max(0, Math.min(100, Math.round(((tx.inspectionDays - tx.daysLeftInspection) / tx.inspectionDays) * 100)))
                : 100;

            return (
              <div
                key={tx.id}
                style={{
                  backgroundColor: "var(--card-bg, var(--panel))",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                {/* Card Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          textTransform: "uppercase",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: tx.contractType === "assignment" ? "rgba(147, 51, 234, 0.15)" : "rgba(59, 130, 246, 0.15)",
                          color: tx.contractType === "assignment" ? "#a855f7" : "#3b82f6",
                        }}
                      >
                        {tx.contractType === "assignment" ? "Assignment Agreement" : "Purchase & Sale (PSA)"}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: tx.status === "signed" ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                          color: tx.status === "signed" ? "#10b981" : "var(--muted)",
                        }}
                      >
                        {tx.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>State: {tx.stateJurisdiction}</span>
                    </div>
                    <h2 style={{ margin: "8px 0 4px 0", fontSize: "18px", fontWeight: 700, color: "var(--fg)" }}>
                      {tx.propertyAddress}
                    </h2>
                    <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                      {tx.contractType === "assignment" ? (
                        <span>
                          Wholesaler: <strong style={{ color: "var(--fg)" }}>{tx.sellerName || crmBusinessName || "Wholesaler (Assignor)"}</strong> &bull; Investor: <strong style={{ color: "var(--fg)" }}>{tx.buyerName || "Investor (Assignee)"}</strong>
                        </span>
                      ) : (
                        <span>
                          Seller: <strong>{tx.sellerName || "N/A"}</strong> &bull; Buyer: <strong>{tx.buyerName || "N/A"}</strong>
                        </span>
                      )}
                    </div>
                    {/* Wholesale 5-step milestone indicator */}
                    {(() => {
                      const stepNum = getDealWholesaleStep(tx);
                      const stepDef = WHOLESALE_STEPS.find((s) => s.step === stepNum) || WHOLESALE_STEPS[0];
                      return (
                        <div style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 8px", borderRadius: "4px", backgroundColor: "var(--bg-soft, rgba(0,0,0,0.04))", border: "1px solid var(--border)", fontSize: "11px" }}>
                          <span style={{ fontWeight: 700, color: "var(--accent, #3b82f6)" }}>{stepDef.icon} Step {stepNum}:</span>
                          <span style={{ fontWeight: 600, color: "var(--fg)" }}>{stepDef.shortTitle}</span>
                          <span style={{ color: "var(--muted)" }}>&bull; {stepDef.badge}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Financials pill */}
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--fg)" }}>
                      ${tx.purchasePrice.toLocaleString()}
                    </div>
                    {tx.assignmentFee > 0 && (
                      <div style={{ fontSize: "13px", color: "#a855f7", fontWeight: 600 }}>
                        +${tx.assignmentFee.toLocaleString()} Assignment Fee
                      </div>
                    )}
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                      EMD: ${tx.earnestMoney.toLocaleString()} ({tx.emdStatus})
                    </div>
                  </div>
                </div>

                {/* Contingency Clocks Dashboard Section */}
                <div
                  style={{
                    marginTop: "16px",
                    padding: "14px 16px",
                    borderRadius: "8px",
                    backgroundColor: "var(--bg-soft, rgba(0,0,0,0.02))",
                    border: "1px solid var(--border)",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "16px",
                    alignItems: "center",
                  }}
                >
                  {/* Inspection Clock */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      <span style={{ color: "var(--muted)" }}>INSPECTION CONTINGENCY</span>
                      <span style={{ color: urgencyColor }}>
                        {tx.inspectionStatus === "passed"
                          ? "Passed / Waived"
                          : tx.daysLeftInspection !== null
                          ? tx.daysLeftInspection < 0
                            ? "Expired"
                            : `${tx.daysLeftInspection} Days Left (${tx.hoursLeftInspection} hrs)`
                          : "No deadline"}
                      </span>
                    </div>
                    {/* Progress meter */}
                    <div style={{ height: "8px", width: "100%", backgroundColor: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${progressPct}%`,
                          backgroundColor: urgencyColor,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px", display: "flex", justifyContent: "space-between" }}>
                      <span>Period: {tx.inspectionDays} Days</span>
                      <span>Deadline: {tx.inspectionDeadline || "Not set"}</span>
                    </div>
                  </div>

                  {/* EMD & Closing Milestones */}
                  <div style={{ display: "flex", gap: "16px", fontSize: "13px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>EMD HARD DATE</div>
                      <div style={{ fontWeight: 600, color: tx.emdStatus === "hard" ? "#10b981" : "var(--fg)", marginTop: "2px" }}>
                        {tx.emdDueDate || "TBD"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                        Status: <strong style={{ color: tx.emdStatus === "hard" ? "#10b981" : "var(--fg)" }}>{tx.emdStatus}</strong>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>TARGET CLOSING</div>
                      <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "2px" }}>
                        {tx.closingDate || "TBD"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {tx.daysLeftClosing !== null && tx.daysLeftClosing >= 0 ? `${tx.daysLeftClosing} days remaining` : "Scheduled"}
                      </div>
                    </div>
                  </div>

                  {/* Title Company info */}
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>ESCROW / TITLE</div>
                    <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tx.titleCompanyName || "No Title Co Assigned"}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                      Officer: {tx.escrowOfficerName || "N/A"} &bull; File: {tx.escrowFileNumber || `#${tx.id}`}
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  {tx.inspectionStatus === "active" && (
                    <>
                      <button
                        onClick={() => handleExtendInspection(tx, 3)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--panel)",
                          color: "var(--fg)",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        title="Add 3 days to inspection period"
                      >
                        ⏱️ +3 Days Inspection
                      </button>
                      <button
                        onClick={() => handlePassInspection(tx)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "1px solid #10b981",
                          backgroundColor: "rgba(16, 185, 129, 0.1)",
                          color: "#10b981",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        ✅ Pass Inspection
                      </button>
                    </>
                  )}

                  {tx.emdStatus !== "hard" && (
                    <button
                      onClick={() => handleUpdateEmdStatus(tx, "hard")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--panel)",
                        color: "var(--fg)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      💰 Mark EMD Hard
                    </button>
                  )}

                  <a
                    href={tx.titlePortalUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--panel)",
                      color: "var(--fg)",
                      fontSize: "12px",
                      fontWeight: 600,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    🏛️ Title Portal &rarr;
                  </a>

                  {tx.contractPdfUrl && (
                    <a
                      href={tx.contractPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--panel)",
                        color: "var(--fg)",
                        fontSize: "12px",
                        fontWeight: 600,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      📥 Contract PDF
                    </a>
                  )}

                  <button
                    onClick={() => {
                      setTitlePacketModalTx(tx);
                      setTitlePacketEmail(tx.escrowOfficerEmail || "");
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--panel)",
                      color: "var(--fg)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✉️ Email Title Packet
                  </button>

                  <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => setEditingTx(tx)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        backgroundColor: "transparent",
                        color: "var(--fg)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to delete transaction for ${tx.propertyAddress}?`)) return;
                        try {
                          await api.deleteTransaction(tx.id);
                          setTransactions((prev) => prev.filter((i) => i.id !== tx.id));
                          notify("success", "Transaction deleted.");
                        } catch (e: any) {
                          notify("error", e?.message || "Failed to delete.");
                        }
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        backgroundColor: "transparent",
                        color: "#ef4444",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: CONTRACTS & E-SIGNATURE HUB
         ───────────────────────────────────────────────────────────── */}
      {!loading && activeTab === "contracts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "16px",
              fontSize: "13px",
              color: "var(--fg)",
            }}
          >
            <strong>State-Compliant Contracts &amp; Countersignatures:</strong> All Purchase &amp; Sale Agreements and
            Assignment Contracts auto-include the wholesale assignment clause (<em>&ldquo;and/or assigns&rdquo;</em>), inspection
            contingency provisions, and statutory disclosures for TX, FL, CA, GA, NC, and AZ.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: "var(--card-bg, var(--panel))",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                overflow: "hidden",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "var(--panel)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: "var(--muted)" }}>Property Address</th>
                  <th style={{ padding: "12px 16px", color: "var(--muted)" }}>Type &amp; State</th>
                  <th style={{ padding: "12px 16px", color: "var(--muted)" }}>Parties (Wholesaler &amp; Investor / Seller &amp; Buyer)</th>
                  <th style={{ padding: "12px 16px", color: "var(--muted)" }}>Contract Price</th>
                  <th style={{ padding: "12px 16px", color: "var(--muted)" }}>E-Sign Status</th>
                  <th style={{ padding: "12px 16px", color: "var(--muted)", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--fg)" }}>
                      {tx.propertyAddress}
                      <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>
                        Created {new Date(tx.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          textTransform: "uppercase",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: tx.contractType === "assignment" ? "rgba(147, 51, 234, 0.1)" : "rgba(59, 130, 246, 0.1)",
                          color: tx.contractType === "assignment" ? "#a855f7" : "#3b82f6",
                        }}
                      >
                        {tx.contractType.toUpperCase()}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--muted)", marginLeft: "6px" }}>
                        ({tx.stateJurisdiction})
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fg)" }}>
                      {tx.contractType === "assignment" ? (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "3px", backgroundColor: "rgba(168, 85, 247, 0.15)", color: "#a855f7", textTransform: "uppercase" }}>
                              Wholesaler
                            </span>
                            <strong style={{ color: "var(--fg)" }}>{tx.sellerName || crmBusinessName || "Wholesaler (Assignor)"}</strong>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "3px", backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", textTransform: "uppercase" }}>
                              Investor
                            </span>
                            <strong style={{ color: "var(--fg)" }}>{tx.buyerName || "Investor (Assignee / Cash Buyer)"}</strong>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Seller:</span>{" "}
                            <strong>{tx.sellerName || "Seller (Homeowner)"}</strong>
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>Buyer:</span>{" "}
                            {tx.buyerName || "Buyer (Wholesaler)"}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--fg)" }}>
                      ${tx.purchasePrice.toLocaleString()}
                      {tx.assignmentFee > 0 && (
                        <div style={{ fontSize: "11px", color: "#a855f7", fontWeight: 600 }}>
                          +${tx.assignmentFee.toLocaleString()} fee
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          backgroundColor: tx.status === "signed" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: tx.status === "signed" ? "#10b981" : "#f59e0b",
                        }}
                      >
                        {tx.status === "signed" ? "✅ Signed" : "⏳ " + tx.status.toUpperCase()}
                      </span>
                      {tx.signedAt && (
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                          Signed by {tx.signerName} ({new Date(tx.signedAt).toLocaleDateString()})
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        {tx.contractPdfUrl && (
                          <a
                            href={tx.contractPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              backgroundColor: "var(--panel)",
                              border: "1px solid var(--border)",
                              color: "var(--fg)",
                              fontSize: "12px",
                              textDecoration: "none",
                            }}
                          >
                            PDF
                          </a>
                        )}
                        <button
                          onClick={() => copyToClipboard(tx.signUrl, "E-Sign Link")}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--panel)",
                            border: "1px solid var(--border)",
                            color: "var(--fg)",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          Copy Link
                        </button>
                        <button
                          onClick={() => {
                            setSignRequestModalTx(tx);
                            setSignRequestEmail(tx.sellerEmail || tx.buyerEmail || "");
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--accent, #3b82f6)",
                            border: "none",
                            color: "#ffffff",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          Email Signer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: TITLE COMPANY & ESCROW PORTAL
         ───────────────────────────────────────────────────────────── */}
      {!loading && activeTab === "title" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "16px",
              fontSize: "13px",
              color: "var(--fg)",
            }}
          >
            <strong>Collaborative Escrow Workspaces:</strong> Each transaction possesses a secure, dedicated Title Portal link
            for your title and escrow officers. Officers can view settlement numbers, access payoff demands, download contracts, and
            update closing milestones in real-time.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "16px" }}>
            {filtered.map((tx) => {
              const stages = [
                { key: "opened", label: "Title Opened" },
                { key: "prelim_review", label: "Prelim Issued" },
                { key: "payoff_ordered", label: "Payoffs Ordered" },
                { key: "clear_to_close", label: "Clear to Close" },
                { key: "closed", label: "Funded & Recorded" },
              ];

              const currentStageIndex = stages.findIndex((s) => s.key === tx.titleStatus);

              return (
                <div
                  key={tx.id}
                  style={{
                    backgroundColor: "var(--card-bg, var(--panel))",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "18px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(59, 130, 246, 0.1)",
                          color: "#3b82f6",
                          textTransform: "uppercase",
                        }}
                      >
                        File #{tx.escrowFileNumber || tx.id}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>Target Close: {tx.closingDate || "TBD"}</span>
                    </div>

                    <h3 style={{ margin: "8px 0 4px 0", fontSize: "16px", color: "var(--fg)", fontWeight: 700 }}>
                      {tx.propertyAddress}
                    </h3>
                    <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                      Title Co: <strong>{tx.titleCompanyName || "Pending Assignment"}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                      Escrow Officer: {tx.escrowOfficerName || "N/A"} ({tx.escrowOfficerEmail || "No email"})
                    </div>

                    {/* Milestone Stepper */}
                    <div style={{ marginTop: "16px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>
                        CLOSING MILESTONE
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {stages.map((stage, idx) => {
                          const isDone = currentStageIndex >= idx;
                          const isCurrent = tx.titleStatus === stage.key;

                          return (
                            <div
                              key={stage.key}
                              style={{
                                flex: 1,
                                textAlign: "center",
                                padding: "6px 2px",
                                borderRadius: "4px",
                                fontSize: "10px",
                                fontWeight: 600,
                                backgroundColor: isCurrent
                                  ? "var(--accent, #3b82f6)"
                                  : isDone
                                  ? "rgba(16, 185, 129, 0.2)"
                                  : "var(--border)",
                                color: isCurrent ? "#ffffff" : isDone ? "#10b981" : "var(--muted)",
                              }}
                              title={stage.label}
                            >
                              {stage.label.split(" ")[0]}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Payoff info snippet */}
                    {tx.payoffLender && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "10px",
                          borderRadius: "6px",
                          backgroundColor: "var(--bg-soft, rgba(0,0,0,0.02))",
                          fontSize: "12px",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <strong style={{ color: "var(--fg)" }}>Payoff Demand:</strong> {tx.payoffLender} &bull; $
                        {tx.payoffDemandAmount.toLocaleString()} (Loan #{tx.payoffLoanNumber || "N/A"})
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                    <a
                      href={tx.titlePortalUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: 1,
                        padding: "8px",
                        textAlign: "center",
                        borderRadius: "6px",
                        backgroundColor: "var(--accent, #3b82f6)",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Open Portal
                    </a>
                    <button
                      onClick={() => copyToClipboard(tx.titlePortalUrl, "Title Portal Link")}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--panel)",
                        color: "var(--fg)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => {
                        setTitlePacketModalTx(tx);
                        setTitlePacketEmail(tx.escrowOfficerEmail || "");
                      }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--panel)",
                        color: "var(--fg)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Email Officer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREATE / GENERATE TRANSACTION CONTRACT
         ───────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <CreateTransactionModal
          properties={properties}
          buyers={buyers}
          crmBusinessName={crmBusinessName}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newTx) => {
            setTransactions((prev) => [newTx, ...prev]);
            setShowCreateModal(false);
            notify("success", `Created new contract and initialized contingency clocks for ${newTx.propertyAddress}!`);
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT TRANSACTION
         ───────────────────────────────────────────────────────────── */}
      {editingTx && (
        <EditTransactionModal
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={(updated) => {
            setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setEditingTx(null);
            notify("success", `Updated transaction for ${updated.propertyAddress}`);
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SEND TITLE PACKET
         ───────────────────────────────────────────────────────────── */}
      {titlePacketModalTx && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--panel)",
              borderRadius: "10px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", color: "var(--fg)", fontSize: "18px" }}>
              Send Title &amp; Escrow Opening Packet
            </h3>
            <p style={{ margin: "0 0 16px 0", color: "var(--muted)", fontSize: "13px" }}>
              Email closing files, settlement numbers, payoff demand details, and direct portal link to the escrow officer.
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Escrow Officer Email
              </label>
              <input
                type="email"
                value={titlePacketEmail}
                onChange={(e) => setTitlePacketEmail(e.target.value)}
                placeholder="officer@titlecompany.com"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--input-bg, var(--panel))",
                  color: "var(--fg)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setTitlePacketModalTx(null)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--fg)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendTitlePacket}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--accent, #3b82f6)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Send Packet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SEND E-SIGNATURE REQUEST
         ───────────────────────────────────────────────────────────── */}
      {signRequestModalTx && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--panel)",
              borderRadius: "10px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", color: "var(--fg)", fontSize: "18px" }}>
              Send E-Signature Link
            </h3>
            <p style={{ margin: "0 0 16px 0", color: "var(--muted)", fontSize: "13px" }}>
              Email the online contract execution link to the seller or buyer.
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Recipient Email
              </label>
              <input
                type="email"
                value={signRequestEmail}
                onChange={(e) => setSignRequestEmail(e.target.value)}
                placeholder="signer@example.com"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--input-bg, var(--panel))",
                  color: "var(--fg)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setSignRequestModalTx(null)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--fg)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendSignRequest}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--accent, #3b82f6)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Send E-Sign Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: CREATE TRANSACTION MODAL
// ─────────────────────────────────────────────────────────────
interface CreateModalProps {
  properties: Client[];
  buyers: Buyer[];
  crmBusinessName?: string;
  onClose: () => void;
  onCreated: (tx: Transaction) => void;
}

function CreateTransactionModal({ properties, buyers, crmBusinessName, onClose, onCreated }: CreateModalProps) {
  const [contractType, setContractType] = useState<"psa" | "assignment">("psa");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>("");

  const [propertyAddress, setPropertyAddress] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");

  const [purchasePrice, setPurchasePrice] = useState<number>(150000);
  const [assignmentFee, setAssignmentFee] = useState<number>(10000);
  const [earnestMoney, setEarnestMoney] = useState<number>(2000);
  const [emdDueDate, setEmdDueDate] = useState<string>("");
  const [inspectionDays, setInspectionDays] = useState<number>(10);
  const [closingDate, setClosingDate] = useState<string>("");

  const [titleCompanyName, setTitleCompanyName] = useState("First American Title");
  const [escrowOfficerName, setEscrowOfficerName] = useState("");
  const [escrowOfficerEmail, setEscrowOfficerEmail] = useState("");
  const [escrowOfficerPhone, setEscrowOfficerPhone] = useState("");
  const [escrowFileNumber, setEscrowFileNumber] = useState("");

  const [payoffLender, setPayoffLender] = useState("");
  const [payoffDemandAmount, setPayoffDemandAmount] = useState<number>(0);
  const [payoffLoanNumber, setPayoffLoanNumber] = useState("");

  const [stateJurisdiction, setStateJurisdiction] = useState("US General");
  const [customTerms, setCustomTerms] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Set defaults on mount
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setEmdDueDate(d.toISOString().split("T")[0]);

    const closeD = new Date();
    closeD.setDate(closeD.getDate() + 21);
    setClosingDate(closeD.toISOString().split("T")[0]);

    if (contractType === "psa" && !buyerName) {
      setBuyerName((crmBusinessName || "Revzenta Capital LLC") + " and/or assigns");
    }
  }, []);

  // When property selected, auto-populate fields
  const handleSelectProperty = (idStr: string) => {
    setSelectedPropertyId(idStr);
    const p = properties.find((item) => String(item.id) === idStr);
    if (p) {
      setPropertyAddress(p.address || p.companyName);
      setSellerName(p.contactName || p.companyName);
      setSellerEmail(p.email || "");
      setSellerPhone(p.phone || "");
      if (p.dealValue > 0) setPurchasePrice(p.dealValue);
    }
  };

  // When buyer selected, auto-populate fields
  const handleSelectBuyer = (idStr: string) => {
    setSelectedBuyerId(idStr);
    const b = buyers.find((item) => String(item.id) === idStr);
    if (b) {
      setBuyerName(b.name);
      setBuyerPhone(b.phone || "");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyAddress.trim()) {
      setErr("Property address is required.");
      return;
    }
    setSaving(true);
    setErr(null);

    try {
      const res = await api.createTransaction({
        contractType,
        propertyAddress,
        sellerName,
        sellerEmail,
        sellerPhone,
        buyerName,
        buyerEmail,
        buyerPhone,
        purchasePrice,
        assignmentFee: contractType === "assignment" ? assignmentFee : 0,
        earnestMoney,
        emdDueDate,
        inspectionDays,
        closingDate,
        titleCompanyName,
        escrowOfficerName,
        escrowOfficerEmail,
        escrowOfficerPhone,
        escrowFileNumber,
        payoffLender,
        payoffDemandAmount,
        payoffLoanNumber,
        stateJurisdiction,
        customTerms,
        clientId: selectedPropertyId ? Number(selectedPropertyId) : undefined,
        buyerId: selectedBuyerId ? Number(selectedBuyerId) : undefined,
      });

      if (res.ok) {
        onCreated(res.transaction);
      }
    } catch (error: any) {
      setErr(error?.message || "Failed to create transaction.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--panel)",
          borderRadius: "10px",
          width: "100%",
          maxWidth: "800px",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "1px solid var(--border)",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", color: "var(--fg)" }}>Generate Contract &amp; Initialize Transaction</h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "var(--muted)" }}>
              Auto-populates state-specific legal clauses, inspection timers, and shared Title Company portal.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "20px", color: "var(--muted)", cursor: "pointer" }}
          >
            &times;
          </button>
        </div>

        {err && (
          <div style={{ padding: "10px 14px", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444", borderRadius: "6px", marginBottom: "16px", fontSize: "13px" }}>
            {err}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Contract Type Selection */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <label
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: `2px solid ${contractType === "psa" ? "var(--accent, #3b82f6)" : "var(--border)"}`,
                backgroundColor: contractType === "psa" ? "rgba(59, 130, 246, 0.05)" : "transparent",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "var(--fg)" }}>
                <input
                  type="radio"
                  name="contractType"
                  checked={contractType === "psa"}
                  onChange={() => {
                    setContractType("psa");
                    setBuyerName((crmBusinessName || "Revzenta Capital LLC") + " and/or assigns");
                  }}
                />
                Purchase &amp; Sale Agreement (PSA)
              </div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                Between Homeowner (Seller) and Wholesaler (Buyer) with 'and/or assigns' clause
              </span>
            </label>

            <label
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: `2px solid ${contractType === "assignment" ? "var(--accent, #3b82f6)" : "var(--border)"}`,
                backgroundColor: contractType === "assignment" ? "rgba(147, 51, 234, 0.05)" : "transparent",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "var(--fg)" }}>
                <input
                  type="radio"
                  name="contractType"
                  checked={contractType === "assignment"}
                  onChange={() => {
                    setContractType("assignment");
                    if (!sellerName || sellerName.includes("and/or assigns")) {
                      setSellerName(crmBusinessName || "Revzenta Capital LLC");
                    }
                    if (buyerName.includes("and/or assigns")) {
                      setBuyerName("");
                    }
                  }}
                />
                Wholesale Assignment Contract
              </div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                Parties are strictly <strong>Wholesaler</strong> and <strong>Investor</strong> (Assigns PSA rights for fee)
              </span>
            </label>
          </div>

          {/* Quick autofill selectors */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                Auto-fill from Property Lead
              </label>
              <select
                value={selectedPropertyId}
                onChange={(e) => handleSelectProperty(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px" }}
              >
                <option value="">-- Select Property Pipeline Lead --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address || p.companyName} ({p.contactName || "No contact"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                Auto-fill Buyer / Assignee
              </label>
              <select
                value={selectedBuyerId}
                onChange={(e) => handleSelectBuyer(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px" }}
              >
                <option value="">-- Select from Cash Buyers Directory --</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.phone || "No phone"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Property & Jurisdiction */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Property Address *
              </label>
              <input
                type="text"
                required
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="123 Main St, Austin, TX 78701"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                State Legal Jurisdiction
              </label>
              <select
                value={stateJurisdiction}
                onChange={(e) => setStateJurisdiction(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px" }}
              >
                {STATE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Parties: Wholesaler & Investor for Assignment, or Seller & Buyer for PSA */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            {/* Party 1 */}
            <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "var(--bg-soft, rgba(0,0,0,0.02))", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--fg)", marginBottom: "4px" }}>
                {contractType === "assignment" ? "🏢 WHOLESALER (ASSIGNOR)" : "👤 SELLER INFORMATION (HOMEOWNER)"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px" }}>
                {contractType === "assignment"
                  ? "Your wholesale entity transferring equitable contract rights"
                  : "Property title holder selling with assignable clause"}
              </div>
              <input
                type="text"
                placeholder={contractType === "assignment" ? "Wholesaler Company / Name" : "Seller Legal Name"}
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px", marginBottom: "6px", boxSizing: "border-box" }}
              />
              <input
                type="email"
                placeholder={contractType === "assignment" ? "Wholesaler Email" : "Seller Email"}
                value={sellerEmail}
                onChange={(e) => setSellerEmail(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px", marginBottom: "6px", boxSizing: "border-box" }}
              />
              <input
                type="text"
                placeholder={contractType === "assignment" ? "Wholesaler Phone" : "Seller Phone"}
                value={sellerPhone}
                onChange={(e) => setSellerPhone(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px", boxSizing: "border-box" }}
              />
            </div>

            {/* Party 2 */}
            <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "var(--bg-soft, rgba(0,0,0,0.02))", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--fg)", marginBottom: "4px" }}>
                {contractType === "assignment" ? "💼 INVESTOR (ASSIGNEE / CASH BUYER)" : "🏢 BUYER ENTITY (WHOLESALER)"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px" }}>
                {contractType === "assignment"
                  ? "End cash buyer purchasing equitable rights & paying fee"
                  : "Includes 'and/or assigns' wholesale clause"}
              </div>
              <input
                type="text"
                placeholder={contractType === "assignment" ? "Investor / Cash Buyer Name" : "Buyer Legal Name (and/or assigns)"}
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px", marginBottom: "6px", boxSizing: "border-box" }}
              />
              <input
                type="email"
                placeholder={contractType === "assignment" ? "Investor Email" : "Buyer Email"}
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px", marginBottom: "6px", boxSizing: "border-box" }}
              />
              <input
                type="text"
                placeholder={contractType === "assignment" ? "Investor Phone" : "Buyer Phone"}
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* Financials & Contingency Timers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                Purchase Price ($)
              </label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>

            {contractType === "assignment" && (
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#a855f7", marginBottom: "4px" }}>
                  Assignment Fee ($)
                </label>
                <input
                  type="number"
                  value={assignmentFee}
                  onChange={(e) => setAssignmentFee(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #a855f7", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                Earnest Money Deposit ($)
              </label>
              <input
                type="number"
                value={earnestMoney}
                onChange={(e) => setEarnestMoney(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                Inspection Period (Days)
              </label>
              <input
                type="number"
                value={inspectionDays}
                onChange={(e) => setInspectionDays(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                EMD Due Date
              </label>
              <input
                type="date"
                value={emdDueDate}
                onChange={(e) => setEmdDueDate(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                Closing Date
              </label>
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* Title Company & Escrow Info */}
          <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--bg-soft, rgba(0,0,0,0.02))", border: "1px solid var(--border)", marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--fg)", marginBottom: "8px" }}>
              TITLE COMPANY &amp; ESCROW OFFICER
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              <input
                type="text"
                placeholder="Title Company Name"
                value={titleCompanyName}
                onChange={(e) => setTitleCompanyName(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px" }}
              />
              <input
                type="text"
                placeholder="Escrow Officer Name"
                value={escrowOfficerName}
                onChange={(e) => setEscrowOfficerName(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px" }}
              />
              <input
                type="email"
                placeholder="Escrow Officer Email"
                value={escrowOfficerEmail}
                onChange={(e) => setEscrowOfficerEmail(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px" }}
              />
              <input
                type="text"
                placeholder="Escrow File #"
                value={escrowFileNumber}
                onChange={(e) => setEscrowFileNumber(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px" }}
              />
            </div>
          </div>

          {/* Payoff Information */}
          <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--bg-soft, rgba(0,0,0,0.02))", border: "1px solid var(--border)", marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--fg)", marginBottom: "8px" }}>
              EXISTING LENDER PAYOFF DEMAND (OPTIONAL)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              <input
                type="text"
                placeholder="Lender Name (e.g. Wells Fargo)"
                value={payoffLender}
                onChange={(e) => setPayoffLender(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px" }}
              />
              <input
                type="number"
                placeholder="Est. Payoff Balance ($)"
                value={payoffDemandAmount || ""}
                onChange={(e) => setPayoffDemandAmount(Number(e.target.value))}
                style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px" }}
              />
              <input
                type="text"
                placeholder="Loan / Account Number"
                value={payoffLoanNumber}
                onChange={(e) => setPayoffLoanNumber(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "12px" }}
              />
            </div>
          </div>

          {/* Custom Addendum & Terms */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
              Special Stipulations &amp; Custom Addenda
            </label>
            <textarea
              rows={2}
              value={customTerms}
              onChange={(e) => setCustomTerms(e.target.value)}
              placeholder="e.g. Seller to credit $2,500 towards buyer closing costs. Property sold strictly as-is."
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{ padding: "10px 16px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--fg)", fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: "10px 20px", borderRadius: "6px", border: "none", backgroundColor: "var(--accent, #3b82f6)", color: "#ffffff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
            >
              {saving ? "Generating Legal Contract..." : "Generate Contract & Start Clocks"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: EDIT TRANSACTION MODAL
// ─────────────────────────────────────────────────────────────
interface EditModalProps {
  tx: Transaction;
  onClose: () => void;
  onSaved: (tx: Transaction) => void;
}

function EditTransactionModal({ tx, onClose, onSaved }: EditModalProps) {
  const [contractType, setContractType] = useState<"psa" | "assignment">(tx.contractType as any || "psa");
  const [propertyAddress, setPropertyAddress] = useState(tx.propertyAddress || "");
  const [sellerName, setSellerName] = useState(tx.sellerName || "");
  const [buyerName, setBuyerName] = useState(tx.buyerName || "");
  const [inspectionStatus, setInspectionStatus] = useState(tx.inspectionStatus);
  const [inspectionDays, setInspectionDays] = useState(tx.inspectionDays);
  const [inspectionDeadline, setInspectionDeadline] = useState(tx.inspectionDeadline);
  const [emdStatus, setEmdStatus] = useState(tx.emdStatus);
  const [emdDueDate, setEmdDueDate] = useState(tx.emdDueDate);
  const [titleStatus, setTitleStatus] = useState(tx.titleStatus);
  const [titleCompanyName, setTitleCompanyName] = useState(tx.titleCompanyName);
  const [escrowOfficerName, setEscrowOfficerName] = useState(tx.escrowOfficerName);
  const [escrowOfficerEmail, setEscrowOfficerEmail] = useState(tx.escrowOfficerEmail);
  const [escrowFileNumber, setEscrowFileNumber] = useState(tx.escrowFileNumber);
  const [purchasePrice, setPurchasePrice] = useState(tx.purchasePrice);
  const [assignmentFee, setAssignmentFee] = useState(tx.assignmentFee);
  const [closingDate, setClosingDate] = useState(tx.closingDate);
  const [customTerms, setCustomTerms] = useState(tx.customTerms);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    try {
      const res = await api.updateTransaction(tx.id, {
        contractType,
        propertyAddress,
        sellerName,
        buyerName,
        inspectionStatus,
        inspectionDays,
        inspectionDeadline,
        emdStatus,
        emdDueDate,
        titleStatus,
        titleCompanyName,
        escrowOfficerName,
        escrowOfficerEmail,
        escrowFileNumber,
        purchasePrice,
        assignmentFee,
        closingDate,
        customTerms,
      });

      if (res.ok) {
        onSaved(res.transaction);
      }
    } catch (error: any) {
      setErr(error?.message || "Failed to update transaction.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--panel)",
          borderRadius: "10px",
          width: "100%",
          maxWidth: "700px",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "1px solid var(--border)",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", color: "var(--fg)" }}>Edit Transaction &amp; Contingencies</h2>
            <div style={{ fontSize: "13px", color: "var(--muted)" }}>{tx.propertyAddress}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "20px", color: "var(--muted)", cursor: "pointer" }}
          >
            &times;
          </button>
        </div>

        {err && (
          <div style={{ padding: "10px 14px", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444", borderRadius: "6px", marginBottom: "16px", fontSize: "13px" }}>
            {err}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Contract Type & Property Address */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Contract Type
              </label>
              <select
                value={contractType}
                onChange={(e: any) => setContractType(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px" }}
              >
                <option value="psa">Purchase &amp; Sale (PSA)</option>
                <option value="assignment">Wholesale Assignment Contract</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Property Address
              </label>
              <input
                type="text"
                required
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* Parties: Wholesaler & Investor for Assignment, or Seller & Buyer for PSA */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                {contractType === "assignment" ? "🏢 Wholesaler (Assignor)" : "👤 Seller (Homeowner)"}
              </label>
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder={contractType === "assignment" ? "Wholesaler Company / Name" : "Seller Legal Name"}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                {contractType === "assignment" ? "💼 Investor (Assignee / Cash Buyer)" : "🏢 Buyer (Wholesaler Entity)"}
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder={contractType === "assignment" ? "Investor / Cash Buyer Name" : "Buyer Entity (and/or assigns)"}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Inspection Contingency Status
              </label>
              <select
                value={inspectionStatus}
                onChange={(e: any) => setInspectionStatus(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px" }}
              >
                <option value="active">Active (Clock Ticking)</option>
                <option value="passed">Passed (Contingency Cleared)</option>
                <option value="renegotiating">Renegotiating Repair Credit</option>
                <option value="waived">Waived by Buyer</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Inspection Deadline
              </label>
              <input
                type="date"
                value={inspectionDeadline}
                onChange={(e) => setInspectionDeadline(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Earnest Money Status
              </label>
              <select
                value={emdStatus}
                onChange={(e: any) => setEmdStatus(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px" }}
              >
                <option value="pending">Pending Deposit</option>
                <option value="deposited">Deposited in Escrow</option>
                <option value="hard">Hard (Non-Refundable)</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                EMD Due Date
              </label>
              <input
                type="date"
                value={emdDueDate}
                onChange={(e) => setEmdDueDate(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Title Closing Milestone
              </label>
              <select
                value={titleStatus}
                onChange={(e: any) => setTitleStatus(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px" }}
              >
                <option value="pending">Pending</option>
                <option value="opened">Title Opened</option>
                <option value="prelim_review">Prelim Issued / In Review</option>
                <option value="payoff_ordered">Payoffs Ordered</option>
                <option value="clear_to_close">Clear to Close</option>
                <option value="closed">Funded &amp; Recorded</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Closing Date
              </label>
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                Purchase Price ($)
              </label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            {tx.contractType === "assignment" && (
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#a855f7", marginBottom: "4px" }}>
                  Assignment Fee ($)
                </label>
                <input
                  type="number"
                  value={assignmentFee}
                  onChange={(e) => setAssignmentFee(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #a855f7", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
            )}
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
              Custom Terms / Addendum Notes
            </label>
            <textarea
              rows={2}
              value={customTerms}
              onChange={(e) => setCustomTerms(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--input-bg, var(--panel))", color: "var(--fg)", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{ padding: "10px 16px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--fg)", fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: "10px 20px", borderRadius: "6px", border: "none", backgroundColor: "var(--accent, #3b82f6)", color: "#ffffff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
