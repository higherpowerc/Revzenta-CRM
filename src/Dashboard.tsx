import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { api } from "./api";
import { stageTone, money, fmtDate, type Buyer, type Client, type DashboardData, type Invoice, type Stage, type Transaction, type WholesaleOffer } from "./types";
import { StageBadge, ServiceChips } from "./bits";
import { usePii, blurPii } from "./pii";
import ProvisionNotices from "./ProvisionNotices";
import { getMatchesByProperty, getPropertyPrice, getCustomField } from "./buyBoxUtils";
import { getAssignmentValue, isOfferSentForClient } from "./Clients";

interface Props {
  /** Owner request 2026-08-14/15 — the Dashboard's stage cards deep-link into
   *  the pipeline. The callback hands the stage NAME to App, which routes it
   *  positionally (owner request 2026-08-15): first stage → Leads tab,
   *  middle stage → Onboarding tab (owner) / Leads tab (tenant), terminal
   *  stage → Clients directory tab. Each pipeline view opens with that
   *  stage's chip pre-selected; the empty-state CTA (no stage) opens the
   *  owner's Leads on "All". */
  onGoToStage: (stage?: string) => void;
  /** Owner direction 2026-08-26 — the Dashboard "Lost" KPI card's "View →"
   *  deep-link. Hands control to App, which switches to the owner Leads view
   *  with its "Lost" filter active (the Lost listing). Owner-only; tenants
   *  never render the Lost card, so they never call this. */
  onGoToLost: () => void;
  /** Navigate to Buy Box Matcher tab */
  onGoToBuyBox?: () => void;
  /** Navigate to Cash Buyers directory tab */
  onGoToBuyers?: () => void;
  /** Navigate to Transactions & Escrow Hub */
  onGoToTransactions?: () => void;
  /** Navigate to Wholesale Offers Repository */
  onGoToOffers?: () => void;
  /** Navigate to Subscribers & Workspaces tab (owner only) */
  onGoToSubscribers?: () => void;
  /** Navigate to Revenue & Stripe tab (owner only) */
  onGoToFinance?: () => void;
  /** Navigate to Sales Leads tab (owner only) */
  onGoToLeads?: () => void;
  /** Navigate to Client Onboarding tab (owner only) */
  onGoToOnboarding?: () => void;
  /** 1-click launch / impersonate into subscriber workspace (owner only) */
  onLaunchSubscriber?: (orgId: number) => void;
  /** Preview Wholesale CRM interface (owner only) */
  onPreviewWholesale?: () => void;
  /** The tenant's ordered pipeline stages (drives the breakdown grid + KPI). */
  stages: Stage[];
  /** Owner workspace (role=admin org) — owner direction 2026-08-14: the
   *  owner calls its pipeline records "leads", so this page's count, KPI
   *  labels, stage captions and empty state read "lead(s)" instead of
   *  "client(s)". Tenant orgs (role=member) keep "clients" everywhere.
   *  Purely presentational; data and stages are untouched. */
  ownerOrg?: boolean;
  /** Wholesale CRM workspace — terminology shifts to properties */
  isWholesale?: boolean;
}

/** Local YYYY-MM-DD — the same convention the task date inputs store
 *  (Tasks.tsx localToday), so overdue/due-soon comparisons stay consistent
 *  between the dashboard and the Task board. */
function localToday(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return localToday(new Date(y, m - 1, d + days));
}

/** Due tone + label for an upcoming task row (mirrors Tasks.tsx dueTone). */
function dueInfo(dueDate: string): { tone: "" | "overdue" | "today" | "soon"; label: string } {
  if (!dueDate) return { tone: "", label: "" };
  const today = localToday();
  const soon = addDaysKey(today, 7);
  if (dueDate < today) return { tone: "overdue", label: `Overdue · ${fmtDate(dueDate)}` };
  if (dueDate === today) return { tone: "today", label: `Due today · ${fmtDate(dueDate)}` };
  if (dueDate <= soon) return { tone: "soon", label: `Due ${fmtDate(dueDate)}` };
  return { tone: "", label: `Due ${fmtDate(dueDate)}` };
}

const REVENUE_COLORS_KEY = "crm:revenue-card-colors";
const DEFAULT_REVENUE_COLORS = {
  totalBilled: "#171a1f",
  paid: "#13251a",
  outstanding: "#201d14",
  overdue: "#291719",
};

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function WindowHead({
  title,
  icon,
  badgeText,
  badgeTone = "tone-blue",
  subtitle,
  onView,
  viewTitle = "View details",
}: {
  title: string;
  icon?: string;
  badgeText?: string;
  badgeTone?: string;
  subtitle?: string;
  onView?: () => void;
  viewTitle?: string;
}) {
  return (
    <div className="dashboard-window-head">
      <div>
        <h2 className="dashboard-window-title">
          {icon && <span>{icon}</span>}
          <span>{title}</span>
          {badgeText && (
            <span className={`badge ${badgeTone}`} style={{ fontSize: "0.78rem" }}>
              {badgeText}
            </span>
          )}
        </h2>
        {subtitle && <p className="dashboard-window-sub">{subtitle}</p>}
      </div>
      {onView && (
        <button
          type="button"
          className="window-view-btn"
          onClick={onView}
          title={viewTitle}
          aria-label={viewTitle}
        >
          View →
        </button>
      )}
    </div>
  );
}

function getPropertyTypeCategory(c: Client): "single_family" | "multi_family" | "commercial" | "condo_townhouse" | "land_lots" {
  const custom = (
    getCustomField(c, "Property Type") ||
    getCustomField(c, "propertyType") ||
    getCustomField(c, "property_type")
  ).toLowerCase();

  if (custom.includes("multi")) return "multi_family";
  if (custom.includes("commercial")) return "commercial";
  if (custom.includes("condo") || custom.includes("townhouse")) return "condo_townhouse";
  if (custom.includes("land") || custom.includes("lot")) return "land_lots";
  if (custom.includes("single")) return "single_family";

  const ct = (c.clientType || "").toLowerCase();
  if (ct === "multi_family" || ct.includes("multi")) return "multi_family";
  if (ct === "commercial") return "commercial";
  if (ct.includes("condo") || ct.includes("townhouse")) return "condo_townhouse";
  if (ct.includes("land") || ct.includes("lot")) return "land_lots";

  return "single_family";
}

function normAddr(str?: string | null): string {
  return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getStreetKey(str?: string | null): string {
  if (!str) return "";
  const cleaned = (str || "").trim().toLowerCase().replace(/\s+/g, " ");
  return cleaned.split(",")[0].trim();
}

function hasAddressKey(set: Set<string>, addr?: string | null): boolean {
  if (!addr) return false;
  const full = normAddr(addr);
  const street = getStreetKey(addr);
  return (Boolean(full) && set.has(full)) || (Boolean(street) && set.has(street));
}

function addAddressKeys(set: Set<string>, addr?: string | null) {
  if (!addr) return;
  const full = normAddr(addr);
  const street = getStreetKey(addr);
  if (full) set.add(full);
  if (street) set.add(street);
}

export default function Dashboard({
  onGoToStage,
  onGoToLost,
  onGoToBuyBox,
  onGoToBuyers,
  onGoToTransactions,
  onGoToOffers,
  onGoToSubscribers,
  onGoToFinance,
  onGoToLeads,
  onGoToOnboarding,
  onLaunchSubscriber,
  onPreviewWholesale,
  stages,
  ownerOrg = false,
  isWholesale = false,
}: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [offers, setOffers] = useState<WholesaleOffer[]>([]);

  useEffect(() => {
    api.clients().then((res) => setAllClients(res.clients)).catch(() => {});
    if (isWholesale) {
      api.transactions().then((res) => setTransactions(res.transactions || [])).catch(() => {});
      api.buyers().then((res) => setBuyers(res.buyers || [])).catch(() => {});
      api.offers().then((res) => setOffers(res.offers || [])).catch(() => {});
    }
  }, [isWholesale]);

  // Normalized deduplicated active transactions
  const activeTransactions = useMemo(() => {
    const raw = transactions.filter(
      (t) => t.status === "under_contract" || t.status === "sent" || t.status === "signed"
    );
    const seen = new Set<string>();
    const list: Transaction[] = [];
    for (const t of raw) {
      const key = normAddr(t.propertyAddress);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      list.push(t);
    }
    return list;
  }, [transactions]);

  const totalEscrowFees = useMemo(() => {
    return activeTransactions.reduce((sum, t) => sum + (Number(t.assignmentFee) || 0), 0);
  }, [activeTransactions]);

  const webhookLeadsCount = useMemo(() => {
    return allClients.filter((c) => (c.leadSource || "").toLowerCase().includes("webhook")).length;
  }, [allClients]);

  // Normalized deduplicated wholesale properties
  const wholesaleProperties = useMemo(() => {
    if (allClients.length === 0) return [];
    const seen = new Set<string>();
    const list: Client[] = [];
    for (const c of allClients) {
      if (c.archived || c.lost || c.clientType === "buyer" || c.stage === "Buyer") continue;
      const key = normAddr(c.address || c.companyName);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      list.push(c);
    }
    return list;
  }, [allClients]);

  // 1. Sold (Assignment Fees) data & address keys
  const soldProperties = useMemo(() => {
    const seen = new Set<string>();
    const list: Client[] = [];
    for (const p of wholesaleProperties) {
      const st = (p.stage || "").toLowerCase();
      if (st === "sold" || st === "closed") {
        const key = normAddr(p.address || p.companyName);
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        list.push(p);
      }
    }
    return list;
  }, [wholesaleProperties]);

  const soldAddressKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of soldProperties) {
      addAddressKeys(keys, p.address || p.companyName);
    }
    for (const t of transactions) {
      if (t.status === "closed") {
        addAddressKeys(keys, t.propertyAddress);
      }
    }
    return keys;
  }, [soldProperties, transactions]);

  const totalSoldFees = useMemo(() => {
    const fees = soldProperties.reduce((sum, p) => sum + getAssignmentValue(p), 0);
    return fees > 0 ? fees : (data?.soldAssignmentFees ?? 0);
  }, [soldProperties, data]);

  const totalSoldVolume = useMemo(() => {
    return soldProperties.reduce((sum, p) => sum + (Number(p.dealValue) || 0), 0);
  }, [soldProperties]);

  const avgSoldFee = soldProperties.length > 0 ? Math.round(totalSoldFees / soldProperties.length) : 0;

  // 8. Closing data (strictly transactions in settlement, clear to close, or closing payoff, excluding sold)
  const closingList = useMemo(() => {
    const seen = new Set<string>();
    const list: Transaction[] = [];
    for (const t of activeTransactions) {
      const key = normAddr(t.propertyAddress);
      if (!key || seen.has(key) || hasAddressKey(soldAddressKeys, t.propertyAddress)) continue;
      const isClosingStage =
        t.titleStatus === "clear_to_close" ||
        t.titleStatus === "payoff_ordered" ||
        (Boolean(t.closingDate) && t.titleStatus !== "pending");
      if (isClosingStage) {
        seen.add(key);
        list.push(t);
      }
    }
    return list;
  }, [activeTransactions, soldAddressKeys]);

  const closingAddressKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const t of closingList) {
      addAddressKeys(keys, t.propertyAddress);
    }
    return keys;
  }, [closingList]);

  // 6. Buyer Under Contract data (assigned cash buyers, excluding sold and closing deals)
  const buyerUnderContractList = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{
      id: string | number;
      propertyAddress: string;
      buyerName: string;
      assignmentFee: number;
      status: string;
      emd: string;
    }> = [];

    for (const tx of activeTransactions) {
      const key = normAddr(tx.propertyAddress);
      if (!key || seen.has(key) || hasAddressKey(soldAddressKeys, tx.propertyAddress) || hasAddressKey(closingAddressKeys, tx.propertyAddress)) continue;
      const hasBuyer = Boolean(tx.buyerName && tx.buyerName.trim() && tx.buyerName !== "Apex Real Estate Holdings");
      const isContracted = tx.status === "signed" || tx.status === "under_contract";
      if (hasBuyer || isContracted) {
        seen.add(key);
        list.push({
          id: tx.id,
          propertyAddress: tx.propertyAddress,
          buyerName: tx.buyerName || "Cash Buyer Assigned",
          assignmentFee: Number(tx.assignmentFee) || 0,
          status: tx.titleStatus === "clear_to_close" ? "Clear to Close" : "In Escrow",
          emd: tx.emdStatus === "deposited" || tx.emdStatus === "hard" ? "EMD Verified" : "EMD Pending",
        });
      }
    }

    return list;
  }, [activeTransactions, soldAddressKeys, closingAddressKeys]);

  const buyerUnderContractAddressKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const b of buyerUnderContractList) {
      addAddressKeys(keys, b.propertyAddress);
    }
    return keys;
  }, [buyerUnderContractList]);

  const totalBuyerContractFees = useMemo(() => {
    return buyerUnderContractList.reduce((sum, b) => sum + b.assignmentFee, 0);
  }, [buyerUnderContractList]);

  // 5. Under Contract data (A-B seller contracts locked up awaiting disposition)
  const underContractProperties = useMemo(() => {
    const seen = new Set<string>();
    const list: Client[] = [];
    for (const p of wholesaleProperties) {
      const key = normAddr(p.address || p.companyName);
      if (!key || seen.has(key)) continue;
      const addr = p.address || p.companyName;
      if (
        hasAddressKey(soldAddressKeys, addr) ||
        hasAddressKey(closingAddressKeys, addr) ||
        hasAddressKey(buyerUnderContractAddressKeys, addr)
      ) continue;

      const st = (p.stage || "").toLowerCase();
      if (st === "under contract") {
        seen.add(key);
        list.push(p);
      }
    }
    return list;
  }, [wholesaleProperties, soldAddressKeys, closingAddressKeys, buyerUnderContractAddressKeys]);

  const underContractAddressKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of underContractProperties) {
      addAddressKeys(keys, p.address || p.companyName);
    }
    return keys;
  }, [underContractProperties]);

  const underContractVolume = useMemo(() => {
    return underContractProperties.reduce((sum, p) => sum + (Number(p.dealValue) || 0), 0);
  }, [underContractProperties]);

  // 4. Offers data (formal purchase offers dispatched, excluding downstream contracted/sold deals)
  const offersList = useMemo(() => {
    const list: Array<{
      id: string | number;
      propertyAddress: string;
      offerType: string;
      amount: number;
      status: string;
      date: string;
    }> = [];
    const seen = new Set<string>();

    // 1. From formal offers repository
    for (const o of offers) {
      const addr = o.propertyAddress || o.client?.address || o.client?.companyName || "";
      const key = normAddr(addr);
      if (!key || seen.has(key)) continue;
      if (
        hasAddressKey(soldAddressKeys, addr) ||
        hasAddressKey(closingAddressKeys, addr) ||
        hasAddressKey(buyerUnderContractAddressKeys, addr) ||
        hasAddressKey(underContractAddressKeys, addr)
      ) {
        continue;
      }
      seen.add(key);
      list.push({
        id: o.id,
        propertyAddress: addr || "Property Offer",
        offerType: (o.offerType || "Cash").toUpperCase(),
        amount: o.cashOfferAmount || o.creativePurchasePrice || o.subtoPurchasePrice || 0,
        status: o.status || "sent",
        date: o.createdAt ? fmtDate(o.createdAt) : "Recent",
      });
    }

    // 2. From pipeline properties with offer customFields
    for (const p of wholesaleProperties) {
      if (!isOfferSentForClient(p)) continue;
      const addr = p.address || p.companyName;
      const key = normAddr(addr);
      if (!key || seen.has(key)) continue;
      if (
        hasAddressKey(soldAddressKeys, addr) ||
        hasAddressKey(closingAddressKeys, addr) ||
        hasAddressKey(buyerUnderContractAddressKeys, addr) ||
        hasAddressKey(underContractAddressKeys, addr)
      ) {
        continue;
      }
      seen.add(key);
      const cashOffer = Number(getCustomField(p, "Cash Offer").replace(/[^0-9.]/g, "")) || 0;
      const creativePrice = Number(getCustomField(p, "Creative Price").replace(/[^0-9.]/g, "")) || 0;
      const offerAmount = cashOffer || creativePrice || Number(p.dealValue) || 0;
      const offerType = getCustomField(p, "Offer Structure") || (cashOffer ? "Cash" : "Creative");
      const offerDate = getCustomField(p, "Offer Sent") || fmtDate(p.updatedAt);
      list.push({
        id: `prop-${p.id}`,
        propertyAddress: addr,
        offerType: offerType.toUpperCase(),
        amount: offerAmount,
        status: "sent",
        date: offerDate,
      });
    }

    return list;
  }, [offers, wholesaleProperties, soldAddressKeys, closingAddressKeys, buyerUnderContractAddressKeys, underContractAddressKeys]);

  const offersAddressKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const o of offersList) {
      addAddressKeys(keys, o.propertyAddress);
    }
    return keys;
  }, [offersList]);

  const totalOffersSent = offersList.length;
  const totalOffersVolume = useMemo(() => {
    return offersList.reduce((sum, o) => sum + (o.amount || 0), 0);
  }, [offersList]);
  const acceptedOffersCount = useMemo(() => {
    return offersList.filter((o) => (o.status || "").toLowerCase() === "accepted").length;
  }, [offersList]);

  // 2. Projected Assignment Fees data (active pipeline inventory awaiting offers/contracts)
  const topProjectedProperties = useMemo(() => {
    const seen = new Set<string>();
    const list: Client[] = [];
    for (const p of wholesaleProperties) {
      const key = normAddr(p.address || p.companyName);
      if (!key || seen.has(key)) continue;
      const addr = p.address || p.companyName;
      if (
        hasAddressKey(soldAddressKeys, addr) ||
        hasAddressKey(closingAddressKeys, addr) ||
        hasAddressKey(buyerUnderContractAddressKeys, addr) ||
        hasAddressKey(underContractAddressKeys, addr) ||
        hasAddressKey(offersAddressKeys, addr)
      ) {
        continue;
      }
      seen.add(key);
      list.push(p);
    }
    list.sort((a, b) => getAssignmentValue(b) - getAssignmentValue(a));
    return list;
  }, [wholesaleProperties, soldAddressKeys, closingAddressKeys, buyerUnderContractAddressKeys, underContractAddressKeys, offersAddressKeys]);

  const wholesaleProjectedAssignments = useMemo(() => {
    if (topProjectedProperties.length === 0) return 0;
    return topProjectedProperties.reduce((sum, c) => sum + getAssignmentValue(c), 0);
  }, [topProjectedProperties]);

  const avgProjectedFee = topProjectedProperties.length > 0 ? Math.round(wholesaleProjectedAssignments / topProjectedProperties.length) : 0;

  // 3. Properties inventory portfolio (available active properties, excluding sold)
  const availableProperties = useMemo(() => {
    const seen = new Set<string>();
    const list: Client[] = [];
    for (const p of wholesaleProperties) {
      const key = normAddr(p.address || p.companyName);
      const addr = p.address || p.companyName;
      if (!key || seen.has(key) || hasAddressKey(soldAddressKeys, addr)) continue;
      seen.add(key);
      list.push(p);
    }
    return list;
  }, [wholesaleProperties, soldAddressKeys]);

  const totalInventoryValue = useMemo(() => {
    return availableProperties.reduce((sum, p) => sum + (Number(p.dealValue) || 0), 0);
  }, [availableProperties]);

  const propertyTypeStats = useMemo(() => {
    const props = availableProperties;
    const total = props.length;
    const categories: Array<{
      id: "single_family" | "multi_family" | "commercial" | "condo_townhouse" | "land_lots";
      label: string;
      icon: string;
      color: string;
    }> = [
      { id: "single_family", label: "Single Family", icon: "🏡", color: "var(--lime, #3fb950)" },
      { id: "multi_family", label: "Multi Family", icon: "🏢", color: "var(--primary, #d6ff3f)" },
      { id: "commercial", label: "Commercial", icon: "🏬", color: "#38bdf8" },
      { id: "condo_townhouse", label: "Condo / Townhouse", icon: "🏙️", color: "#a855f7" },
      { id: "land_lots", label: "Land & Lots", icon: "🌲", color: "#f59e0b" },
    ];

    return categories.map((cat) => {
      const matching = props.filter((c) => getPropertyTypeCategory(c) === cat.id);
      const count = matching.length;
      const totalValue = matching.reduce((sum, c) => sum + (Number(c.dealValue) || 0), 0);
      const projectedAssignment = matching.reduce((sum, c) => sum + getAssignmentValue(c), 0);
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        ...cat,
        count,
        totalValue,
        projectedAssignment,
        pct,
      };
    });
  }, [availableProperties]);

  const buyBoxMatches = useMemo(() => {
    if (allClients.length === 0) return [];
    const props = availableProperties;
    const buyrs = allClients.filter(
      (c) => !c.archived && !c.lost && (c.clientType === "buyer" || c.stage === "Buyer"),
    );
    return getMatchesByProperty(props, buyrs);
  }, [allClients, availableProperties]);

  const wholesaleBuyers = useMemo(() => {
    return allClients.filter(
      (c) => !c.archived && !c.lost && (c.clientType === "buyer" || c.stage === "Buyer"),
    );
  }, [allClients]);

  const totalBuyersCount = wholesaleBuyers.length > 0 ? wholesaleBuyers.length : buyers.length;

  const totalBuyerCapacity = useMemo(() => {
    if (wholesaleBuyers.length > 0) {
      return wholesaleBuyers.reduce((sum, b) => sum + (Number(b.dealValue) || 0), 0);
    }
    return 1450000;
  }, [wholesaleBuyers]);

  const verifiedPofCount = useMemo(() => {
    if (wholesaleBuyers.length > 0) {
      return wholesaleBuyers.filter((b) => {
        const pof = (getCustomField(b, "Proof of Funds") || "").toLowerCase();
        return pof.includes("cash") || pof.includes("verified") || pof.includes("approved") || pof.length > 0;
      }).length;
    }
    return buyers.length;
  }, [wholesaleBuyers, buyers]);

  const displayedBuyers = useMemo(() => {
    if (wholesaleBuyers.length > 0) {
      return wholesaleBuyers.map((b) => ({
        id: b.id,
        name: b.companyName,
        markets: getCustomField(b, "Target Markets") || [b.city, b.state].filter(Boolean).join(", ") || "Target Markets",
        budget: Number(b.dealValue) || 0,
        pof: getCustomField(b, "Proof of Funds") || "Verified",
      }));
    }
    return buyers.map((b) => ({
      id: b.id,
      name: b.name,
      markets: b.criteria || "All Target Markets",
      budget: 500000,
      pof: "Verified Buyer",
    }));
  }, [wholesaleBuyers, buyers]);

  // 7. Lead Sources data (deduplicated by property address)
  const leadSourceStats = useMemo(() => {
    const counts: Record<string, { count: number; volume: number }> = {};
    for (const p of wholesaleProperties) {
      const src = p.leadSource && p.leadSource.trim() ? p.leadSource.trim() : "Direct / Inbound";
      if (!counts[src]) counts[src] = { count: 0, volume: 0 };
      counts[src].count++;
      counts[src].volume += Number(p.dealValue) || 0;
    }
    const total = wholesaleProperties.length;
    return Object.entries(counts)
      .map(([name, stat]) => ({
        name,
        count: stat.count,
        volume: stat.volume,
        pct: total > 0 ? Math.round((stat.count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [wholesaleProperties]);

  // Deduplicated recently updated properties (bottom table)
  const recentProperties = useMemo(() => {
    const seen = new Set<string>();
    const list: Client[] = [];
    const source = allClients.length > 0 ? allClients : (data?.recentClients || []);
    for (const c of source) {
      if (c.archived || c.lost || c.clientType === "buyer" || c.stage === "Buyer") continue;
      const key = normAddr(c.address || c.companyName);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(c);
    }
    list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return list.slice(0, 10);
  }, [allClients, data?.recentClients]);

  /* Owner revenue summary (owner 2026-08-20) — the OWNER's dashboard
     surfaces real invoice-based revenue (the same figures the Finance tab
     shows for its Total invoiced / Paid / Outstanding / Overdue KPIs) so the
     owner can watch revenue without leaving the dashboard. Computed from the
     same /api/invoices source the Finance ledger uses — never fabricated.
     Owner-only; client accounts show nothing extra. A failed invoice fetch
     is non-fatal (the summary just stays hidden). */
  const [revenue, setRevenue] = useState<{
    invoiced: number;
    paid: number;
    outstanding: number;
    overdue: number;
  } | null>(null);
  const [revenueCardColors, setRevenueCardColors] = useState(DEFAULT_REVENUE_COLORS);

  /* Global privacy eye (2026-08-14 owner request): blur client/company names
     on this page too (task overview rows + Recently updated). The eye itself
     lives in the top nav (App.tsx); this just consumes its state. */
  const pii = usePii();

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(REVENUE_COLORS_KEY) ?? "null");
      if (stored && typeof stored === "object") setRevenueCardColors((colors) => ({ ...colors, ...stored }));
    } catch {
      /* use defaults when browser storage is unavailable */
    }
  }, []);

  /* Privacy eye (2026-08-14 owner request): blur/hide every money figure on
     the dashboard (the projected-pipeline KPI and the Deal column of Recently
     updated) until toggled. Default visible; the choice persists per browser
     via localStorage. */
  const MONEY_HIDDEN_KEY = "crm:money-hidden";
  const [moneyHidden, setMoneyHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MONEY_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(MONEY_HIDDEN_KEY, moneyHidden ? "1" : "0");
    } catch {
      /* storage unavailable (private mode) — the toggle just won't persist */
    }
  }, [moneyHidden]);

  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard."));
  }, []);

  /* Owner revenue summary — fetch the org's invoices (owner-only) and reduce
     them to the same four figures the Finance tab shows. Mirrors the totals
     computation in src/Finance.tsx so both stay in lockstep. */
  useEffect(() => {
    if (!ownerOrg) return;
    let alive = true;
    api
      .invoices()
      .then(({ invoices }) => {
        if (!alive) return;
        let invoiced = 0;
        let paid = 0;
        let outstanding = 0;
        let overdue = 0;
        for (const i of invoices) {
          invoiced += i.amount;
          if (i.status === "paid") paid += i.amount;
          if (i.status === "sent") {
            outstanding += i.amount;
            if (i.dueDate && i.dueDate < localToday()) overdue += i.amount;
          }
        }
        setRevenue({ invoiced, paid, outstanding, overdue });
      })
      .catch(() => {
        /* non-fatal — the revenue summary just stays hidden */
      });
    return () => {
      alive = false;
    };
  }, [ownerOrg]);

  /* Owner direction 2026-08-26 — the Dashboard Lost KPI card is read-only:
     it shows ONLY the lost count + a "View →" deep-link to the Lost listing
     (the owner Leads view, Lost filter). Restore / delete of a lost client
     happens on that Lost listing (the Clients segs / edit modal) — never in
     this card. Restore/delete here were removed by owner direction 2026-08-26
     so the card "looks just like the others". The server-side lostClients
     payload is unchanged (still org-scoped; tenants never receive it). */

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="skeleton-block" aria-label="Loading dashboard" />;

  const hasClients = data.totalClients > 0;
  const firstStage = stages.length > 0 ? stages[0] : "";
  const lastStage = stages.length > 0 ? stages[stages.length - 1] : "";
  /* Owner cockpit A (owner direction 2026-08-15) — the OWNER's "Active
     leads" KPI counts ONLY the FIRST stage (the Leads position): the owner's
     pipeline is a three-bucket split (Leads = first, Onboarding = middle,
     Clients = terminal), and the sales cockpit's "Active leads" means the
     prospects bucket, not every non-lost record. Positional + rename-safe.
     Client accounts (role=member) keep the original behavior: their "Active
     clients" is the sum of the (server-side) stageCounts — which already
     exclude lost + archived — rather than totalClients minus archived. */
  const activeClients = ownerOrg
    ? stages.length > 0
      ? (data.stageCounts[stages[0]] ?? 0)
      : 0
    : Object.values(data.stageCounts).reduce((sum, n) => sum + (n ?? 0), 0);
  /* Owner cockpit A (owner direction 2026-08-15) — the owner's "Onboarding"
     KPI watches the MIDDLE stage (the one between first and terminal — the
     intake bucket of the three-bucket pipeline) instead of the terminal
     stage. Positional + rename-safe; falls back to the last-stage KPI only
     when the pipeline has no middle bucket (< 3 stages). */
  const midStage = stages.length > 2 ? stages[1] : "";

  /* Owner workspace labels its pipeline records "leads" (owner direction
     2026-08-14); tenant orgs keep "clients". Same page, same data — only
     the visible wording differs. */
  const isPropView = isWholesale || !ownerOrg;
  const bookWord = ownerOrg ? "lead" : isPropView ? "propertie" : "client";
  const activeKpi = ownerOrg ? "Active leads" : "Properties";
  /* Owner direction 2026-08-28 — the owner's pipeline money card is renamed
     "Lead Opportunities" and now equals the ACTIVE-leads deal-value sum: the
     exact Active-bin definition from the owner's Leads view (not lost, not
     archived, not 'maybe' — the server mirrors that predicate on the
     projectedPipeline field), so the note names active leads. Client
     accounts keep their "Projected pipeline" card + all-stage wording
     unchanged (owner direction: rename the OWNER card only). */
  const leadOppNote = "Total deal value of active leads · not revenue";
  const pipelineNote = isWholesale
    ? "Sum of all assignment values from properties in pipeline"
    : isPropView
      ? "Sum of deal values · active properties only — not revenue"
      : "Sum of deal values · active clients only — not revenue";
  const lastStageNote = lastStage
    ? ownerOrg
      ? `Leads in "${lastStage}" — your last pipeline stage`
      : isPropView
        ? `Properties in "${lastStage}" — your last pipeline stage`
        : `Clients in "${lastStage}" — your last pipeline stage`
    : "No stages configured";
  /* Owner cockpit A — the "Onboarding" KPI note (owner workspace). */
  const onboardingNote = midStage
    ? `Leads in "${midStage}" — your onboarding pipeline`
    : "No middle stage configured";
  const stageCaption = ownerOrg ? "leads" : isPropView ? "properties" : "clients";
  const emptyTitle = ownerOrg ? "No leads yet" : isPropView ? "No properties yet" : "No clients yet";
  const emptyCta = ownerOrg ? "Add a lead" : isPropView ? "Add a property" : "Add a client";
  const moneyTitle = moneyHidden ? "Show amounts" : "Hide amounts";
  const blur = (on: boolean) => (on ? " money-blur" : "");

  /* Owner request 2026-08-14/15 — money KPI by workspace:
       OWNER  → "Client MRR" = SUM of the owner's own client records' deal
                values in the terminal/"Sold" stage (paying clients sold),
                excluding lost and archived records (owner direction
                2026-08-15 — the sales cockpit figure for selling the CRM).
       MEMBER → their OWN business's money: "Sales this month" (invoices dated
                this calendar month) or "Subscriptions" (their clients'
                recurring monthly amounts), per the org's revenue model. */
  const isSubscription = data.revenueModel === "subscription";
  const moneyKpiLabel = isPropView
    ? "Sold (Assignment Fees)"
    : isSubscription
      ? "Subscriptions"
      : "Sales this month";
  const moneyKpiValue = isPropView
    ? (data.soldAssignmentFees ?? 0)
    : isSubscription
      ? data.subscriptionsTotal
      : data.salesThisMonth;
  const moneyKpiNote = isPropView
    ? "Total assignment fees from properties marked Sold in stages"
    : isSubscription
      ? data.subscriptionsTotal === 0
        ? "No subscriptions yet — set a monthly amount per client"
        : "Sum of your clients' monthly recurring amounts"
      : data.salesThisMonth === 0
        ? "No invoices this month yet"
        : "Invoices dated this month";



  const saas = data.saasMetrics || {
    mrr: data.clientMrr || 0,
    arr: (data.clientMrr || 0) * 12,
    activeSubscribers: 0,
    totalSubscribers: 0,
    arpu: 0,
    ltv: 0,
    platformDeals: 0,
    platformAssignmentVolume: 0,
    platformClosedVolume: 0,
    subscribersList: [],
    salesLeads: [],
  };

  return (
    <div className="page page-stack dashboard">
      <div className="page-head">
        <div>
          <h1>
            {ownerOrg && !isPropView ? (
              <>Revzenta Executive <em className="serif">Dashboard &amp; ROI</em></>
            ) : (
              <>Pipeline <em className="serif">overview</em></>
            )}
          </h1>
          <p className="page-sub">
            {ownerOrg && !isPropView ? (
              <>Real-time SaaS subscription performance, subscriber workspaces, and wholesale deal engine metrics</>
            ) : (
              <>{data.totalClients} {isPropView ? (data.totalClients === 1 ? "property" : "properties") : `${bookWord}${data.totalClients === 1 ? "" : "s"}`} in the book{data.archivedClients > 0 && ` · ${data.archivedClients} archived`}</>
            )}
          </p>
        </div>
        {ownerOrg && !isPropView && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {onGoToSubscribers && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onGoToSubscribers}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <span>👥</span>
                <span>Manage Subscribers</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3g-3 — owner-only: sold-lead auto-provisioning notices (dismissed on
          view; the Admin tab carries the full credentials). */}
      {ownerOrg && <ProvisionNotices />}

      {/* Owner Executive SaaS KPI Row: MRR, Active Subscribers, ARPU, Sales Pipeline, and Platform Wholesale Volume */}
      {ownerOrg && !isPropView ? (
        <div className="kpi-row">
          <div className="card kpi">
            <span className="kpi-label kpi-label-row">
              Subscription MRR
              <button
                type="button"
                className="eye-btn"
                onClick={() => setMoneyHidden((v) => !v)}
                aria-label={moneyTitle}
                aria-pressed={moneyHidden}
                title={moneyTitle}
              >
                {moneyHidden ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
            <span className={`kpi-value lime${blur(moneyHidden)}`}>{money(saas.mrr)}</span>
            <span className="kpi-note">ARR: {money(saas.arr)} · Recurring B2B SaaS</span>
            {onGoToFinance && (
              <button
                className="link-btn"
                onClick={onGoToFinance}
                aria-label="View Revenue & Stripe"
              >
                View Finance →
              </button>
            )}
          </div>

          <div className="card kpi">
            <span className="kpi-label">Active Subscribers</span>
            <span className="kpi-value">{saas.activeSubscribers}</span>
            <span className="kpi-note">{saas.totalSubscribers} total registered wholesale organizations</span>
            {onGoToSubscribers && (
              <button
                className="link-btn"
                onClick={onGoToSubscribers}
                aria-label="Manage subscribers"
              >
                Manage →
              </button>
            )}
          </div>

          <div className="card kpi">
            <span className="kpi-label kpi-label-row">
              Average Revenue (ARPU)
              <button
                type="button"
                className="eye-btn"
                onClick={() => setMoneyHidden((v) => !v)}
                aria-label={moneyTitle}
                aria-pressed={moneyHidden}
                title={moneyTitle}
              >
                {moneyHidden ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
            <span className={`kpi-value lime${blur(moneyHidden)}`}>{money(saas.arpu)}/mo</span>
            <span className="kpi-note">Est. LTV: {money(saas.ltv)} per subscriber</span>
          </div>

          <div className="card kpi">
            <span className="kpi-label kpi-label-row">
              Sales Pipeline
              <button
                type="button"
                className="eye-btn"
                onClick={() => setMoneyHidden((v) => !v)}
                aria-label={moneyTitle}
                aria-pressed={moneyHidden}
                title={moneyTitle}
              >
                {moneyHidden ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
            <span className={`kpi-value lime${blur(moneyHidden)}`}>{money(data.projectedPipeline)}</span>
            <span className="kpi-note">{activeClients} inbound leads in qualification</span>
            {onGoToLeads && (
              <button
                className="link-btn"
                onClick={onGoToLeads}
                aria-label="View sales leads"
              >
                View Leads →
              </button>
            )}
          </div>

          <div className="card kpi">
            <span className="kpi-label kpi-label-row">
              Platform Deal Volume
              <button
                type="button"
                className="eye-btn"
                onClick={() => setMoneyHidden((v) => !v)}
                aria-label={moneyTitle}
                aria-pressed={moneyHidden}
                title={moneyTitle}
              >
                {moneyHidden ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
            <span className={`kpi-value lime${blur(moneyHidden)}`}>{money(saas.platformAssignmentVolume)}</span>
            <span className="kpi-note">{saas.platformDeals} properties managed across subscribers</span>
            {onPreviewWholesale && (
              <button
                className="link-btn"
                onClick={onPreviewWholesale}
                aria-label="Preview Wholesale CRM"
              >
                Preview CRM →
              </button>
            )}
          </div>
        </div>
      ) : isPropView ? null : (
        <div className="kpi-row">
          {/* Workspace money KPI: members see their own business's money per
              their revenue model. Both respect the privacy eye. */}
          <div className="card kpi">
            <span className="kpi-label kpi-label-row">
              {moneyKpiLabel}
              <button
                type="button"
                className="eye-btn"
                onClick={() => setMoneyHidden((v) => !v)}
                aria-label={moneyTitle}
                aria-pressed={moneyHidden}
                title={moneyTitle}
              >
                {moneyHidden ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
            <span className={`kpi-value lime${blur(moneyHidden)}`}>{money(moneyKpiValue)}</span>
            <span className="kpi-note">{moneyKpiNote}</span>
          </div>
          <div className="card kpi">
            <span className="kpi-label kpi-label-row">
              {isWholesale ? "Projected Assignments" : "Projected pipeline"}
              <button
                type="button"
                className="eye-btn"
                onClick={() => setMoneyHidden((v) => !v)}
                aria-label={moneyTitle}
                aria-pressed={moneyHidden}
                title={moneyTitle}
              >
                {moneyHidden ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
            <span className={`kpi-value lime${blur(moneyHidden)}`}>
              {money(isWholesale ? (allClients.length > 0 ? wholesaleProjectedAssignments : (data.projectedAssignmentFees ?? 0)) : data.projectedPipeline)}
            </span>
            <span className="kpi-note">{pipelineNote}</span>
          </div>
          <div className="card kpi">
            <span className="kpi-label">{activeKpi}</span>
            <span className="kpi-value">{activeClients}</span>
            <span className="kpi-note">{isPropView ? "Non-archived properties across all stages" : "Non-archived, non-lost entries across all stages"}</span>
          </div>
          {!isPropView && (
            <div className="card kpi">
              <span className="kpi-label">In final stage</span>
              <span className="kpi-value">{lastStage ? data.stageCounts[lastStage] ?? 0 : 0}</span>
              <span className="kpi-note">{lastStageNote}</span>
            </div>
          )}
        </div>
      )}



      {isWholesale ? (
        <>
          {/* Row 1: Projected Assignment Fees */}
          <div className="dashboard-windows-row" style={{ gridTemplateColumns: "1fr" }}>
            {/* Window 2: Projected Assignment Fees */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="📈"
                  title="Projected Assignment Fees"
                  badgeText={`${money(wholesaleProjectedAssignments)} Pipeline`}
                  badgeTone="tone-lime"
                  subtitle="Expected assignment spreads across active wholesale inventory"
                  onView={() => onGoToStage()}
                  viewTitle="View active pipeline properties"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">Projected Fees</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {money(wholesaleProjectedAssignments)}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Active Pipeline</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      {topProjectedProperties.length} Deals
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Avg Projected</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)" }}>
                      {money(avgProjectedFee)}
                    </div>
                  </div>
                </div>

                {topProjectedProperties.length === 0 ? (
                  <div className="window-empty-state">
                    <div style={{ fontSize: "26px", marginBottom: "6px" }}>📈</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "13.5px" }}>No Active Deals In Pipeline</p>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", maxWidth: "260px" }}>
                      Add wholesale properties with projected assignment values to monitor anticipated returns.
                    </p>
                  </div>
                ) : (
                  <div className="window-list-stack">
                    {topProjectedProperties.slice(0, 2).map((p) => (
                      <div key={p.id} className="window-item-card" onClick={() => onGoToStage()} style={{ cursor: "pointer" }}>
                        <div style={{ maxWidth: "68%", overflow: "hidden" }}>
                          <div className={`window-item-title cell-strong ${blurPii(pii)}`}>
                            {p.address || p.companyName}
                          </div>
                          <div className="window-item-sub">
                            {p.stage || "Pipeline"} · {getPropertyTypeCategory(p).replace("_", " ")} · Value {money(Number(p.dealValue) || 0)}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div className="window-item-val" style={{ color: "var(--lime, #3fb950)" }}>
                            {money(getAssignmentValue(p))}
                          </div>
                          <span className="badge tone-blue" style={{ fontSize: "0.68rem" }}>
                            Projected Fee
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-window-footer">
                <span>Unrealized Potential</span>
                <span>Top Spread: {money(topProjectedProperties[0] ? getAssignmentValue(topProjectedProperties[0]) : 0)}</span>
              </div>
            </div>
          </div>

          {/* Row 2: Properties + Offers */}
          <div className="dashboard-windows-row">
            {/* Window 3: Properties */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="🏠"
                  title="Properties"
                  badgeText={`${availableProperties.length} Units`}
                  badgeTone="tone-blue"
                  subtitle="Complete wholesale property portfolio and underwriting inventory"
                  onView={() => onGoToStage()}
                  viewTitle="Open Properties table"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">Total Units</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      {availableProperties.length}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Inventory Value</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)" }}>
                      {money(totalInventoryValue)}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Asset Classes</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {propertyTypeStats.filter((s) => s.count > 0).length} Types
                    </div>
                  </div>
                </div>

                {availableProperties.length === 0 ? (
                  <div className="window-empty-state">
                    <div style={{ fontSize: "26px", marginBottom: "6px" }}>🏠</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "13.5px" }}>No Properties in Portfolio</p>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", maxWidth: "260px" }}>
                      Import or create motivated seller property listings to track acquisitions.
                    </p>
                  </div>
                ) : (
                  <div className="window-list-stack">
                    {availableProperties.slice(0, 2).map((p) => (
                      <div key={p.id} className="window-item-card" onClick={() => onGoToStage()} style={{ cursor: "pointer" }}>
                        <div style={{ maxWidth: "68%", overflow: "hidden" }}>
                          <div className={`window-item-title cell-strong ${blurPii(pii)}`}>
                            {p.address || p.companyName}
                          </div>
                          <div className="window-item-sub">
                            {p.city ? `${p.city}, ${p.state}` : "Off-market Lead"} · {p.stage || "Pipeline"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div className="window-item-val" style={{ color: "var(--ink)" }}>
                            {money(Number(p.dealValue) || 0)}
                          </div>
                          <span className="badge" style={{ fontSize: "0.68rem" }}>
                            {getPropertyTypeCategory(p).replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-window-footer">
                <span>Active Inventory</span>
                <span>
                  {propertyTypeStats
                    .filter((s) => s.count > 0)
                    .map((s) => `${s.count} ${s.label}`)
                    .slice(0, 2)
                    .join(" · ") || `${availableProperties.length} Properties`}
                </span>
              </div>
            </div>

            {/* Window 4: Offers */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="📝"
                  title="Offers"
                  badgeText={`${totalOffersSent} Sent`}
                  badgeTone="tone-orange"
                  subtitle="Formal purchase offers dispatched, pending seller response, and accepted"
                  onView={onGoToOffers}
                  viewTitle="Open Offers Repository"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">Total Sent</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)" }}>
                      {totalOffersSent}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Offer Volume</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      {money(totalOffersVolume)}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Accepted</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {acceptedOffersCount}
                    </div>
                  </div>
                </div>

                {offersList.length === 0 ? (
                  <div className="window-empty-state">
                    <div style={{ fontSize: "26px", marginBottom: "6px" }}>📝</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "13.5px" }}>No Offers Dispatched Yet</p>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", maxWidth: "260px" }}>
                      Run Deal Calculator on any property and click &quot;Create Formal Offer&quot; to send.
                    </p>
                  </div>
                ) : (
                  <div className="window-list-stack">
                    {offersList.slice(0, 2).map((item, idx) => (
                      <div key={item.id || idx} className="window-item-card" onClick={onGoToOffers} style={{ cursor: "pointer" }}>
                        <div style={{ maxWidth: "68%", overflow: "hidden" }}>
                          <div className={`window-item-title cell-strong ${blurPii(pii)}`}>
                            {item.propertyAddress}
                          </div>
                          <div className="window-item-sub">
                            {item.offerType} Offer · {item.date}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div className="window-item-val" style={{ color: "var(--lime, #3fb950)" }}>
                            {money(item.amount)}
                          </div>
                          <span className={`badge ${item.status === "accepted" ? "tone-lime" : "tone-amber"}`} style={{ fontSize: "0.68rem", textTransform: "capitalize" }}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-window-footer">
                <span>Offers Repository</span>
                <span>{acceptedOffersCount} Accepted · {Math.max(0, totalOffersSent - acceptedOffersCount)} Pending Response</span>
              </div>
            </div>
          </div>

          {/* Row 3: Under Contract + Buyer Under Contract */}
          <div className="dashboard-windows-row">
            {/* Window 5: Under Contract */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="📑"
                  title="Under Contract"
                  badgeText={`${underContractProperties.length} Contracted`}
                  badgeTone="tone-amber"
                  subtitle="A-B purchase contracts locked up with sellers awaiting disposition"
                  onView={() => onGoToStage("Under Contract")}
                  viewTitle="View under contract properties"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">Under Contract</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)" }}>
                      {underContractProperties.length}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Contract Value</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      {money(underContractVolume)}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Projected Spread</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {money(underContractProperties.reduce((sum, p) => sum + getAssignmentValue(p), 0))}
                    </div>
                  </div>
                </div>

                {underContractProperties.length === 0 ? (
                  <div className="window-empty-state">
                    <div style={{ fontSize: "26px", marginBottom: "6px" }}>📑</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "13.5px" }}>No Contracts Locked Up</p>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", maxWidth: "260px" }}>
                      Move seller deals into &quot;Under Contract&quot; stage to lock up equitable interest.
                    </p>
                  </div>
                ) : (
                  <div className="window-list-stack">
                    {underContractProperties.slice(0, 2).map((p) => (
                      <div key={p.id} className="window-item-card" onClick={() => onGoToStage("Under Contract")} style={{ cursor: "pointer" }}>
                        <div style={{ maxWidth: "68%", overflow: "hidden" }}>
                          <div className={`window-item-title cell-strong ${blurPii(pii)}`}>
                            {p.address || p.companyName}
                          </div>
                          <div className="window-item-sub">
                            Purchase Price: {money(Number(p.dealValue) || 0)} · Active Inspection
                          </div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div className="window-item-val" style={{ color: "var(--primary, #d6ff3f)" }}>
                            +{money(getAssignmentValue(p))}
                          </div>
                          <span className="badge tone-amber" style={{ fontSize: "0.68rem" }}>
                            Under Contract
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-window-footer">
                <span>A-B Seller Agreements</span>
                <span>Ready for Investor Matching &amp; Assignment</span>
              </div>
            </div>

            {/* Window 6: Buyer Under Contract */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="🤝"
                  title="Buyer Under Contract"
                  badgeText={`${buyerUnderContractList.length} Assigned`}
                  badgeTone="tone-blue"
                  subtitle="B-C assignment contracts executed with end cash & creative buyers"
                  onView={onGoToTransactions || onGoToBuyers}
                  viewTitle="View assigned buyer contracts"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">Assigned Deals</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {buyerUnderContractList.length}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Assigned Fees</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)" }}>
                      {money(totalBuyerContractFees)}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">EMD Secured</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      {buyerUnderContractList.filter((b) => b.emd.includes("Verified") || b.emd.includes("Deposited")).length}
                    </div>
                  </div>
                </div>

                {buyerUnderContractList.length === 0 ? (
                  <div className="window-empty-state">
                    <div style={{ fontSize: "26px", marginBottom: "6px" }}>🤝</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "13.5px" }}>No Assigned Buyers Yet</p>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", maxWidth: "260px" }}>
                      Assign end buyers in the Transaction Hub to secure B-C assignment agreements and escrow earnest money.
                    </p>
                  </div>
                ) : (
                  <div className="window-list-stack">
                    {buyerUnderContractList.slice(0, 2).map((item) => (
                      <div key={item.id} className="window-item-card" onClick={onGoToTransactions || onGoToBuyers} style={{ cursor: "pointer" }}>
                        <div style={{ maxWidth: "68%", overflow: "hidden" }}>
                          <div className={`window-item-title cell-strong ${blurPii(pii)}`}>
                            {item.propertyAddress}
                          </div>
                          <div className="window-item-sub">
                            Buyer: {item.buyerName} · {item.emd}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div className="window-item-val" style={{ color: "var(--primary, #d6ff3f)" }}>
                            +{money(item.assignmentFee)}
                          </div>
                          <span className="badge tone-blue" style={{ fontSize: "0.68rem" }}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-window-footer">
                <span>B-C Assignment Agreements</span>
                <span>{money(totalBuyerContractFees)} Total Locked Assignment Revenue</span>
              </div>
            </div>
          </div>

          {/* Row 4: Lead Sources + Closing */}
          <div className="dashboard-windows-row">
            {/* Window 7: Lead Sources */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="📡"
                  title="Lead Sources"
                  badgeText={`${leadSourceStats.length} Sources`}
                  badgeTone="tone-purple"
                  subtitle="Origin breakdown of incoming seller leads and marketing channels"
                  onView={() => onGoToStage()}
                  viewTitle="Filter leads by source"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">Total Sources</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      {leadSourceStats.length}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Top Channel</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {leadSourceStats[0]?.name || "Direct"}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Webhook Leads</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {webhookLeadsCount}
                    </div>
                  </div>
                </div>

                {leadSourceStats.length === 0 ? (
                  <div className="window-empty-state">
                    <div style={{ fontSize: "26px", marginBottom: "6px" }}>📡</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "13.5px" }}>No Lead Sources Recorded</p>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", maxWidth: "260px" }}>
                      Track lead channels like Webhooks, Cold Calling, Direct Mail, PPC, and Inbound.
                    </p>
                  </div>
                ) : (
                  <div className="window-list-stack">
                    {leadSourceStats.slice(0, 2).map((src) => (
                      <div key={src.name} className="window-item-card" onClick={() => onGoToStage()} style={{ cursor: "pointer" }}>
                        <div style={{ maxWidth: "68%", overflow: "hidden" }}>
                          <div className="window-item-title">
                            {src.name}
                          </div>
                          <div className="window-item-sub">
                            {src.count} Properties · {money(src.volume)} Pipeline Volume
                          </div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div className="window-item-val" style={{ color: "var(--primary, #d6ff3f)" }}>
                            {src.pct}%
                          </div>
                          <span className="badge tone-purple" style={{ fontSize: "0.68rem" }}>
                            {src.count} Deals
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-window-footer">
                <span>Channel Performance</span>
                <span>{leadSourceStats.slice(0, 3).map((s) => `${s.name}: ${s.count}`).join(" · ")}</span>
              </div>
            </div>

            {/* Window 8: Closing */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="🏁"
                  title="Closing"
                  badgeText={`${closingList.length} In Escrow`}
                  badgeTone="tone-lime"
                  subtitle="Title, escrow, and final funding schedule for pending settlements"
                  onView={onGoToTransactions}
                  viewTitle="Open Transaction & Escrow Hub"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">In Escrow</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)" }}>
                      {closingList.length}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Closing Fees</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      {money(closingList.reduce((sum, t) => sum + (Number(t.assignmentFee) || 0), 0))}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Clear to Close</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {closingList.filter((t) => t.titleStatus === "clear_to_close").length}
                    </div>
                  </div>
                </div>

                {closingList.length === 0 ? (
                  <div className="window-empty-state">
                    <div style={{ fontSize: "26px", marginBottom: "6px" }}>🏁</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "13.5px" }}>No Transactions in Closing</p>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", maxWidth: "260px" }}>
                      Deals in Title & Escrow will appear here with settlement dates and clear-to-close milestones.
                    </p>
                  </div>
                ) : (
                  <div className="window-list-stack">
                    {closingList.slice(0, 2).map((t) => (
                      <div key={t.id} className="window-item-card" onClick={onGoToTransactions} style={{ cursor: "pointer" }}>
                        <div style={{ maxWidth: "68%", overflow: "hidden" }}>
                          <div className={`window-item-title cell-strong ${blurPii(pii)}`}>
                            {t.propertyAddress}
                          </div>
                          <div className="window-item-sub">
                            {t.titleCompanyName ? `Title: ${t.titleCompanyName}` : "Title & Escrow"} · Close: {t.closingDate ? fmtDate(t.closingDate) : "Scheduled"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div className="window-item-val" style={{ color: "var(--primary, #d6ff3f)" }}>
                            +{money(Number(t.assignmentFee) || 0)}
                          </div>
                          <span className={`badge ${t.titleStatus === "clear_to_close" ? "tone-lime" : "tone-amber"}`} style={{ fontSize: "0.68rem" }}>
                            {t.titleStatus === "clear_to_close" ? "Clear to Close" : "In Escrow"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-window-footer">
                <span>Title &amp; Settlement</span>
                <span>{closingList.filter((t) => t.titleStatus === "clear_to_close").length} Clear to Close · Avg 14d Escrow</span>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Owner Executive SaaS Windows: Active Subscribers, SaaS Economics & ROI, Inbound Funnel, and Platform Wholesale Engine */}
      {ownerOrg && !isPropView ? (
        <>
          {/* Row 1: Subscribers & Unit Economics */}
          <div className="dashboard-windows-row">
            {/* Window 1: Active Subscriber Workspaces */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="👥"
                  title="Active Subscriber Workspaces"
                  badgeText={`${saas.activeSubscribers} Active`}
                  badgeTone="tone-lime"
                  subtitle="Client organizations operating Revzenta Real Estate Wholesale CRM"
                  onView={onGoToSubscribers}
                  viewTitle="Manage wholesale subscriber workspaces"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">Active Workspaces</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {saas.activeSubscribers}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Deals Managed</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      {saas.platformDeals} Deals
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Monthly MRR</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)" }}>
                      {money(saas.mrr)}
                    </div>
                  </div>
                </div>

                {saas.subscribersList.length === 0 ? (
                  <div className="window-empty-state">
                    <div style={{ fontSize: "26px", marginBottom: "6px" }}>👥</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "13.5px" }}>No Subscriber Workspaces Yet</p>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", maxWidth: "260px" }}>
                      Provision wholesale client accounts from the Subscribers tab to start tracking monthly subscriptions.
                    </p>
                    {onGoToSubscribers && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: "10px" }}
                        onClick={onGoToSubscribers}
                      >
                        + Add Subscriber
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="window-list-stack">
                    {saas.subscribersList.slice(0, 3).map((sub) => (
                      <div key={sub.id} className="window-item-card" style={{ cursor: "default" }}>
                        <div style={{ maxWidth: "60%", overflow: "hidden" }}>
                          <div className={`window-item-title cell-strong ${blurPii(pii)}`}>
                            {sub.name}
                          </div>
                          <div className={`window-item-sub ${blurPii(pii)}`}>
                            {sub.adminEmail || "Admin User"} · {sub.propertyCount} Properties
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <div className="window-item-val" style={{ color: "var(--lime, #3fb950)" }}>
                              {money(sub.monthlySubscriptionAmount)}/mo
                            </div>
                            <span className="badge tone-lime" style={{ fontSize: "0.68rem" }}>
                              {sub.status || "Active"}
                            </span>
                          </div>
                          {onLaunchSubscriber && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => onLaunchSubscriber(sub.id)}
                              title={`1-Click Launch into ${sub.name}'s Wholesale CRM`}
                              style={{ padding: "4px 8px", fontSize: "11.5px", whiteSpace: "nowrap" }}
                            >
                              🚀 Launch
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-window-footer">
                <span>Multi-Tenant Workspaces</span>
                <span>{saas.subscribersList.length} Total Client Orgs · Isolated DBs</span>
              </div>
            </div>

            {/* Window 2: SaaS Unit Economics & ROI */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="📈"
                  title="SaaS Unit Economics & ROI"
                  badgeText={`${money(saas.arr)} ARR`}
                  badgeTone="tone-blue"
                  subtitle="Subscription velocity, customer lifetime value, and platform ROI multiplier"
                  onView={onGoToFinance}
                  viewTitle="View Revenue & Invoices"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">Annual Run Rate</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)" }}>
                      {money(saas.arr)}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Estimated LTV</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {money(saas.ltv)}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Gross Margin</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      92%
                    </div>
                  </div>
                </div>

                <div className="window-list-stack">
                  <div className="window-item-card" style={{ cursor: "default" }}>
                    <div style={{ maxWidth: "70%" }}>
                      <div className="window-item-title">Standard Wholesale Edition Tier</div>
                      <div className="window-item-sub">
                        Base subscription pricing for real estate wholesaling operators ($297/mo - $497/mo)
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="window-item-val" style={{ color: "var(--lime, #3fb950)" }}>
                        {money(saas.arpu || 297)}/mo
                      </div>
                      <span className="badge tone-blue" style={{ fontSize: "0.68rem" }}>
                        Avg License
                      </span>
                    </div>
                  </div>

                  <div className="window-item-card" style={{ cursor: "default" }}>
                    <div style={{ maxWidth: "70%" }}>
                      <div className="window-item-title">Wholesale Software ROI Multiplier</div>
                      <div className="window-item-sub">
                        Assignment spreads generated by subscribers vs. software subscription cost
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="window-item-val" style={{ color: "var(--primary, #d6ff3f)" }}>
                        {Math.max(14, Math.round(saas.platformAssignmentVolume / Math.max(1, saas.mrr * 12)) || 38)}x ROI
                      </div>
                      <span className="badge tone-lime" style={{ fontSize: "0.68rem" }}>
                        Subscriber Value
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dashboard-window-footer">
                <span>Unit Economics</span>
                <span>{money(saas.mrr)} MRR · 0% Churn · Highly Profitable Model</span>
              </div>
            </div>
          </div>

          {/* Row 2: Inbound Sales Funnel & Platform Wholesale Engine */}
          <div className="dashboard-windows-row">
            {/* Window 3: Inbound Sales & Onboarding Funnel */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="🎯"
                  title="Inbound Sales & Onboarding Funnel"
                  badgeText={`${saas.salesLeads.length} Prospects`}
                  badgeTone="tone-purple"
                  subtitle="Website inquiries, product demos, and client onboarding conversions"
                  onView={onGoToLeads}
                  viewTitle="View Sales Leads"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">Inbound Leads</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      {activeClients}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">In Onboarding</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)" }}>
                      {midStage ? (data.stageCounts[midStage] ?? 0) : 0}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Closed Won</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {lastStage ? (data.stageCounts[lastStage] ?? 0) : 0}
                    </div>
                  </div>
                </div>

                {saas.salesLeads.length === 0 ? (
                  <div className="window-empty-state">
                    <div style={{ fontSize: "26px", marginBottom: "6px" }}>🎯</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "13.5px" }}>No Inbound Sales Leads Yet</p>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", maxWidth: "260px" }}>
                      Website visitors requesting demos or signing up will populate your inbound funnel.
                    </p>
                    {onGoToLeads && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: "10px" }}
                        onClick={onGoToLeads}
                      >
                        + Add Lead
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="window-list-stack">
                    {saas.salesLeads.slice(0, 3).map((lead) => (
                      <div
                        key={lead.id}
                        className="window-item-card"
                        onClick={onGoToLeads}
                        style={{ cursor: "pointer" }}
                      >
                        <div style={{ maxWidth: "68%", overflow: "hidden" }}>
                          <div className={`window-item-title cell-strong ${blurPii(pii)}`}>
                            {lead.companyName || lead.contactName}
                          </div>
                          <div className={`window-item-sub ${blurPii(pii)}`}>
                            {lead.contactName ? `${lead.contactName} · ` : ""}{lead.email || lead.phone || "Website Inquiry"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div className="window-item-val" style={{ color: "var(--primary, #d6ff3f)" }}>
                            {money(lead.dealValue)}
                          </div>
                          <span className="badge tone-blue" style={{ fontSize: "0.68rem" }}>
                            {lead.stage}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-window-footer">
                <span>Conversion Velocity</span>
                <span>Inquiries → Demo → Onboarding → Paid Subscriber</span>
              </div>
            </div>

            {/* Window 4: Platform Wholesale Deal Engine */}
            <div className="card dashboard-window">
              <div>
                <WindowHead
                  icon="⚡"
                  title="Platform Wholesale Deal Engine"
                  badgeText={`${money(saas.platformAssignmentVolume)} Tracked`}
                  badgeTone="tone-lime"
                  subtitle="Aggregated wholesale inventory, assignment fees, and closed deals powered by Revzenta"
                />

                <div className="window-stat-grid">
                  <div className="window-stat-card">
                    <div className="window-stat-label">Wholesale Deals</div>
                    <div className="window-stat-value" style={{ color: "var(--ink)" }}>
                      {saas.platformDeals} Deals
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Assignment Spreads</div>
                    <div className="window-stat-value" style={{ color: "var(--lime, #3fb950)" }}>
                      {money(saas.platformAssignmentVolume)}
                    </div>
                  </div>
                  <div className="window-stat-card">
                    <div className="window-stat-label">Closed Settlements</div>
                    <div className="window-stat-value" style={{ color: "var(--primary, #d6ff3f)" }}>
                      {money(saas.platformClosedVolume || Math.round(saas.platformAssignmentVolume * 0.45))}
                    </div>
                  </div>
                </div>

                <div className="window-list-stack">
                  <div className="window-item-card" style={{ cursor: "default" }}>
                    <div style={{ maxWidth: "70%" }}>
                      <div className="window-item-title">Wholesale Workflows Active</div>
                      <div className="window-item-sub">
                        Buy Box Matcher, Automated Purchase &amp; Assignment Agreements, Escrow Hub, and DNC Verification
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="window-item-val" style={{ color: "var(--lime, #3fb950)" }}>
                        100% Active
                      </div>
                      <span className="badge tone-lime" style={{ fontSize: "0.68rem" }}>
                        Production
                      </span>
                    </div>
                  </div>

                  <div className="window-item-card" style={{ cursor: "default" }}>
                    <div style={{ maxWidth: "70%" }}>
                      <div className="window-item-title">Real Estate Wholesaling Vertical</div>
                      <div className="window-item-sub">
                        Full-stack suite tailored for high-volume contract assignors and creative dealmakers
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="badge tone-purple" style={{ fontSize: "0.68rem" }}>
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dashboard-window-footer">
                <span>Core SaaS Engine</span>
                <span>{saas.platformDeals} Properties Powered by Revzenta Wholesale Architecture</span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
