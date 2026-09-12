import React, { useState, useEffect, useMemo } from "react";
import { api } from "./api";
import type { Transaction, Client } from "./types";
import { money } from "./types";

interface SoldHubProps {
  crmBusinessName?: string;
}

export default function SoldHub({ crmBusinessName }: SoldHubProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [soldClients, setSoldClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [contractTypeFilter, setContractTypeFilter] = useState<"all" | "assignment" | "psa">("all");
  const [activeSubTab, setActiveSubTab] = useState<"closed" | "ready_to_close">("closed");

  // Modals
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [viewingPdfTx, setViewingPdfTx] = useState<Transaction | null>(null);
  const [showRecordSoldModal, setShowRecordSoldModal] = useState(false);
  const [closingTxId, setClosingTxId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for Recording a Sold Deal
  const [newSoldPropertyAddress, setNewSoldPropertyAddress] = useState("");
  const [newSoldSellerName, setNewSoldSellerName] = useState("");
  const [newSoldBuyerName, setNewSoldBuyerName] = useState("");
  const [newSoldContractType, setNewSoldContractType] = useState<"assignment" | "psa">("assignment");
  const [newSoldPurchasePrice, setNewSoldPurchasePrice] = useState("200000");
  const [newSoldAssignmentFee, setNewSoldAssignmentFee] = useState("15000");
  const [newSoldClosingDate, setNewSoldClosingDate] = useState(new Date().toISOString().split("T")[0]);
  const [newSoldTitleCompany, setNewSoldTitleCompany] = useState("");
  const [newSoldEscrowFileNumber, setNewSoldEscrowFileNumber] = useState("");
  const [newSoldNotes, setNewSoldNotes] = useState("");
  const [recordingBusy, setRecordingBusy] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [txRes, clientsRes] = await Promise.all([
        api.transactions().catch(() => ({ ok: true as const, transactions: [] })),
        api.clients().catch(() => ({ ok: true as const, clients: [] })),
      ]);

      if (txRes.transactions) {
        setTransactions(txRes.transactions);
      }
      if (clientsRes.clients) {
        // filter clients that are in Sold/Closed stages or marked won
        const sold = clientsRes.clients.filter((c) => {
          const s = (c.stage || "").trim().toLowerCase();
          return s === "sold" || s === "closed" || s.includes("sold") || s.includes("closed");
        });
        setSoldClients(sold);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load closed deals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Split transactions into Closed and Ready to Close (Signed)
  const closedTransactions = useMemo(() => {
    return transactions.filter(
      (tx) =>
        tx.status === "closed" ||
        tx.titleStatus === "closed" ||
        (tx.notes && tx.notes.toLowerCase().includes("funded"))
    );
  }, [transactions]);

  const readyToCloseTransactions = useMemo(() => {
    return transactions.filter(
      (tx) =>
        tx.status === "signed" &&
        tx.titleStatus !== "closed"
    );
  }, [transactions]);

  // Overall metrics calculation
  const metrics = useMemo(() => {
    const totalClosedDeals = closedTransactions.length + soldClients.length;
    let totalAssignmentFees = 0;
    let totalVolume = 0;

    closedTransactions.forEach((tx) => {
      totalAssignmentFees += Number(tx.assignmentFee || 0);
      totalVolume += Number(tx.purchasePrice || 0) + Number(tx.assignmentFee || 0);
    });

    soldClients.forEach((sc) => {
      totalVolume += Number(sc.dealValue || 0);
      // If wholesale property fee exists in custom fields
      const feeField = (sc.customFields || []).find((f) => f.name.toLowerCase().includes("assignment fee") || f.name.toLowerCase().includes("wholesale fee"));
      if (feeField && Number(feeField.value) > 0) {
        totalAssignmentFees += Number(feeField.value);
      }
    });

    const avgFee = totalClosedDeals > 0 ? totalAssignmentFees / (closedTransactions.length || 1) : 0;

    return {
      totalClosedDeals,
      totalAssignmentFees,
      totalVolume,
      avgFee,
    };
  }, [closedTransactions, soldClients]);

  // Filtered displayed records
  const filteredClosedDeals = useMemo(() => {
    return closedTransactions.filter((tx) => {
      if (contractTypeFilter !== "all" && tx.contractType !== contractTypeFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        tx.propertyAddress.toLowerCase().includes(q) ||
        (tx.sellerName && tx.sellerName.toLowerCase().includes(q)) ||
        (tx.buyerName && tx.buyerName.toLowerCase().includes(q)) ||
        (tx.titleCompanyName && tx.titleCompanyName.toLowerCase().includes(q)) ||
        (tx.escrowFileNumber && tx.escrowFileNumber.toLowerCase().includes(q))
      );
    });
  }, [closedTransactions, contractTypeFilter, searchQuery]);

  // Quick mark as closed & funded
  const handleMarkAsFunded = async (txId: number) => {
    setClosingTxId(txId);
    try {
      await api.updateTransaction(txId, {
        status: "closed",
        titleStatus: "closed",
        notes: "🎉 Closed, funded, and recorded into Sold Hub.",
      });
      showToast("Deal successfully marked as Closed & Funded! Moved to Sold Hub.");
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to finalize closing status.");
    } finally {
      setClosingTxId(null);
    }
  };

  // Record a new closed deal
  const handleSaveSoldDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSoldPropertyAddress.trim()) {
      alert("Property address is required.");
      return;
    }

    setRecordingBusy(true);
    try {
      const pPrice = Number(newSoldPurchasePrice) || 0;
      const aFee = Number(newSoldAssignmentFee) || 0;

      await api.createTransaction({
        contractType: newSoldContractType,
        propertyAddress: newSoldPropertyAddress.trim(),
        sellerName: newSoldSellerName.trim() || "Seller",
        buyerName: newSoldBuyerName.trim() || "Cash Buyer / Investor",
        purchasePrice: pPrice,
        assignmentFee: aFee,
        earnestMoney: 2500,
        closingDate: newSoldClosingDate,
        titleCompanyName: newSoldTitleCompany.trim() || "Title & Escrow Agency",
        escrowFileNumber: newSoldEscrowFileNumber.trim(),
        status: "closed",
        titleStatus: "closed",
        inspectionStatus: "passed",
        emdStatus: "hard",
        customTerms: `Recorded Closed Wholesale Deal. Assignment Fee: $${aFee.toLocaleString()}. Finalized settlement date: ${newSoldClosingDate}.`,
        notes: newSoldNotes.trim() || "Directly recorded closed wholesale disposition in Sold Hub.",
      });

      showToast("Closed wholesale deal recorded successfully!");
      setShowRecordSoldModal(false);
      // Reset form
      setNewSoldPropertyAddress("");
      setNewSoldSellerName("");
      setNewSoldBuyerName("");
      setNewSoldPurchasePrice("200000");
      setNewSoldAssignmentFee("15000");
      setNewSoldTitleCompany("");
      setNewSoldEscrowFileNumber("");
      setNewSoldNotes("");
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to record sold deal.");
    } finally {
      setRecordingBusy(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    if (closedTransactions.length === 0 && soldClients.length === 0) {
      alert("No closed deals available to export.");
      return;
    }

    const headers = [
      "Property Address",
      "Seller",
      "Buyer / Assignee",
      "Contract Type",
      "Purchase Price",
      "Assignment Fee",
      "Total Deal Volume",
      "Closing Date",
      "Title Company",
      "Escrow File #",
      "Status",
    ];

    const rows = closedTransactions.map((tx) => [
      `"${tx.propertyAddress.replace(/"/g, '""')}"`,
      `"${(tx.sellerName || "").replace(/"/g, '""')}"`,
      `"${(tx.buyerName || "").replace(/"/g, '""')}"`,
      `"${tx.contractType.toUpperCase()}"`,
      tx.purchasePrice || 0,
      tx.assignmentFee || 0,
      (tx.purchasePrice || 0) + (tx.assignmentFee || 0),
      tx.closingDate || "",
      `"${(tx.titleCompanyName || "").replace(/"/g, '""')}"`,
      `"${(tx.escrowFileNumber || "").replace(/"/g, '""')}"`,
      "Closed & Funded",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Revzenta-Sold-Hub-Export-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Sold deals ledger exported to CSV successfully.");
  };

  const getCleanContractPdfUrl = (tx: Transaction | null): string => {
    if (!tx) return "";
    if (tx.contractPdfId) return `/contract-pdf/${tx.contractPdfId}`;
    if (tx.contractPdfUrl) {
      const idx = tx.contractPdfUrl.indexOf("/contract-pdf/");
      if (idx !== -1) return tx.contractPdfUrl.slice(idx);
      return tx.contractPdfUrl;
    }
    return "";
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "#10b981",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "13px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.2)",
            zIndex: 9999,
          }}
        >
          ✅ {toastMessage}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "28px" }}>🏆</span>
            <div>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "var(--fg, var(--ink))" }}>
                Sold Hub
              </h1>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--muted)" }}>
                Closed, funded, and recorded wholesale deals &bull; Dispo revenue, assignment fees, and settlement archive
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            id="btn-export-sold-csv"
            onClick={handleExportCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--panel)",
              color: "var(--fg)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📥 Export CSV Ledger
          </button>
          <button
            id="btn-record-sold-deal"
            onClick={() => setShowRecordSoldModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--accent, #10b981)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Record Sold Deal
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--panel)",
            borderRadius: "10px",
            padding: "18px 20px",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            Total Closed Deals
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--fg)", marginTop: "6px" }}>
            {metrics.totalClosedDeals}
          </div>
          <div style={{ fontSize: "12px", color: "#10b981", marginTop: "4px" }}>
            Funded &amp; Recorded
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--panel)",
            borderRadius: "10px",
            padding: "18px 20px",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            Realized Assignment Fees
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#10b981", marginTop: "6px" }}>
            {money(metrics.totalAssignmentFees)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
            Net wholesale spread collected
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--panel)",
            borderRadius: "10px",
            padding: "18px 20px",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            Total Dispo Volume
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--fg)", marginTop: "6px" }}>
            {money(metrics.totalVolume)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
            Total transaction consideration
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--panel)",
            borderRadius: "10px",
            padding: "18px 20px",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            Avg Assignment Fee
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--accent, #3b82f6)", marginTop: "6px" }}>
            {money(metrics.avgFee)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
            Per closed disposition
          </div>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          backgroundColor: "var(--panel)",
          padding: "12px 16px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            id="tab-closed-deals"
            onClick={() => setActiveSubTab("closed")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: activeSubTab === "closed" ? "var(--accent, #3b82f6)" : "transparent",
              color: activeSubTab === "closed" ? "#ffffff" : "var(--fg)",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            🎉 Closed &amp; Funded ({closedTransactions.length})
          </button>
          <button
            id="tab-ready-to-close"
            onClick={() => setActiveSubTab("ready_to_close")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: activeSubTab === "ready_to_close" ? "var(--accent, #3b82f6)" : "transparent",
              color: activeSubTab === "ready_to_close" ? "#ffffff" : "var(--fg)",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            ✍️ Signed / Ready to Close ({readyToCloseTransactions.length})
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {activeSubTab === "closed" && (
            <select
              value={contractTypeFilter}
              onChange={(e) => setContractTypeFilter(e.target.value as any)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card-bg, var(--panel))",
                color: "var(--fg)",
                fontSize: "13px",
              }}
            >
              <option value="all">All Contract Types</option>
              <option value="assignment">Assignment Agreement</option>
              <option value="psa">Purchase &amp; Sale (PSA)</option>
            </select>
          )}

          <input
            type="text"
            placeholder="Search address, seller, buyer, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--card-bg, var(--panel))",
              color: "var(--fg)",
              fontSize: "13px",
              minWidth: "240px",
            }}
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--muted)" }}>
          Loading closed wholesale ledger...
        </div>
      ) : error ? (
        <div style={{ padding: "20px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}>
          {error}
        </div>
      ) : activeSubTab === "closed" ? (
        /* CLOSED & FUNDED DEALS TABLE */
        filteredClosedDeals.length === 0 ? (
          <div
            style={{
              backgroundColor: "var(--panel)",
              borderRadius: "10px",
              padding: "48px",
              textAlign: "center",
              border: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: "40px" }}>🏁</span>
            <h3 style={{ margin: "12px 0 6px 0", color: "var(--fg)" }}>No Closed Deals Yet</h3>
            <p style={{ margin: "0 auto 18px auto", maxWidth: "480px", fontSize: "13px", color: "var(--muted)" }}>
              When a transaction reaches funded closing or when you execute a disposition, it appears here with full revenue and settlement details.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => setActiveSubTab("ready_to_close")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card-bg, var(--panel))",
                  color: "var(--fg)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                View Signed Deals Ready to Fund ({readyToCloseTransactions.length})
              </button>
              <button
                onClick={() => setShowRecordSoldModal(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--accent, #10b981)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Record Sold Deal
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "var(--panel)",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                  <th style={{ padding: "12px 16px" }}>Property &amp; Contract</th>
                  <th style={{ padding: "12px 16px" }}>Parties (Seller &rarr; Buyer)</th>
                  <th style={{ padding: "12px 16px" }}>Closing Date</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Assignment Fee</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Volume</th>
                  <th style={{ padding: "12px 16px" }}>Title &amp; Escrow</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClosedDeals.map((tx) => (
                  <tr
                    key={tx.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      transition: "background-color 0.15s",
                    }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 700, color: "var(--fg)" }}>{tx.propertyAddress}</div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(59, 130, 246, 0.12)",
                            color: "#3b82f6",
                            textTransform: "uppercase",
                          }}
                        >
                          {tx.contractType === "assignment" ? "Assignment Agreement" : "Purchase & Sale"}
                        </span>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(16, 185, 129, 0.15)",
                            color: "#10b981",
                          }}
                        >
                          ✅ Funded
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ color: "var(--fg)" }}>
                        <strong>Seller:</strong> {tx.sellerName || "N/A"}
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: "2px" }}>
                        <strong>Buyer:</strong> {tx.buyerName || "Cash Investor"}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", color: "var(--fg)" }}>
                      <div>{tx.closingDate ? new Date(tx.closingDate).toLocaleDateString() : "Finalized"}</div>
                      <div style={{ fontSize: "11px", color: "#10b981", marginTop: "2px" }}>Recorded</div>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "#10b981" }}>
                        {money(tx.assignmentFee || 0)}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>Collected</div>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: "var(--fg)" }}>
                      {money((tx.purchasePrice || 0) + (tx.assignmentFee || 0))}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ color: "var(--fg)", fontWeight: 500 }}>
                        {tx.titleCompanyName || "Direct Title"}
                      </div>
                      {tx.escrowFileNumber && (
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                          File #{tx.escrowFileNumber}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                        {(tx.contractPdfUrl || tx.contractPdfId) && (
                          <button
                            id={`btn-sold-pdf-${tx.id}`}
                            onClick={() => setViewingPdfTx(tx)}
                            title="View / Download Contract PDF"
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "1px solid var(--border)",
                              backgroundColor: "var(--card-bg, var(--panel))",
                              color: "var(--fg)",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            📄 PDF
                          </button>
                        )}
                        <button
                          id={`btn-sold-view-${tx.id}`}
                          onClick={() => setSelectedTx(tx)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "4px",
                            border: "1px solid var(--border)",
                            backgroundColor: "transparent",
                            color: "var(--fg)",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* READY TO CLOSE / SIGNED DEALS TAB */
        <div>
          <div
            style={{
              padding: "14px 18px",
              backgroundColor: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "var(--fg)",
            }}
          >
            💡 <strong>These deals are signed and clear for closing.</strong> Once escrow confirms funding and recording, click <strong>Mark as Closed &amp; Funded</strong> to archive them into the Sold Hub and realize assignment fee revenue.
          </div>

          {readyToCloseTransactions.length === 0 ? (
            <div
              style={{
                backgroundColor: "var(--panel)",
                borderRadius: "10px",
                padding: "36px",
                textAlign: "center",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              No signed deals currently awaiting closing. Check Title Hub to monitor active inspection and title progress.
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "var(--panel)",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                    <th style={{ padding: "12px 16px" }}>Property Address</th>
                    <th style={{ padding: "12px 16px" }}>Parties</th>
                    <th style={{ padding: "12px 16px" }}>Contract Type</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Assignment Fee</th>
                    <th style={{ padding: "12px 16px" }}>Closing Target</th>
                    <th style={{ padding: "12px 16px", textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {readyToCloseTransactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--fg)" }}>
                        {tx.propertyAddress}
                        <div style={{ fontSize: "11px", color: "#10b981", fontWeight: 500, marginTop: "2px" }}>
                          Signed by {tx.signerName || tx.sellerName}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div>Seller: {tx.sellerName}</div>
                        <div style={{ color: "var(--muted)" }}>Buyer: {tx.buyerName || "N/A"}</div>
                      </td>
                      <td style={{ padding: "14px 16px", textTransform: "capitalize", color: "var(--fg)" }}>
                        {tx.contractType}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#10b981" }}>
                        {money(tx.assignmentFee || 0)}
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--fg)" }}>
                        {tx.closingDate ? new Date(tx.closingDate).toLocaleDateString() : "Pending"}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          {(tx.contractPdfUrl || tx.contractPdfId) && (
                            <button
                              onClick={() => setViewingPdfTx(tx)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "6px",
                                border: "1px solid var(--border)",
                                backgroundColor: "var(--card-bg, var(--panel))",
                                color: "var(--fg)",
                                fontSize: "12px",
                                cursor: "pointer",
                              }}
                            >
                              📄 PDF
                            </button>
                          )}
                          <button
                            id={`btn-mark-closed-${tx.id}`}
                            onClick={() => handleMarkAsFunded(tx.id)}
                            disabled={closingTxId === tx.id}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              border: "none",
                              backgroundColor: "#10b981",
                              color: "#ffffff",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: closingTxId === tx.id ? "not-allowed" : "pointer",
                            }}
                          >
                            {closingTxId === tx.id ? "Closing..." : "🎉 Mark Closed & Funded"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: RECORD SOLD DEAL
         ───────────────────────────────────────────────────────────── */}
      {showRecordSoldModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "20px",
          }}
          onClick={() => setShowRecordSoldModal(false)}
        >
          <div
            style={{
              backgroundColor: "var(--panel)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "580px",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--fg)" }}>
                Record Closed Wholesale Deal
              </h3>
              <button
                onClick={() => setShowRecordSoldModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSoldDeal}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                  Property Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 450 Oak Ridge Lane, Dallas, TX 75201"
                  value={newSoldPropertyAddress}
                  onChange={(e) => setNewSoldPropertyAddress(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--card-bg, var(--panel))",
                    color: "var(--fg)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                    Seller Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={newSoldSellerName}
                    onChange={(e) => setNewSoldSellerName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card-bg, var(--panel))",
                      color: "var(--fg)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                    Buyer / Investor Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Holdings LLC"
                    value={newSoldBuyerName}
                    onChange={(e) => setNewSoldBuyerName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card-bg, var(--panel))",
                      color: "var(--fg)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                    Contract Type
                  </label>
                  <select
                    value={newSoldContractType}
                    onChange={(e) => setNewSoldContractType(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card-bg, var(--panel))",
                      color: "var(--fg)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="assignment">Assignment Agreement</option>
                    <option value="psa">Purchase &amp; Sale (PSA)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                    Closing / Funded Date
                  </label>
                  <input
                    type="date"
                    value={newSoldClosingDate}
                    onChange={(e) => setNewSoldClosingDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card-bg, var(--panel))",
                      color: "var(--fg)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                    Purchase Price ($)
                  </label>
                  <input
                    type="number"
                    value={newSoldPurchasePrice}
                    onChange={(e) => setNewSoldPurchasePrice(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card-bg, var(--panel))",
                      color: "var(--fg)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#10b981", marginBottom: "4px" }}>
                    Realized Assignment Fee ($) *
                  </label>
                  <input
                    type="number"
                    required
                    value={newSoldAssignmentFee}
                    onChange={(e) => setNewSoldAssignmentFee(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #10b981",
                      backgroundColor: "var(--card-bg, var(--panel))",
                      color: "var(--fg)",
                      fontSize: "13px",
                      fontWeight: 700,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                    Title Company
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. First American Title"
                    value={newSoldTitleCompany}
                    onChange={(e) => setNewSoldTitleCompany(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card-bg, var(--panel))",
                      color: "var(--fg)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                    Escrow File Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FAT-2026-991"
                    value={newSoldEscrowFileNumber}
                    onChange={(e) => setNewSoldEscrowFileNumber(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card-bg, var(--panel))",
                      color: "var(--fg)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--fg)", marginBottom: "4px" }}>
                  Settlement &amp; Dispo Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Wired to operating account. Assignment fee disbursed at closing."
                  value={newSoldNotes}
                  onChange={(e) => setNewSoldNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--card-bg, var(--panel))",
                    color: "var(--fg)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowRecordSoldModal(false)}
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
                  type="submit"
                  disabled={recordingBusy}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "var(--accent, #10b981)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: recordingBusy ? "not-allowed" : "pointer",
                  }}
                >
                  {recordingBusy ? "Recording..." : "Save Closed Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: VIEW DEAL SETTLEMENT DETAILS
         ───────────────────────────────────────────────────────────── */}
      {selectedTx && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "20px",
          }}
          onClick={() => setSelectedTx(null)}
        >
          <div
            style={{
              backgroundColor: "var(--panel)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "640px",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                  }}
                >
                  ✅ Closed &amp; Funded
                </span>
                <h3 style={{ margin: "6px 0 2px 0", fontSize: "18px", color: "var(--fg)" }}>
                  {selectedTx.propertyAddress}
                </h3>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Closed on {selectedTx.closingDate ? new Date(selectedTx.closingDate).toLocaleDateString() : "Record date"}
                </div>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                padding: "14px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                marginBottom: "16px",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>Seller</div>
                <div style={{ fontWeight: 600, color: "var(--fg)" }}>{selectedTx.sellerName || "N/A"}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>Buyer / Assignee</div>
                <div style={{ fontWeight: 600, color: "var(--fg)" }}>{selectedTx.buyerName || "N/A"}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>Contract Type</div>
                <div style={{ fontWeight: 600, color: "var(--fg)", textTransform: "capitalize" }}>
                  {selectedTx.contractType}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>Assignment Fee Collected</div>
                <div style={{ fontWeight: 800, color: "#10b981", fontSize: "16px" }}>
                  {money(selectedTx.assignmentFee || 0)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>Purchase Consideration</div>
                <div style={{ fontWeight: 600, color: "var(--fg)" }}>{money(selectedTx.purchasePrice || 0)}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>Title &amp; Escrow</div>
                <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                  {selectedTx.titleCompanyName || "Direct Title"} {selectedTx.escrowFileNumber ? `(#${selectedTx.escrowFileNumber})` : ""}
                </div>
              </div>
            </div>

            {selectedTx.notes && (
              <div style={{ marginBottom: "16px", fontSize: "12px", color: "var(--fg)" }}>
                <strong>Settlement Notes:</strong>
                <p style={{ margin: "4px 0 0 0", color: "var(--muted)" }}>{selectedTx.notes}</p>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px" }}>
              <div>
                {(selectedTx.contractPdfUrl || selectedTx.contractPdfId) && (
                  <button
                    onClick={() => {
                      setViewingPdfTx(selectedTx);
                      setSelectedTx(null);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card-bg, var(--panel))",
                      color: "var(--fg)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    📄 Preview Settlement Agreement PDF
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedTx(null)}
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CONTRACT PDF PREVIEW
         ───────────────────────────────────────────────────────────── */}
      {viewingPdfTx && (
        <div
          id="modal-sold-pdf-preview"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: "20px",
          }}
          onClick={() => setViewingPdfTx(null)}
        >
          <div
            style={{
              backgroundColor: "var(--panel)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "960px",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              border: "1px solid var(--border)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                backgroundColor: "var(--card-bg, var(--panel))",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "18px" }}>📄</span>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--fg)" }}>
                    {viewingPdfTx.contractType === "assignment" ? "Assignment Agreement" : "Purchase & Sale Agreement (PSA)"}
                  </h3>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 700,
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                    }}
                  >
                    ✅ Closed / Executed
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  📍 {viewingPdfTx.propertyAddress} &bull; Seller: <strong>{viewingPdfTx.sellerName || "N/A"}</strong>
                  {viewingPdfTx.buyerName && viewingPdfTx.contractType === "assignment" && (
                    <span> &bull; Assignee/Buyer: <strong>{viewingPdfTx.buyerName}</strong></span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <a
                  href={getCleanContractPdfUrl(viewingPdfTx)}
                  download={`Contract-${viewingPdfTx.propertyAddress.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "6px",
                    backgroundColor: "var(--panel)",
                    border: "1px solid var(--border)",
                    color: "var(--fg)",
                    fontSize: "12px",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  📥 Download PDF
                </a>
                <a
                  href={getCleanContractPdfUrl(viewingPdfTx)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "7px 14px",
                    borderRadius: "6px",
                    backgroundColor: "var(--accent, #3b82f6)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  🔗 Open New Tab
                </a>
                <button
                  onClick={() => setViewingPdfTx(null)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "transparent",
                    color: "var(--fg)",
                    fontSize: "14px",
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* PDF Viewer Body */}
            <div
              style={{
                flex: 1,
                minHeight: "450px",
                height: "68vh",
                backgroundColor: "#525659",
                position: "relative",
              }}
            >
              <iframe
                src={getCleanContractPdfUrl(viewingPdfTx)}
                title="Contract Document Viewer"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  display: "block",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
