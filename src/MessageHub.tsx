import React, { useState, useEffect, useMemo, useRef } from "react";
import { api } from "./api";
import type { InternalMessage, Client, Transaction, TeamMember } from "./types";

interface Props {
  crmBusinessName?: string;
  onNavigateToLead?: (clientId: number) => void;
  onNavigateToTransaction?: (txId: number) => void;
  onNavigateToProperty?: (address: string) => void;
}

type ChannelId = "all" | "general" | "acquisitions" | "underwriting" | "escrow" | "sms" | "email" | "alerts" | "pinned" | "unread";

interface ChannelMeta {
  id: ChannelId;
  name: string;
  icon: string;
  description: string;
  category: "feed" | "channels" | "external" | "direct";
}

const CHANNELS: ChannelMeta[] = [
  { id: "all", name: "All Communications", icon: "🌐", description: "Unified omnichannel live feed of every internal and external communication across your CRM.", category: "feed" },
  { id: "unread", name: "Unread Inbox", icon: "📬", description: "Communications awaiting your review or team follow-up.", category: "feed" },
  { id: "pinned", name: "Pinned & Starred", icon: "📌", description: "Important announcements, high-priority deal notices, and critical notes.", category: "feed" },

  { id: "general", name: "general", icon: "#", description: "Company-wide internal announcements, daily standups, and general wholesale discussions.", category: "channels" },
  { id: "acquisitions", name: "acquisitions", icon: "#", description: "Lead intake, seller outreach, SMS negotiations, and off-market property discussions.", category: "channels" },
  { id: "underwriting", name: "underwriting", icon: "#", description: "ARV comp analysis, rehab repair estimates, and Maximum Allowable Offer (MAO) calculations.", category: "channels" },
  { id: "escrow", name: "escrow-closings", icon: "#", description: "Title companies, earnest money deposits, wire verifications, and closing legal notes.", category: "channels" },

  { id: "sms", name: "SMS Conversations", icon: "📱", description: "Two-way text message threads with homeowners, sellers, and cash investors.", category: "external" },
  { id: "email", name: "Email Dispatches", icon: "✉️", description: "Purchase agreements, formal LOIs, and signature invitations sent via email.", category: "external" },
  { id: "alerts", name: "Deal & System Alerts", icon: "🔔", description: "Automated contingency clock deadlines, EMD milestone notices, and webhook arrivals.", category: "external" },
];

const TEMPLATES = [
  { label: "💰 Cash Offer Follow-up", text: "Following up on our cash offer discussion. We are prepared to close in 14 days with zero contingencies and cover all normal closing costs." },
  { label: "📊 Underwriting Completed", text: "Underwriting complete. Comps indicate an ARV of $340,000 with ~$35,000 estimated repairs. Recommended MAO is $205,000 to maintain a $20,000 wholesale fee." },
  { label: "🏛️ Escrow EMD Verified", text: "Earnest Money Deposit ($2,500) has been verified deposited with the title company. Escrow file is officially open and prelim title review has begun." },
  { label: "⚠️ Inspection Clock Alert", text: "Inspection Contingency Reminder: 48 hours remaining on physical inspection. Ensure walk-through report is finalized before deadline." },
];

const EMOJIS = ["🎉", "💰", "🏠", "📄", "⚠️", "✅", "📞", "✉️", "🏛️", "🤝", "🚀", "⏳"];

export default function MessageHub({ crmBusinessName = "Revzenta", onNavigateToLead, onNavigateToTransaction, onNavigateToProperty }: Props) {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [orgName, setOrgName] = useState<string>(crmBusinessName);
  const [selectedDmUser, setSelectedDmUser] = useState<TeamMember | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [selectedMessage, setSelectedMessage] = useState<InternalMessage | null>(null);

  // Mobile layout state
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 900 : false));
  const [mobileTab, setMobileTab] = useState<"chat" | "channels">("chat");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(typeof window !== "undefined" ? window.innerWidth < 900 : false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Composer State
  const [composerBody, setComposerBody] = useState("");
  const [composerChannel, setComposerChannel] = useState<string>("general");
  const [composerType, setComposerType] = useState<"chat" | "sms" | "email" | "escrow_note" | "deal_alert">("chat");
  const [composerSubject, setComposerSubject] = useState("");
  const [composerRecipient, setComposerRecipient] = useState("");
  const [composerAddress, setComposerAddress] = useState("");
  const [composerPhone, setComposerPhone] = useState("");
  const [composerEmail, setComposerEmail] = useState("");
  const [composerDirection, setComposerDirection] = useState<"internal" | "outbound" | "inbound">("internal");
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load initial communications & CRM contacts/deals
  const loadData = async () => {
    try {
      setLoading(true);
      const [msgRes, clientRes, txRes] = await Promise.all([
        api.getMessages(),
        api.clients(),
        api.transactions().catch(() => ({ ok: true, transactions: [] })),
      ]);

      if (msgRes.ok) {
        setMessages(msgRes.messages);
        if (msgRes.members) setMembers(msgRes.members);
        if (msgRes.orgName) setOrgName(msgRes.orgName);
        if (msgRes.currentUserId) setCurrentUserId(msgRes.currentUserId);
      }
      if (clientRes.clients) {
        setClients(clientRes.clients);
      }
      if (txRes && (txRes as any).transactions) {
        setTransactions((txRes as any).transactions);
      }
    } catch (err: any) {
      console.error("Failed to load Message Hub communications:", err);
      showNotification(err?.message || "Failed to load communications", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Messages
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      // Direct Message Filter
      if (selectedDmUser) {
        const isDm =
          (m.senderId === currentUserId && m.recipientId === selectedDmUser.id) ||
          (m.senderId === selectedDmUser.id && m.recipientId === currentUserId) ||
          (m.recipientName?.toLowerCase() === selectedDmUser.name.toLowerCase()) ||
          (m.senderName?.toLowerCase() === selectedDmUser.name.toLowerCase() &&
            m.recipientName?.toLowerCase() === members.find((u) => u.id === currentUserId)?.name.toLowerCase());
        if (!isDm) return false;
      } else {
        // Channel / Category filter
        if (selectedChannel === "unread") {
          if (m.status !== "unread") return false;
        } else if (selectedChannel === "pinned") {
          if (!m.isPinned) return false;
        } else if (selectedChannel === "sms") {
          if (m.messageType !== "sms") return false;
        } else if (selectedChannel === "email") {
          if (m.messageType !== "email") return false;
        } else if (selectedChannel === "escrow") {
          if (m.channel !== "escrow" && m.messageType !== "escrow_note") return false;
        } else if (selectedChannel === "alerts") {
          if (m.messageType !== "deal_alert" && m.messageType !== "system") return false;
        } else if (selectedChannel !== "all") {
          if (m.channel !== selectedChannel) return false;
        }
      }

      // Type Filter
      if (typeFilter !== "all" && m.messageType !== typeFilter) {
        return false;
      }

      // Direction Filter
      if (directionFilter !== "all" && m.direction !== directionFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mBody = m.body.toLowerCase().includes(q);
        const mSubject = m.subject?.toLowerCase().includes(q);
        const mSender = m.senderName.toLowerCase().includes(q);
        const mRecipient = m.recipientName?.toLowerCase().includes(q);
        const mAddr = m.propertyAddress?.toLowerCase().includes(q);
        const mPhone = m.contactPhone?.toLowerCase().includes(q);
        const mEmail = m.contactEmail?.toLowerCase().includes(q);
        if (!mBody && !mSubject && !mSender && !mRecipient && !mAddr && !mPhone && !mEmail) {
          return false;
        }
      }

      return true;
    });
  }, [messages, selectedChannel, selectedDmUser, currentUserId, members, typeFilter, directionFilter, searchQuery]);

  // Statistics KPI computation
  const stats = useMemo(() => {
    const total = messages.length;
    const teamChat = messages.filter((m) => m.messageType === "chat").length;
    const smsCount = messages.filter((m) => m.messageType === "sms").length;
    const emailCount = messages.filter((m) => m.messageType === "email").length;
    const escrowNotes = messages.filter((m) => m.messageType === "escrow_note" || m.channel === "escrow").length;
    const unreadCount = messages.filter((m) => m.status === "unread").length;
    return { total, teamChat, smsCount, emailCount, escrowNotes, unreadCount };
  }, [messages]);

  // Handlers
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!composerBody.trim()) return;

    try {
      setSending(true);

      // Find matching client or transaction if address selected
      const matchedClient = clients.find((c) => c.companyName === composerAddress || c.address === composerAddress);
      const matchedTx = transactions.find((t) => t.propertyAddress === composerAddress);

      // Target recipient from DM or dropdown
      const targetMember = composerRecipient ? members.find((mem) => mem.name === composerRecipient) : null;
      const recipientId = selectedDmUser ? selectedDmUser.id : (targetMember ? targetMember.id : undefined);
      const recipientName = selectedDmUser ? selectedDmUser.name : (composerRecipient.trim() || undefined);

      const payload = {
        channel: selectedDmUser ? "direct" : composerChannel,
        body: composerBody.trim(),
        messageType: selectedDmUser ? ("chat" as const) : composerType,
        subject: composerSubject.trim() || undefined,
        recipientId,
        recipientName,
        propertyAddress: composerAddress.trim() || undefined,
        contactPhone: composerPhone.trim() || undefined,
        contactEmail: composerEmail.trim() || undefined,
        direction: composerDirection,
        clientId: matchedClient ? matchedClient.id : undefined,
        clientName: matchedClient ? (matchedClient.contactName || matchedClient.companyName) : undefined,
        transactionId: matchedTx ? matchedTx.id : undefined,
      };

      const res = await api.createMessage(payload);
      if (res.ok) {
        setMessages((prev) => [res.message, ...prev]);
        setComposerBody("");
        setComposerSubject("");
        showNotification("Message transmitted successfully!");
      }
    } catch (err: any) {
      showNotification(err?.message || "Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };

  const handleTogglePin = async (msg: InternalMessage) => {
    try {
      const nextPin = !msg.isPinned;
      const res = await api.updateMessage(msg.id, { isPinned: nextPin });
      if (res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? res.message : m)));
        showNotification(nextPin ? "Message pinned to top" : "Message unpinned");
      }
    } catch (err: any) {
      showNotification(err?.message || "Failed to update pin", "error");
    }
  };

  const handleToggleRead = async (msg: InternalMessage) => {
    try {
      const nextStatus = msg.status === "read" ? "unread" : "read";
      const res = await api.updateMessage(msg.id, { status: nextStatus });
      if (res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? res.message : m)));
      }
    } catch (err: any) {
      showNotification(err?.message || "Failed to update status", "error");
    }
  };

  const handleDelete = async (msg: InternalMessage) => {
    if (!window.confirm("Are you sure you want to delete this communication record?")) return;
    try {
      const res = await api.deleteMessage(msg.id);
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        if (selectedMessage?.id === msg.id) setSelectedMessage(null);
        showNotification("Message removed from ledger.");
      }
    } catch (err: any) {
      showNotification(err?.message || "Failed to delete message", "error");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await api.markAllMessagesRead();
      if (res.ok) {
        setMessages((prev) => prev.map((m) => ({ ...m, status: "read" })));
        showNotification("All communications marked as read.");
      }
    } catch (err: any) {
      showNotification(err?.message || "Failed to mark all as read", "error");
    }
  };

  const handleQuickReply = (msg: InternalMessage) => {
    setComposerChannel(msg.channel || "general");
    if (msg.messageType === "sms") {
      setComposerType("sms");
      setComposerDirection("outbound");
      setComposerRecipient(msg.senderName);
      setComposerPhone(msg.contactPhone || "");
    } else if (msg.messageType === "escrow_note") {
      setComposerType("escrow_note");
      setComposerChannel("escrow");
    } else {
      setComposerType("chat");
    }

    if (msg.propertyAddress) {
      setComposerAddress(msg.propertyAddress);
    }

    setComposerBody(`@${msg.senderName} `);
    if (isMobile) {
      setMobileTab("chat");
      setSelectedMessage(null);
    }
  };

  // Helper for role pill color
  const getRoleColor = (role: string, type: string) => {
    if (type === "deal_alert" || type === "system") return { bg: "rgba(6, 182, 212, 0.15)", text: "#06b6d4" };
    if (type === "escrow_note") return { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981" };
    if (role.toLowerCase().includes("underwriter")) return { bg: "rgba(168, 85, 247, 0.15)", text: "#a855f7" };
    if (role.toLowerCase().includes("homeowner") || role.toLowerCase().includes("seller")) return { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b" };
    if (role.toLowerCase().includes("buyer") || role.toLowerCase().includes("investor")) return { bg: "rgba(236, 72, 153, 0.15)", text: "#ec4899" };
    return { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6" };
  };

  // Helper for message type badge
  const getTypeBadge = (m: InternalMessage) => {
    switch (m.messageType) {
      case "sms":
        return m.direction === "inbound" ? { label: "Inbound SMS ↙", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" }
          : { label: "Outbound SMS ↗", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)" };
      case "email":
        return { label: "Outbound Email ↗", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)" };
      case "escrow_note":
        return { label: "🏛️ Escrow & Title Note", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" };
      case "deal_alert":
        return { label: "⚠️ Deal Alert", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" };
      case "system":
        return { label: "🤖 System Bot", color: "#06b6d4", bg: "rgba(6, 182, 212, 0.15)" };
      default:
        return { label: "💬 Team Chat", color: "var(--muted)", bg: "rgba(255, 255, 255, 0.05)" };
    }
  };

  // Format relative time / timestamp
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const now = new Date();
      const diffHrs = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
      if (diffHrs < 24 && now.getDate() === d.getDate()) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  const currentChannelMeta = CHANNELS.find((c) => c.id === selectedChannel) || CHANNELS[0];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? "12px" : "20px",
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        minHeight: isMobile ? "auto" : "calc(100vh - 120px)",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: isMobile ? "14px" : "24px",
            left: isMobile ? "14px" : undefined,
            zIndex: 9999,
            backgroundColor: notification.type === "error" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            padding: "12px 18px",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxSizing: "border-box",
          }}
        >
          <span>{notification.type === "error" ? "⚠️" : "✓"}</span>
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header Title & CRM Branding */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", width: "100%" }}>
        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: isMobile ? "22px" : "28px" }}>💬</span>
            <h1 style={{ margin: 0, fontSize: isMobile ? "20px" : "24px", fontWeight: 800, letterSpacing: "-0.5px" }}>
              Message Hub
            </h1>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span>🔒</span>
              <span>Internal CRM · {orgName}</span>
            </span>
          </div>
          <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: isMobile ? "12px" : "13px", lineHeight: "1.4" }}>
            Internal communications hub for <strong>{orgName}</strong> — private to your CRM members. All team messages, SMS threads, and notes are strictly isolated and never shared with other organizations.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
          {stats.unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              style={{
                padding: isMobile ? "7px 10px" : "8px 14px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--panel)",
                color: "var(--fg)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                flex: isMobile ? 1 : undefined,
              }}
              title="Mark all unread communications as read"
            >
              <span>✓✓</span>
              <span>Mark All Read ({stats.unreadCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            style={{
              padding: isMobile ? "7px 10px" : "8px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--panel)",
              color: "var(--fg)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              flex: isMobile ? 1 : undefined,
            }}
            title="Refresh message feed"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Mobile Top Navigation Segmented Pill (Switch between Chat Feed and Channels Sidebar) */}
      {isMobile && (
        <div
          style={{
            display: "flex",
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "4px",
            gap: "4px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: mobileTab === "chat" ? "var(--accent, #3b82f6)" : "transparent",
              color: mobileTab === "chat" ? "#ffffff" : "var(--fg)",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>💬</span>
            <span>Live Chat ({filteredMessages.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("channels")}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: mobileTab === "channels" ? "var(--accent, #3b82f6)" : "transparent",
              color: mobileTab === "channels" ? "#ffffff" : "var(--fg)",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>📁</span>
            <span>Channels &amp; DMs</span>
            {stats.unreadCount > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  padding: "1px 5px",
                  borderRadius: "10px",
                  backgroundColor: mobileTab === "channels" ? "rgba(255,255,255,0.3)" : "#ef4444",
                  color: "#ffffff",
                }}
              >
                {stats.unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* KPI Stats Ribbon */}
      <div
        style={{
          display: isMobile ? "flex" : "grid",
          gridTemplateColumns: isMobile ? undefined : "repeat(auto-fit, minmax(170px, 1fr))",
          overflowX: isMobile ? "auto" : undefined,
          WebkitOverflowScrolling: "touch",
          gap: isMobile ? "8px" : "12px",
          paddingBottom: isMobile ? "4px" : undefined,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)", borderRadius: "8px", padding: isMobile ? "10px 14px" : "14px 16px", flex: isMobile ? "0 0 150px" : undefined, minWidth: isMobile ? "150px" : undefined, boxSizing: "border-box" }}>
          <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Total Comms</div>
          <div style={{ fontSize: isMobile ? "18px" : "22px", fontWeight: 800, marginTop: "2px" }}>{stats.total}</div>
          <div style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "2px" }}>All channels combined</div>
        </div>

        <div style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)", borderRadius: "8px", padding: isMobile ? "10px 14px" : "14px 16px", flex: isMobile ? "0 0 150px" : undefined, minWidth: isMobile ? "150px" : undefined, boxSizing: "border-box" }}>
          <div style={{ fontSize: "11px", color: "#3b82f6", fontWeight: 700, textTransform: "uppercase" }}>Team Chat</div>
          <div style={{ fontSize: isMobile ? "18px" : "22px", fontWeight: 800, color: "#3b82f6", marginTop: "2px" }}>{stats.teamChat}</div>
          <div style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "2px" }}>Across 4 team channels</div>
        </div>

        <div style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)", borderRadius: "8px", padding: isMobile ? "10px 14px" : "14px 16px", flex: isMobile ? "0 0 150px" : undefined, minWidth: isMobile ? "150px" : undefined, boxSizing: "border-box" }}>
          <div style={{ fontSize: "11px", color: "#10b981", fontWeight: 700, textTransform: "uppercase" }}>Client SMS</div>
          <div style={{ fontSize: isMobile ? "18px" : "22px", fontWeight: 800, color: "#10b981", marginTop: "2px" }}>{stats.smsCount}</div>
          <div style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "2px" }}>In &amp; outbound texts</div>
        </div>

        <div style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)", borderRadius: "8px", padding: isMobile ? "10px 14px" : "14px 16px", flex: isMobile ? "0 0 150px" : undefined, minWidth: isMobile ? "150px" : undefined, boxSizing: "border-box" }}>
          <div style={{ fontSize: "11px", color: "#8b5cf6", fontWeight: 700, textTransform: "uppercase" }}>Emails &amp; Offers</div>
          <div style={{ fontSize: isMobile ? "18px" : "22px", fontWeight: 800, color: "#8b5cf6", marginTop: "2px" }}>{stats.emailCount}</div>
          <div style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "2px" }}>PSA &amp; LOI dispatches</div>
        </div>

        <div style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)", borderRadius: "8px", padding: isMobile ? "10px 14px" : "14px 16px", flex: isMobile ? "0 0 150px" : undefined, minWidth: isMobile ? "150px" : undefined, boxSizing: "border-box" }}>
          <div style={{ fontSize: "11px", color: "#10b981", fontWeight: 700, textTransform: "uppercase" }}>Escrow &amp; Title</div>
          <div style={{ fontSize: isMobile ? "18px" : "22px", fontWeight: 800, color: "#10b981", marginTop: "2px" }}>{stats.escrowNotes}</div>
          <div style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "2px" }}>Two-way coordination</div>
        </div>

        <div style={{ backgroundColor: "var(--panel)", border: "1px solid var(--border)", borderRadius: "8px", padding: isMobile ? "10px 14px" : "14px 16px", flex: isMobile ? "0 0 150px" : undefined, minWidth: isMobile ? "150px" : undefined, boxSizing: "border-box" }}>
          <div style={{ fontSize: "11px", color: stats.unreadCount > 0 ? "#f59e0b" : "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
            Attention
          </div>
          <div style={{ fontSize: isMobile ? "18px" : "22px", fontWeight: 800, color: stats.unreadCount > 0 ? "#f59e0b" : "var(--fg)", marginTop: "2px" }}>
            {stats.unreadCount}
          </div>
          <div style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "2px" }}>
            {stats.unreadCount > 0 ? "Requires review" : "All caught up"}
          </div>
        </div>
      </div>

      {/* Main Workspace Layout (Sidebar Channels + Center Feed + Right Context Drawer) */}
      <div
        style={{
          display: isMobile ? "flex" : "grid",
          flexDirection: isMobile ? "column" : undefined,
          gridTemplateColumns: isMobile ? undefined : selectedMessage ? "260px 1fr 340px" : "260px 1fr",
          gap: isMobile ? "12px" : "16px",
          alignItems: "stretch",
          minHeight: isMobile ? "auto" : "680px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Left Sidebar: Channels & Streams Navigation */}
        <div
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "16px 12px",
            display: isMobile && mobileTab !== "channels" ? "none" : "flex",
            flexDirection: "column",
            gap: "18px",
            height: isMobile ? "auto" : "100%",
            width: isMobile ? "100%" : undefined,
            boxSizing: "border-box",
          }}
        >
          {/* Mobile Back / View Chat Header */}
          {isMobile && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "10px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 700 }}>Select Stream or Member</span>
              <button
                type="button"
                onClick={() => setMobileTab("chat")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  backgroundColor: "var(--accent, #3b82f6)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>Live Feed</span>
                <span>&rarr;</span>
              </button>
            </div>
          )}

          {/* Section: Feeds */}
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", padding: "0 8px 6px" }}>
              Feeds &amp; Inboxes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {CHANNELS.filter((c) => c.category === "feed").map((ch) => {
                const isActive = selectedChannel === ch.id && !selectedDmUser;
                const count = ch.id === "unread" ? stats.unreadCount : ch.id === "pinned" ? messages.filter((m) => m.isPinned).length : stats.total;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setSelectedDmUser(null);
                      setSelectedChannel(ch.id);
                      if (isMobile) setMobileTab("chat");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      backgroundColor: isActive ? "var(--accent, #3b82f6)" : "transparent",
                      color: isActive ? "#ffffff" : "var(--fg)",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>{ch.icon}</span>
                      <span>{ch.name}</span>
                    </div>
                    {count > 0 && (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "1px 6px",
                          borderRadius: "10px",
                          backgroundColor: isActive ? "rgba(255, 255, 255, 0.25)" : "var(--border)",
                          color: isActive ? "#ffffff" : "var(--muted)",
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Team Channels */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                Team Channels
              </span>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>Internal</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {CHANNELS.filter((c) => c.category === "channels").map((ch) => {
                const isActive = selectedChannel === ch.id && !selectedDmUser;
                const chCount = messages.filter((m) => m.channel === ch.id).length;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setSelectedDmUser(null);
                      setSelectedChannel(ch.id);
                      setComposerChannel(ch.id);
                      setComposerType("chat");
                      if (isMobile) setMobileTab("chat");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      backgroundColor: isActive ? "var(--accent, #3b82f6)" : "transparent",
                      color: isActive ? "#ffffff" : "var(--fg)",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: isActive ? "#ffffff" : "var(--muted)", fontWeight: 700 }}>#</span>
                      <span>{ch.name}</span>
                    </div>
                    {chCount > 0 && (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "1px 6px",
                          borderRadius: "10px",
                          backgroundColor: isActive ? "rgba(255, 255, 255, 0.25)" : "var(--border)",
                          color: isActive ? "#ffffff" : "var(--muted)",
                        }}
                      >
                        {chCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Direct Messages (Internal CRM Team Members) */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                Direct Messages
              </span>
              <span style={{ fontSize: "10px", color: "#10b981", fontWeight: 700 }}>🔒 Team Only</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {members.length === 0 ? (
                <div style={{ padding: "8px 10px", fontSize: "11px", color: "var(--muted)" }}>
                  No team members loaded.
                </div>
              ) : (
                members.map((member) => {
                  const isSelected = selectedDmUser?.id === member.id;
                  const isYou = member.id === currentUserId;
                  const dmUnreadCount = messages.filter(
                    (m) =>
                      m.status === "unread" &&
                      ((m.senderId === member.id && m.recipientId === currentUserId) ||
                        (m.senderName.toLowerCase() === member.name.toLowerCase() &&
                          m.recipientName?.toLowerCase() === members.find((u) => u.id === currentUserId)?.name.toLowerCase()))
                  ).length;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setSelectedDmUser(member);
                        setSelectedChannel("all");
                        setComposerType("chat");
                        setComposerRecipient(member.name);
                        if (isMobile) setMobileTab("chat");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        backgroundColor: isSelected ? "var(--accent, #3b82f6)" : "transparent",
                        color: isSelected ? "#ffffff" : "var(--fg)",
                        border: "none",
                        fontSize: "13px",
                        fontWeight: isSelected ? 700 : 500,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: isYou ? "#3b82f6" : "#10b981",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                          {member.name} {isYou && <span style={{ fontSize: "10px", opacity: 0.8 }}>(You)</span>}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            color: isSelected ? "rgba(255,255,255,0.8)" : "var(--muted)",
                            maxWidth: "70px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {member.role === "Admin / Principal" ? "Admin" : member.role}
                        </span>
                        {dmUnreadCount > 0 && (
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "1px 5px",
                              borderRadius: "10px",
                              backgroundColor: "#ef4444",
                              color: "#ffffff",
                              fontWeight: 700,
                            }}
                          >
                            {dmUnreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Section: External Channels */}
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", padding: "0 8px 6px" }}>
              Client &amp; Closing Streams
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {CHANNELS.filter((c) => c.category === "external").map((ch) => {
                const isActive = selectedChannel === ch.id && !selectedDmUser;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setSelectedDmUser(null);
                      setSelectedChannel(ch.id);
                      if (isMobile) setMobileTab("chat");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      backgroundColor: isActive ? "var(--accent, #3b82f6)" : "transparent",
                      color: isActive ? "#ffffff" : "var(--fg)",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>{ch.icon}</span>
                      <span>{ch.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Subscriber Team Roster & Privacy Guarantee */}
          <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", padding: "0 8px 4px" }}>
              Active Team Roster ({members.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "0 8px", fontSize: "12px", maxHeight: "140px", overflowY: "auto" }}>
              {members.length > 0 ? (
                members.map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: u.id === currentUserId ? "#3b82f6" : "#10b981", flexShrink: 0 }} />
                    <span style={{ fontWeight: u.id === currentUserId ? 600 : 400 }}>{u.name} {u.id === currentUserId ? "(You)" : ""}</span>
                    <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--muted)" }}>{u.role === "Admin / Principal" ? "Admin" : u.role}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: "var(--muted)", fontSize: "11px" }}>1 Member Active</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#06b6d4", flexShrink: 0 }} />
                <span>Revzenta Deal Bot</span>
                <span style={{ marginLeft: "auto", fontSize: "10px", color: "#06b6d4" }}>AI Bot</span>
              </div>
            </div>

            {/* Privacy & Isolation Callout */}
            <div
              style={{
                marginTop: "4px",
                padding: "10px",
                borderRadius: "6px",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                fontSize: "11px",
              }}
            >
              <div style={{ fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <span>🔒</span>
                <span>Data Isolation Guarantee</span>
              </div>
              <div style={{ color: "var(--muted)", lineHeight: "1.4" }}>
                Scoped strictly to <strong>{orgName}</strong>. Outside subscribers cannot view or intercept team communications.
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Communication Stream & Chat Window */}
        <div
          style={{
            backgroundColor: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            display: isMobile && mobileTab !== "chat" ? "none" : "flex",
            flexDirection: "column",
            overflow: "hidden",
            height: "100%",
            width: isMobile ? "100%" : undefined,
            boxSizing: "border-box",
            minWidth: 0,
          }}
        >
          {/* Top Channel Bar & Filters */}
          <div
            style={{
              padding: isMobile ? "10px 12px" : "14px 18px",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--bg-soft, rgba(0,0,0,0.02))",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "8px" : "12px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {/* Mobile Back Button to Channels */}
            {isMobile && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setMobileTab("channels")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--panel)",
                    color: "var(--fg)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <span>&larr;</span>
                  <span>Channels &amp; Streams</span>
                </button>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {filteredMessages.length} comms
                </span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: "1 1 auto" }}>
                <span style={{ fontSize: isMobile ? "18px" : "20px" }}>{selectedDmUser ? "👤" : currentChannelMeta.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: isMobile ? "15px" : "16px", fontWeight: 700 }}>
                      {selectedDmUser ? `Direct Message: ${selectedDmUser.name}` : currentChannelMeta.name}
                    </h3>
                    {selectedDmUser && (
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "1px 6px",
                          borderRadius: "10px",
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          color: "#10b981",
                          fontWeight: 700,
                        }}
                      >
                        🔒 Private Team Chat
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "nowrap" : "normal" }}>
                    {selectedDmUser
                      ? `1-on-1 private internal conversation with ${selectedDmUser.name} (${selectedDmUser.role}) · End-to-end isolated to ${orgName}`
                      : currentChannelMeta.description}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {selectedDmUser && (
                  <button
                    type="button"
                    onClick={() => setSelectedDmUser(null)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--panel)",
                      color: "var(--fg)",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✕ Return to Channels
                  </button>
                )}
                {!isMobile && (
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Showing <strong>{filteredMessages.length}</strong> communication{filteredMessages.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", width: "100%", boxSizing: "border-box" }}>
              <input
                type="text"
                placeholder="Search messages, address, sender..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--input-bg, var(--panel))",
                  color: "var(--fg)",
                  fontSize: "12px",
                  flex: isMobile ? "1 1 100%" : "1 1 200px",
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              />

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--input-bg, var(--panel))",
                  color: "var(--fg)",
                  fontSize: "12px",
                  flex: isMobile ? "1 1 calc(50% - 4px)" : undefined,
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <option value="all">All Message Types</option>
                <option value="chat">💬 Internal Chat</option>
                <option value="sms">📱 SMS Text Messages</option>
                <option value="email">✉️ Emails &amp; Dispatches</option>
                <option value="escrow_note">🏛️ Escrow &amp; Title Notes</option>
                <option value="deal_alert">⚠️ Deal Alerts</option>
              </select>

              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--input-bg, var(--panel))",
                  color: "var(--fg)",
                  fontSize: "12px",
                  flex: isMobile ? "1 1 calc(50% - 4px)" : undefined,
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <option value="all">All Directions</option>
                <option value="internal">Internal Team</option>
                <option value="inbound">Inbound ↙ (from Client)</option>
                <option value="outbound">Outbound ↗ (to Client)</option>
              </select>

              {(searchQuery || typeFilter !== "all" || directionFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setTypeFilter("all");
                    setDirectionFilter("all");
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "transparent",
                    color: "var(--muted)",
                    fontSize: "11px",
                    cursor: "pointer",
                    flex: isMobile ? "1 1 100%" : undefined,
                    textAlign: "center",
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Messages Scrollable Feed */}
          <div
            style={{
              flex: "1 1 auto",
              overflowY: "auto",
              padding: isMobile ? "12px 10px" : "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxHeight: isMobile ? "calc(100vh - 350px)" : "calc(100vh - 460px)",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {loading ? (
              <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px" }}>
                Loading CRM communication ledger...
              </div>
            ) : filteredMessages.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 24px",
                  border: "1px dashed var(--border)",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg-soft, rgba(0,0,0,0.01))",
                }}
              >
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>💬</div>
                <h4 style={{ margin: "0 0 6px 0" }}>No communications in this view</h4>
                <p style={{ color: "var(--muted)", fontSize: "13px", margin: 0 }}>
                  Post an internal team note, send an SMS to a homeowner, or clear your active search filter.
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const typeInfo = getTypeBadge(msg);
                const roleColor = getRoleColor(msg.senderRole, msg.messageType);
                const isSelected = selectedMessage?.id === msg.id;

                return (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      padding: "14px 16px",
                      borderRadius: "8px",
                      backgroundColor: isSelected
                        ? "rgba(59, 130, 246, 0.08)"
                        : msg.isPinned
                        ? "rgba(245, 158, 11, 0.04)"
                        : "var(--bg-soft, rgba(0,0,0,0.02))",
                      border: isSelected
                        ? "1px solid var(--accent, #3b82f6)"
                        : msg.isPinned
                        ? "1px solid rgba(245, 158, 11, 0.4)"
                        : "1px solid var(--border)",
                      transition: "all 0.15s ease",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    {/* Header Row: Sender, Role, Type Badge, Channel, Timestamp */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        {/* Avatar */}
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            backgroundColor: roleColor.text,
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {msg.senderName.charAt(0).toUpperCase()}
                        </div>

                        {/* Sender Name */}
                        <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--fg)" }}>
                          {msg.senderName}
                        </span>

                        {/* Role Badge */}
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: roleColor.bg,
                            color: roleColor.text,
                          }}
                        >
                          {msg.senderRole}
                        </span>

                        {/* Message Type Badge */}
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: "4px",
                            backgroundColor: typeInfo.bg,
                            color: typeInfo.color,
                          }}
                        >
                          {typeInfo.label}
                        </span>

                        {/* Channel Badge */}
                        <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                          #{msg.channel}
                        </span>
                      </div>

                      {/* Right Meta: Pinned status, timestamp, card actions */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {msg.isPinned && (
                          <span style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 700 }} title="Pinned communication">
                            📌 Pinned
                          </span>
                        )}

                        {msg.status === "unread" && (
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: "#3b82f6",
                            }}
                            title="Unread"
                          />
                        )}

                        <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Subject Line (if any) */}
                    {msg.subject && (
                      <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--fg)" }}>
                        {msg.subject}
                      </div>
                    )}

                    {/* Message Body */}
                    <div
                      style={{
                        fontSize: "13px",
                        lineHeight: "1.5",
                        color: "var(--fg)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.body}
                    </div>

                    {/* Deal & Contact Tags Footer */}
                    {(msg.propertyAddress || msg.contactPhone || msg.contactEmail || msg.recipientName) && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                          alignItems: "center",
                          marginTop: "4px",
                          paddingTop: "6px",
                          borderTop: "1px dashed var(--border)",
                          fontSize: "11px",
                        }}
                      >
                        {msg.propertyAddress && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToProperty?.(msg.propertyAddress!);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(59, 130, 246, 0.1)",
                              color: "#3b82f6",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            title="Click to view property in CRM"
                          >
                            📍 {msg.propertyAddress}
                          </span>
                        )}

                        {msg.recipientName && (
                          <span style={{ color: "var(--muted)" }}>
                            To: <strong style={{ color: "var(--fg)" }}>{msg.recipientName}</strong>
                          </span>
                        )}

                        {msg.contactPhone && (
                          <span style={{ color: "var(--muted)" }}>
                            📞 {msg.contactPhone}
                          </span>
                        )}

                        {msg.contactEmail && (
                          <span style={{ color: "var(--muted)" }}>
                            ✉️ {msg.contactEmail}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Interactive Actions Toolbar */}
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap",
                        justifyContent: isMobile ? "flex-start" : "flex-end",
                        marginTop: "4px",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleQuickReply(msg)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "4px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--panel)",
                          color: "var(--fg)",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        title="Quick reply in composer"
                      >
                        💬 Reply
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTogglePin(msg)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "4px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--panel)",
                          color: msg.isPinned ? "#f59e0b" : "var(--muted)",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                        title={msg.isPinned ? "Unpin message" : "Pin message to top"}
                      >
                        {msg.isPinned ? "★ Pinned" : "☆ Pin"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleRead(msg)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "4px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--panel)",
                          color: "var(--muted)",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                        title={msg.status === "read" ? "Mark as unread" : "Mark as read"}
                      >
                        {msg.status === "read" ? "Mark Unread" : "✓ Read"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.body);
                          showNotification("Copied message text to clipboard!");
                        }}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "4px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--panel)",
                          color: "var(--muted)",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                        title="Copy text"
                      >
                        📋 Copy
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(msg)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "4px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--panel)",
                          color: "#ef4444",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                        title="Delete communication record"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Integrated Bottom Composer */}
          <div
            style={{
              padding: isMobile ? "10px 12px" : "14px 18px",
              borderTop: "1px solid var(--border)",
              backgroundColor: "var(--bg-soft, rgba(0,0,0,0.02))",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {/* Quick Template Selector & Emojis */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexWrap: isMobile ? "nowrap" : "wrap",
                  overflowX: isMobile ? "auto" : undefined,
                  WebkitOverflowScrolling: "touch",
                  width: isMobile ? "100%" : "auto",
                  paddingBottom: isMobile ? "4px" : undefined,
                }}
              >
                <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, alignSelf: "center", whiteSpace: "nowrap" }}>Templates:</span>
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.label}
                    type="button"
                    onClick={() => setComposerBody((prev) => (prev ? `${prev}\n${tmpl.text}` : tmpl.text))}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--panel)",
                      color: "var(--fg)",
                      fontSize: "11px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>

              {/* Emoji quick bar */}
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  overflowX: isMobile ? "auto" : undefined,
                  WebkitOverflowScrolling: "touch",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                {EMOJIS.slice(0, isMobile ? 8 : 7).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setComposerBody((prev) => `${prev} ${emoji}`)}
                    style={{
                      padding: "2px 6px",
                      borderRadius: "4px",
                      border: "none",
                      backgroundColor: "transparent",
                      fontSize: "13px",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    title={`Add ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Composer Targeting Controls */}
            {selectedDmUser ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(59, 130, 246, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  fontSize: "12px",
                  flexWrap: "wrap",
                  gap: "6px",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: "1 1 auto" }}>
                  <span>🔒</span>
                  <span style={{ fontSize: "11.5px" }}>
                    Sending to <strong>{selectedDmUser.name}</strong> ({selectedDmUser.role}) — <em>Private to {orgName}</em>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDmUser(null)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    backgroundColor: "transparent",
                    color: "#3b82f6",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  ✕ Switch to Channel
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", width: "100%", boxSizing: "border-box" }}>
                <select
                  value={composerChannel}
                  onChange={(e) => setComposerChannel(e.target.value)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--panel)",
                    color: "var(--fg)",
                    fontSize: "12px",
                    fontWeight: 600,
                    flex: isMobile ? "1 1 calc(50% - 4px)" : undefined,
                    minWidth: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <option value="general"># general</option>
                  <option value="acquisitions"># acquisitions</option>
                  <option value="underwriting"># underwriting</option>
                  <option value="escrow"># escrow</option>
                </select>

                <select
                  value={composerType}
                  onChange={(e) => setComposerType(e.target.value as any)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--panel)",
                    color: "var(--fg)",
                    fontSize: "12px",
                    flex: isMobile ? "1 1 calc(50% - 4px)" : undefined,
                    minWidth: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <option value="chat">💬 Internal Chat</option>
                  <option value="sms">📱 Outbound SMS</option>
                  <option value="email">✉️ Formal Email</option>
                  <option value="escrow_note">🏛️ Legal Escrow Note</option>
                  <option value="deal_alert">⚠️ Deal Alert</option>
                </select>

                {/* Direct to Internal Team Member */}
                <select
                  value={composerRecipient}
                  onChange={(e) => setComposerRecipient(e.target.value)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--panel)",
                    color: "var(--fg)",
                    fontSize: "12px",
                    maxWidth: isMobile ? "none" : "180px",
                    flex: isMobile ? "1 1 calc(50% - 4px)" : undefined,
                    minWidth: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">Direct / Mention...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.name}>
                      👤 {m.name} {m.id === currentUserId ? "(You)" : ""}
                    </option>
                  ))}
                </select>

                {/* Quick Tag Deal / Property */}
                <select
                  value={composerAddress}
                  onChange={(e) => setComposerAddress(e.target.value)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--panel)",
                    color: "var(--fg)",
                    fontSize: "12px",
                    maxWidth: isMobile ? "none" : "200px",
                    flex: isMobile ? "1 1 calc(50% - 4px)" : undefined,
                    minWidth: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">Attach Property / Deal...</option>
                  {transactions.map((tx) => (
                    <option key={tx.id} value={tx.propertyAddress}>
                      {tx.propertyAddress} (${tx.purchasePrice.toLocaleString()})
                    </option>
                  ))}
                  {clients.filter((c) => c.companyName && !transactions.some((t) => t.propertyAddress === c.companyName)).map((c) => (
                    <option key={c.id} value={c.companyName}>
                      {c.companyName} ({c.stage})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Input Box & Send Button */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: isMobile ? "stretch" : "flex-end",
                flexDirection: isMobile ? "column" : "row",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <textarea
                placeholder={
                  selectedDmUser
                    ? `Message ${selectedDmUser.name} privately...`
                    : composerType === "sms"
                    ? "Type SMS text message to send..."
                    : composerType === "escrow_note"
                    ? "Type two-way note to title company..."
                    : `Message #${composerChannel}...`
                }
                value={composerBody}
                onChange={(e) => setComposerBody(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={isMobile ? 2 : 2}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--input-bg, var(--panel))",
                  color: "var(--fg)",
                  fontSize: "13px",
                  resize: "none",
                  outline: "none",
                  fontFamily: "inherit",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={sending || !composerBody.trim()}
                style={{
                  padding: "10px 18px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--accent, #3b82f6)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: sending || !composerBody.trim() ? "not-allowed" : "pointer",
                  opacity: sending || !composerBody.trim() ? 0.6 : 1,
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  height: "44px",
                  width: isMobile ? "100%" : "auto",
                  boxSizing: "border-box",
                }}
              >
                <span>{sending ? "Sending..." : "Transmit"}</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Drawer: Selected Deal & Contact Context Panel */}
        {selectedMessage && (
          isMobile ? (
            /* Mobile Modal Drawer Overlay */
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.65)",
                backdropFilter: "blur(3px)",
                zIndex: 9999,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                padding: "12px",
                boxSizing: "border-box",
              }}
              onClick={() => setSelectedMessage(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "18px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  width: "100%",
                  maxWidth: "480px",
                  maxHeight: "85vh",
                  overflowY: "auto",
                  boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--fg)" }}>
                    Communication Context
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      fontSize: "18px",
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Message Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Sender:</span>{" "}
                    <strong>{selectedMessage.senderName}</strong> ({selectedMessage.senderRole})
                  </div>
                  {selectedMessage.recipientName && (
                    <div>
                      <span style={{ color: "var(--muted)" }}>Recipient:</span>{" "}
                      <strong>{selectedMessage.recipientName}</strong>
                    </div>
                  )}
                  <div>
                    <span style={{ color: "var(--muted)" }}>Channel:</span>{" "}
                    <strong>#{selectedMessage.channel}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Type:</span>{" "}
                    <strong>{selectedMessage.messageType}</strong> ({selectedMessage.direction})
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Sent:</span>{" "}
                    <strong>{new Date(selectedMessage.createdAt).toLocaleString()}</strong>
                  </div>
                </div>

                {/* Linked Property Card */}
                {selectedMessage.propertyAddress && (
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      backgroundColor: "var(--bg-soft, rgba(0,0,0,0.03))",
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--accent, #3b82f6)" }}>
                      Linked Property Deal
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--fg)" }}>
                      {selectedMessage.propertyAddress}
                    </div>

                    {(() => {
                      const tx = transactions.find((t) => t.propertyAddress === selectedMessage.propertyAddress);
                      if (tx) {
                        return (
                          <div style={{ fontSize: "11.5px", color: "var(--muted)", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div>Purchase Price: <strong style={{ color: "var(--fg)" }}>${tx.purchasePrice.toLocaleString()}</strong></div>
                            {tx.assignmentFee > 0 && (
                              <div>Assignment Fee: <strong style={{ color: "#a855f7" }}>${tx.assignmentFee.toLocaleString()}</strong></div>
                            )}
                            <div>Status: <strong style={{ textTransform: "uppercase" }}>{tx.status}</strong></div>
                            <div>Title Company: <strong>{tx.titleCompanyName || "Escrow"}</strong></div>
                            {onNavigateToTransaction && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMessage(null);
                                  onNavigateToTransaction(tx.id);
                                }}
                                style={{
                                  marginTop: "6px",
                                  padding: "7px 10px",
                                  borderRadius: "4px",
                                  backgroundColor: "var(--accent, #3b82f6)",
                                  color: "#ffffff",
                                  border: "none",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  width: "100%",
                                  textAlign: "center",
                                }}
                              >
                                Open in Title Hub &rarr;
                              </button>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          Property lead active in CRM pipeline.
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Quick Actions in Context */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
                  <button
                    type="button"
                    onClick={() => handleQuickReply(selectedMessage)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--accent, #3b82f6)",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    💬 Pre-fill Reply in Composer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePin(selectedMessage)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--panel)",
                      border: "1px solid var(--border)",
                      color: selectedMessage.isPinned ? "#f59e0b" : "var(--fg)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    {selectedMessage.isPinned ? "★ Unpin Message" : "☆ Pin Message"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      backgroundColor: "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                      fontSize: "12px",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Desktop 3rd Column */
            <div
              style={{
                backgroundColor: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                height: "100%",
                overflowY: "auto",
                boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fg)" }}>
                  Communication Context
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--muted)",
                    fontSize: "16px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Message Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                <div>
                  <span style={{ color: "var(--muted)" }}>Sender:</span>{" "}
                  <strong>{selectedMessage.senderName}</strong> ({selectedMessage.senderRole})
                </div>
                {selectedMessage.recipientName && (
                  <div>
                    <span style={{ color: "var(--muted)" }}>Recipient:</span>{" "}
                    <strong>{selectedMessage.recipientName}</strong>
                  </div>
                )}
                <div>
                  <span style={{ color: "var(--muted)" }}>Channel:</span>{" "}
                  <strong>#{selectedMessage.channel}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Type:</span>{" "}
                  <strong>{selectedMessage.messageType}</strong> ({selectedMessage.direction})
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Sent:</span>{" "}
                  <strong>{new Date(selectedMessage.createdAt).toLocaleString()}</strong>
                </div>
              </div>

              {/* Linked Property Card */}
              {selectedMessage.propertyAddress && (
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "8px",
                    backgroundColor: "var(--bg-soft, rgba(0,0,0,0.03))",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--accent, #3b82f6)" }}>
                    Linked Property Deal
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--fg)" }}>
                    {selectedMessage.propertyAddress}
                  </div>

                  {(() => {
                    const tx = transactions.find((t) => t.propertyAddress === selectedMessage.propertyAddress);
                    if (tx) {
                      return (
                        <div style={{ fontSize: "11.5px", color: "var(--muted)", display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div>Purchase Price: <strong style={{ color: "var(--fg)" }}>${tx.purchasePrice.toLocaleString()}</strong></div>
                          {tx.assignmentFee > 0 && (
                            <div>Assignment Fee: <strong style={{ color: "#a855f7" }}>${tx.assignmentFee.toLocaleString()}</strong></div>
                          )}
                          <div>Status: <strong style={{ textTransform: "uppercase" }}>{tx.status}</strong></div>
                          <div>Title Company: <strong>{tx.titleCompanyName || "Escrow"}</strong></div>
                          {onNavigateToTransaction && (
                            <button
                              type="button"
                              onClick={() => onNavigateToTransaction(tx.id)}
                              style={{
                                marginTop: "6px",
                                padding: "6px 10px",
                                borderRadius: "4px",
                                backgroundColor: "var(--accent, #3b82f6)",
                                color: "#ffffff",
                                border: "none",
                                fontSize: "11.5px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Open in Title Hub &rarr;
                            </button>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                        Property lead active in CRM pipeline.
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Quick Actions in Context */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => handleQuickReply(selectedMessage)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--panel)",
                    border: "1px solid var(--border)",
                    color: "var(--fg)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  💬 Pre-fill Reply in Composer
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePin(selectedMessage)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--panel)",
                    border: "1px solid var(--border)",
                    color: selectedMessage.isPinned ? "#f59e0b" : "var(--fg)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {selectedMessage.isPinned ? "★ Unpin Message" : "☆ Pin Message"}
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
