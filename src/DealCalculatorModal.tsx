import { useState, useMemo, useEffect } from "react";
import type { Client } from "./types";
import { api, type ClientInput } from "./api";
import {
  calculateCashWholesale,
  calculateSellerFinancing,
  calculateSubjectTo,
  evaluateDealViability,
  generateMultiOptionProposal,
  type MortgageLien,
} from "./dealUnderwriting";

interface Props {
  property?: Client | null;
  onClose: () => void;
  onUpdated?: (updated: Client) => void;
  crmBusinessName?: string;
}

/** Currency input with clean $ prefix, high-contrast text, and automatic numeric comma formatting */
function CurrencyField({
  label,
  value,
  onChange,
  placeholder = "0",
  hint,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [text, setText] = useState<string>(value ? value.toLocaleString() : "");

  useEffect(() => {
    setText(value ? value.toLocaleString() : "");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const num = Number(raw) || 0;
    setText(raw ? Number(raw).toLocaleString() : "");
    onChange(num);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink, #f8fafc)", letterSpacing: "0.01em" }}>
          {label}
        </span>
        {hint && <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 500 }}>{hint}</span>}
      </label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span
          style={{
            position: "absolute",
            left: "12px",
            color: "var(--muted, #94a3b8)",
            fontSize: "14px",
            fontWeight: 700,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          $
        </span>
        <input
          type="text"
          inputMode="numeric"
          style={{
            width: "100%",
            height: "40px",
            paddingLeft: "28px",
            paddingRight: "12px",
            fontSize: "15px",
            fontWeight: 700,
            background: "var(--panel, #121216)",
            color: "var(--ink, #f8fafc)",
            border: "1px solid var(--border, #30363d)",
            borderRadius: "7px",
            boxSizing: "border-box",
            outline: "none",
          }}
          placeholder={placeholder}
          value={text}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}

/** Percentage or numeric step input with high-contrast text and clean styling */
function NumberField({
  label,
  value,
  onChange,
  suffix = "",
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  suffix?: string;
  step?: number;
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink, #f8fafc)", letterSpacing: "0.01em" }}>
          {label}
        </span>
        {hint && <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 500 }}>{hint}</span>}
      </label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          type="number"
          step={step}
          style={{
            width: "100%",
            height: "40px",
            paddingLeft: "12px",
            paddingRight: suffix ? "36px" : "12px",
            fontSize: "15px",
            fontWeight: 700,
            background: "var(--panel, #121216)",
            color: "var(--ink, #f8fafc)",
            border: "1px solid var(--border, #30363d)",
            borderRadius: "7px",
            boxSizing: "border-box",
            outline: "none",
          }}
          value={value === 0 ? "" : value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: "12px",
              color: "var(--muted, #94a3b8)",
              fontSize: "13px",
              fontWeight: 700,
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/** Cleanly parses address components from a string */
function parseAddressString(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return { address: "", city: "", state: "", zip: "" };

  const commaParts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const street = commaParts[0];
    const city = commaParts[1];
    let state = "";
    let zip = "";
    if (commaParts.length >= 3) {
      const last = commaParts[2];
      const match = last.match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
      if (match) {
        state = match[1].toUpperCase();
        zip = match[2] || "";
      } else {
        const tokens = last.split(/\s+/);
        state = tokens[0] || "";
        zip = tokens[1] || "";
      }
    }
    return { address: street, city, state, zip };
  }
  return { address: trimmed, city: "", state: "", zip: "" };
}

export default function DealCalculatorModal({ property, onClose, onUpdated, crmBusinessName }: Props) {
  const [tab, setTab] = useState<"proposal" | "cash" | "creative" | "subto">("proposal");

  // Property & entity metadata
  const initialAddress = useMemo(() => {
    if (!property) return "";
    if (property.address) {
      const full = [property.address, property.city, [property.state, property.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      return full || property.address;
    }
    const cfAddr = property.customFields?.find((c) => c.name.toLowerCase().includes("address"))?.value;
    if (cfAddr) return String(cfAddr);
    return property.companyName || "";
  }, [property]);

  const [propertyAddress, setPropertyAddress] = useState(initialAddress);

  useEffect(() => {
    if (initialAddress) {
      setPropertyAddress(initialAddress);
    }
  }, [initialAddress]);

  const initialSeller = useMemo(() => {
    if (!property) return "";
    if (property.contactName && property.contactName !== "Unknown Owner") return property.contactName;
    if (property.companyName && property.companyName !== property.address) return property.companyName;
    return "";
  }, [property]);

  const [sellerName, setSellerName] = useState(initialSeller);

  useEffect(() => {
    if (initialSeller) {
      setSellerName(initialSeller);
    }
  }, [initialSeller]);

  const [recipientEmail] = useState(property?.email || "");
  const [acquisitionsCompany, setAcquisitionsCompany] = useState(crmBusinessName || "");

  useEffect(() => {
    if (!acquisitionsCompany) {
      api.settings().then((s) => {
        if (s.settings?.orgName) {
          setAcquisitionsCompany(s.settings.orgName);
        }
      }).catch(() => {});
    }
  }, []);

  // Initialize from property custom fields or sensible defaults
  const initialFields = useMemo(() => {
    let arv = 275000;
    let repairs = 35000;
    let fee = 10000;
    let rule = 70;
    let purchasePrice = 260000;
    let listedPrice = 275000;
    let downPayment = 15000;
    let rate = 3.5;
    let rent = 2200;

    if (property?.dealValue && property.dealValue > 20000) {
      arv = property.dealValue;
      purchasePrice = property.dealValue;
    }

    if (property?.customFields) {
      for (const cf of property.customFields) {
        const n = cf.name.toLowerCase();
        const num = Number(String(cf.value).replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) {
          if (n === "arv") arv = num;
          if (n === "repairs") repairs = num;
          if (n.includes("assignment fee")) fee = num;
          if (n.includes("investor rule")) rule = num;
          if (n.includes("purchase price")) purchasePrice = num;
          if (n.includes("down payment")) downPayment = num;
          if (n.includes("interest rate")) rate = num;
          if (n.includes("rent")) rent = num;
        }
      }
    }
    return { arv, repairs, fee, rule, purchasePrice, listedPrice, downPayment, rate, rent };
  }, [property]);

  // ==========================================================================
  // 1. CASH WHOLESALE / FIX & FLIP UNDERWRITING STATE
  // ==========================================================================
  const [cashArv, setCashArv] = useState<number>(initialFields.arv);
  const [cashRepairs, setCashRepairs] = useState<number>(initialFields.repairs);
  const [cashInvestorRule, setCashInvestorRule] = useState<number>(initialFields.rule);
  const [cashAssignmentFee, setCashAssignmentFee] = useState<number>(initialFields.fee);
  const [cashClosingCostPct] = useState<number>(1.5);

  const cashMetrics = useMemo(() => {
    return calculateCashWholesale({
      arv: cashArv,
      estimatedRepairs: cashRepairs,
      targetInvestorRulePct: cashInvestorRule,
      wholesaleAssignmentFee: cashAssignmentFee,
      buyerClosingCostPct: cashClosingCostPct,
    });
  }, [cashArv, cashRepairs, cashInvestorRule, cashAssignmentFee, cashClosingCostPct]);

  // ==========================================================================
  // 2. CREATIVE SELLER FINANCING (OWNER CARRY) UNDERWRITING STATE
  // ==========================================================================
  const [creativePrice, setCreativePrice] = useState<number>(initialFields.purchasePrice);
  const [creativeTargetList] = useState<number>(initialFields.listedPrice);
  const [creativeDown, setCreativeDown] = useState<number>(initialFields.downPayment);
  const [creativeInterestRate, setCreativeInterestRate] = useState<number>(initialFields.rate);
  const [creativeAmortYears, setCreativeAmortYears] = useState<number>(30);
  const [creativeBalloonYears, setCreativeBalloonYears] = useState<number>(5);
  const [creativeIsIO, setCreativeIsIO] = useState<boolean>(false);
  const [creativeRehab] = useState<number>(5000);
  const [creativeAssignmentFee, setCreativeAssignmentFee] = useState<number>(initialFields.fee);
  const [creativeClosingCosts] = useState<number>(2000);
  const [creativeRent, setCreativeRent] = useState<number>(initialFields.rent);
  const [creativeTaxes, setCreativeTaxes] = useState<number>(180);
  const [creativeInsurance, setCreativeInsurance] = useState<number>(120);
  const [creativeHoa, setCreativeHoa] = useState<number>(45);

  const creativeMetrics = useMemo(() => {
    return calculateSellerFinancing({
      purchasePrice: creativePrice,
      listedTargetPrice: creativeTargetList,
      downPayment: creativeDown,
      annualInterestRate: creativeInterestRate,
      amortizationYears: creativeAmortYears,
      balloonMaturityYears: creativeBalloonYears,
      isInterestOnly: creativeIsIO,
      rehabMakeReady: creativeRehab,
      assignmentFee: creativeAssignmentFee,
      closingEscrowCosts: creativeClosingCosts,
      monthlyMarketRent: creativeRent,
      monthlyTaxes: creativeTaxes,
      monthlyInsurance: creativeInsurance,
      monthlyHoa: creativeHoa,
    });
  }, [
    creativePrice,
    creativeTargetList,
    creativeDown,
    creativeInterestRate,
    creativeAmortYears,
    creativeBalloonYears,
    creativeIsIO,
    creativeRehab,
    creativeAssignmentFee,
    creativeClosingCosts,
    creativeRent,
    creativeTaxes,
    creativeInsurance,
    creativeHoa,
  ]);

  // ==========================================================================
  // 3. SUBJECT-TO (SUBTO) MORTGAGE ASSUMPTION STATE
  // ==========================================================================
  const [subtoPrice, setSubtoPrice] = useState<number>(initialFields.purchasePrice);
  const [subtoCashToSeller, setSubtoCashToSeller] = useState<number>(7500);
  const [subtoArrears, setSubtoArrears] = useState<number>(0);
  const [subtoRehab] = useState<number>(5000);
  const [subtoAssignmentFee, setSubtoAssignmentFee] = useState<number>(initialFields.fee);
  const [subtoClosingCosts] = useState<number>(2000);
  const [subtoRent, setSubtoRent] = useState<number>(initialFields.rent);
  const [subtoTaxesIns, setSubtoTaxesIns] = useState<number>(250);
  const [subtoHoa] = useState<number>(40);

  // Existing debt liens
  const [liens, setLiens] = useState<MortgageLien[]>([
    {
      id: "1",
      label: "Senior 1st Mortgage",
      unpaidPrincipalBalance: Math.round(initialFields.purchasePrice * 0.75),
      interestRate: 3.25,
      monthlyPaymentPITI: 1250,
    },
  ]);

  const subtoMetrics = useMemo(() => {
    return calculateSubjectTo({
      purchasePrice: subtoPrice,
      cashToSeller: subtoCashToSeller,
      arrearsReinstatement: subtoArrears,
      rehabMakeReady: subtoRehab,
      assignmentFee: subtoAssignmentFee,
      closingEscrowCosts: subtoClosingCosts,
      liens,
      monthlyMarketRent: subtoRent,
      monthlyTaxesAndInsurance: subtoTaxesIns,
      monthlyHoa: subtoHoa,
    });
  }, [
    subtoPrice,
    subtoCashToSeller,
    subtoArrears,
    subtoRehab,
    subtoAssignmentFee,
    subtoClosingCosts,
    liens,
    subtoRent,
    subtoTaxesIns,
    subtoHoa,
  ]);

  // ==========================================================================
  // 4. DEAL VIABILITY SCORECARD
  // ==========================================================================
  const currentViability = useMemo(() => {
    if (tab === "cash") {
      return evaluateDealViability("cash", {
        investorROI: cashMetrics.investorROI,
        netWholesaleOffer: cashMetrics.netWholesaleOffer,
        maxAllowableOffer: cashMetrics.maxAllowableOffer,
      });
    } else if (tab === "subto") {
      return evaluateDealViability("subto", {
        netMonthlyCashFlow: subtoMetrics.netMonthlyCashFlow,
        cashOnCashReturn: subtoMetrics.cashOnCashReturn,
        entryCapitalPct: subtoMetrics.entryCapitalPct,
      });
    } else {
      return evaluateDealViability("creative", {
        netMonthlyCashFlow: creativeMetrics.netMonthlyCashFlow,
        cashOnCashReturn: creativeMetrics.cashOnCashReturn,
        entryCapitalPct: creativeMetrics.entryCapitalPct,
        dscr: creativeMetrics.dscr,
      });
    }
  }, [tab, cashMetrics, subtoMetrics, creativeMetrics]);

  // ==========================================================================
  // 5. EXECUTIVE MULTI-OPTION PROPOSAL / LOI GENERATION
  // ==========================================================================
  const [selectedProposalOptions, setSelectedProposalOptions] = useState<Array<"cash" | "subto" | "creative">>([
    "cash",
    "subto",
    "creative",
  ]);
  const [closingDays, setClosingDays] = useState<number>(14);
  const [includeAssignability, setIncludeAssignability] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"formatted" | "plain">("formatted");
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [savingToCrm, setSavingToCrm] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const proposalData = useMemo(() => {
    return generateMultiOptionProposal({
      propertyAddress,
      sellerName,
      acquisitionsCompany,
      selectedOptions: selectedProposalOptions,
      closingDays,
      cashMetrics,
      subtoMetrics,
      subtoInput: {
        purchasePrice: subtoPrice,
        cashToSeller: subtoCashToSeller,
        arrearsReinstatement: subtoArrears,
        rehabMakeReady: subtoRehab,
        assignmentFee: subtoAssignmentFee,
        closingEscrowCosts: subtoClosingCosts,
        liens,
        monthlyMarketRent: subtoRent,
        monthlyTaxesAndInsurance: subtoTaxesIns,
        monthlyHoa: subtoHoa,
      },
      creativeMetrics,
      creativeInput: {
        purchasePrice: creativePrice,
        listedTargetPrice: creativeTargetList,
        downPayment: creativeDown,
        annualInterestRate: creativeInterestRate,
        amortizationYears: creativeAmortYears,
        balloonMaturityYears: creativeBalloonYears,
        isInterestOnly: creativeIsIO,
        rehabMakeReady: creativeRehab,
        assignmentFee: creativeAssignmentFee,
        closingEscrowCosts: creativeClosingCosts,
        monthlyMarketRent: creativeRent,
        monthlyTaxes: creativeTaxes,
        monthlyInsurance: creativeInsurance,
        monthlyHoa: creativeHoa,
      },
      includeAssignabilityClause: includeAssignability,
    });
  }, [
    propertyAddress,
    sellerName,
    acquisitionsCompany,
    selectedProposalOptions,
    closingDays,
    cashMetrics,
    subtoMetrics,
    subtoPrice,
    subtoCashToSeller,
    subtoArrears,
    subtoRehab,
    subtoAssignmentFee,
    subtoClosingCosts,
    liens,
    subtoRent,
    subtoTaxesIns,
    subtoHoa,
    creativeMetrics,
    creativePrice,
    creativeTargetList,
    creativeDown,
    creativeInterestRate,
    creativeAmortYears,
    creativeBalloonYears,
    creativeIsIO,
    creativeRehab,
    creativeAssignmentFee,
    creativeClosingCosts,
    creativeRent,
    creativeTaxes,
    creativeInsurance,
    creativeHoa,
    includeAssignability,
  ]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(proposalData.plainText);
      setCopySuccess("Text proposal copied to clipboard!");
      setTimeout(() => setCopySuccess(null), 4000);
    } catch {
      setCopySuccess("Failed to copy automatically. Please select text manually.");
      setTimeout(() => setCopySuccess(null), 4000);
    }
  };

  const handleSaveTermsToProperty = async () => {
    setSavingToCrm(true);
    setSaveSuccessMsg(null);
    try {
      const activeFee =
        tab === "cash"
          ? cashAssignmentFee
          : tab === "creative"
          ? creativeAssignmentFee
          : subtoAssignmentFee;

      const activeOffer =
        tab === "cash"
          ? cashMetrics.netWholesaleOffer
          : tab === "creative"
          ? creativePrice
          : subtoPrice;

      const parsedAddr = parseAddressString(propertyAddress);
      const customFieldsUpdate = [
        ...(property?.customFields || []).filter(
          (c) =>
            !c.name.toLowerCase().includes("arv") &&
            !c.name.toLowerCase().includes("repairs") &&
            !c.name.toLowerCase().includes("assignment fee") &&
            !c.name.toLowerCase().includes("purchase price") &&
            !c.name.toLowerCase().includes("property address")
        ),
        { id: "cf_arv", name: "ARV", type: "currency", value: String(cashArv) },
        { id: "cf_repairs", name: "Repairs", type: "currency", value: String(cashRepairs) },
        { id: "cf_fee", name: "Projected Assignment Fee", type: "currency", value: String(activeFee) },
        { id: "cf_offer", name: "Underwritten Purchase Price", type: "currency", value: String(activeOffer) },
      ];

      if (parsedAddr.address) {
        customFieldsUpdate.push({
          id: "cf_prop_address",
          name: "Property address",
          type: "text",
          value: propertyAddress,
        });
      }

      if (property?.id) {
        const updatePayload: Partial<ClientInput> = {
          dealValue: activeOffer,
          customFields: customFieldsUpdate,
        };
        if (parsedAddr.address) {
          updatePayload.address = parsedAddr.address;
          if (parsedAddr.city) updatePayload.city = parsedAddr.city;
          if (parsedAddr.state) updatePayload.state = parsedAddr.state;
          if (parsedAddr.zip) updatePayload.zip = parsedAddr.zip;
          updatePayload.companyName = propertyAddress;
        }
        if (sellerName) {
          updatePayload.contactName = sellerName;
        }

        const res = await api.updateClient(property.id, updatePayload);
        if (res.client) {
          onUpdated?.(res.client);
          setSaveSuccessMsg("Saved underwritten terms & address directly to property lead!");
          setTimeout(() => setSaveSuccessMsg(null), 5000);
        }
      } else {
        const createPayload: ClientInput = {
          companyName: propertyAddress || "New Property Underwritten",
          contactName: sellerName || "Unknown Owner",
          email: recipientEmail || "",
          dealValue: activeOffer,
          stage: "Leads",
          address: parsedAddr.address || propertyAddress,
          city: parsedAddr.city,
          state: parsedAddr.state,
          zip: parsedAddr.zip,
          leadSource: property?.leadSource || "Deal Underwriter",
          customFields: customFieldsUpdate,
        };
        const res = await api.createClient(createPayload);
        if (res.client) {
          onUpdated?.(res.client);
          setSaveSuccessMsg("Created new underwritten property lead in your pipeline!");
          setTimeout(() => setSaveSuccessMsg(null), 5000);
        }
      }
    } catch (err: any) {
      setSaveSuccessMsg("Error saving: " + (err.message || String(err)));
    } finally {
      setSavingToCrm(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1250px",
          maxHeight: "94vh",
          backgroundColor: "var(--panel, #121216)",
          color: "var(--ink, #f8fafc)",
          border: "1px solid var(--border, #30363d)",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border, #30363d)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--panel-2, #16161b)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>📐</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--ink, #f8fafc)", letterSpacing: "-0.01em" }}>
                Revzenta Deal Underwriter™
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted, #94a3b8)" }}>
                Proprietary Acquisitions Modeling • Cash Wholesale MAO • Seller Financing • Subject-To
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              fontSize: "16px",
              cursor: "pointer",
              background: "var(--panel, #121216)",
              border: "1px solid var(--border, #30363d)",
              color: "var(--ink, #f8fafc)",
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Persistent Property & Deal Header */}
        <div
          style={{
            padding: "12px 24px",
            backgroundColor: "var(--panel-2, #16161b)",
            borderBottom: "1px solid var(--border, #30363d)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "320px" }}>
            <span style={{ fontSize: "20px" }}>📍</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#38bdf8", letterSpacing: "0.05em" }}>
                  Property Address
                </label>
                {property && (
                  <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 600 }}>
                    Linked to Property #{property.id}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="Enter property address (e.g. 1244 E Highland Ave, Phoenix, AZ 85014)..."
                style={{
                  width: "100%",
                  height: "38px",
                  padding: "0 12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "1px solid var(--border, #30363d)",
                  backgroundColor: "var(--panel, #121216)",
                  color: "var(--ink, #f8fafc)",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "200px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted, #94a3b8)", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Seller / Owner Name
              </label>
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Owner name (optional)"
                style={{
                  width: "100%",
                  height: "38px",
                  padding: "0 12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "1px solid var(--border, #30363d)",
                  backgroundColor: "var(--panel, #121216)",
                  color: "var(--ink, #f8fafc)",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignSelf: "flex-end" }}>
              <button
                type="button"
                onClick={handleSaveTermsToProperty}
                disabled={savingToCrm}
                style={{
                  height: "38px",
                  padding: "0 18px",
                  fontWeight: 700,
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--lime, #d6ff3f)",
                  color: "var(--lime-ink, #0c0d08)",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                <span>💾</span>
                <span>{savingToCrm ? "Saving…" : property ? "Save to Property" : "Save as New Property"}</span>
              </button>
            </div>
          </div>
          {saveSuccessMsg && (
            <div style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", fontSize: "12px", fontWeight: 700 }}>
              {saveSuccessMsg}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "var(--panel-2, #16161b)",
            padding: "12px 24px",
            gap: "10px",
            borderBottom: "1px solid var(--border, #30363d)",
            overflowX: "auto",
          }}
        >
          {[
            { id: "proposal" as const, icon: "📋", label: "Multi-Option LOI & Proposal" },
            { id: "cash" as const, icon: "💵", label: "Cash Wholesale & MAO" },
            { id: "creative" as const, icon: "🤝", label: "Seller Financing (Owner Carry)" },
            { id: "subto" as const, icon: "🏦", label: "Subject-To (Mortgage Takeover)" },
          ].map((item) => {
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: isActive ? "1px solid #38bdf8" : "1px solid var(--border, #30363d)",
                  background: isActive
                    ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                    : "var(--panel, #121216)",
                  color: isActive ? "#ffffff" : "var(--ink-dim, #cfcec8)",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  whiteSpace: "nowrap",
                  boxShadow: isActive ? "0 2px 8px rgba(2, 132, 199, 0.35)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* ================================================================ */}
          {/* TAB 1: MULTI-OPTION LOI & PROPOSAL */}
          {/* ================================================================ */}
          {tab === "proposal" && (
            <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "20px" }}>
              {/* Controls Column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "var(--panel-2, #16161b)", padding: "18px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: 700, color: "var(--ink, #f8fafc)" }}>
                    Proposal Settings
                  </h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px", color: "var(--ink, #f8fafc)" }}>
                        Property Address
                      </span>
                      <input
                        type="text"
                        value={propertyAddress}
                        onChange={(e) => setPropertyAddress(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid var(--border, #30363d)", background: "var(--panel, #121216)", color: "var(--ink, #f8fafc)", outline: "none", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px", color: "var(--ink, #f8fafc)" }}>
                        Seller / Owner Name
                      </span>
                      <input
                        type="text"
                        value={sellerName}
                        onChange={(e) => setSellerName(e.target.value)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid var(--border, #30363d)", background: "var(--panel, #121216)", color: "var(--ink, #f8fafc)", outline: "none", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px", color: "var(--ink, #f8fafc)" }}>
                        Buyer Vesting Entity
                      </span>
                      <input
                        type="text"
                        value={acquisitionsCompany}
                        onChange={(e) => setAcquisitionsCompany(e.target.value)}
                        placeholder="Revzenta Capital"
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid var(--border, #30363d)", background: "var(--panel, #121216)", color: "var(--ink, #f8fafc)", outline: "none", fontSize: "13px" }}
                      />
                    </div>

                    <div style={{ borderTop: "1px solid var(--border, #30363d)", paddingTop: "12px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "8px", color: "var(--ink, #f8fafc)" }}>
                        Include Purchase Options:
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {[
                          { id: "cash" as const, label: "Immediate All-Cash ($" + cashMetrics.netWholesaleOffer.toLocaleString() + ")" },
                          { id: "subto" as const, label: "Subject-To Mortgage Takeover" },
                          { id: "creative" as const, label: "Seller Financing ($" + creativePrice.toLocaleString() + ")" },
                        ].map((opt) => (
                          <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer", color: "var(--ink, #f8fafc)" }}>
                            <input
                              type="checkbox"
                              checked={selectedProposalOptions.includes(opt.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProposalOptions([...selectedProposalOptions, opt.id]);
                                } else {
                                  if (selectedProposalOptions.length > 1) {
                                    setSelectedProposalOptions(selectedProposalOptions.filter((x) => x !== opt.id));
                                  }
                                }
                              }}
                            />
                            <span style={{ fontWeight: 600 }}>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        id="assignClause"
                        checked={includeAssignability}
                        onChange={(e) => setIncludeAssignability(e.target.checked)}
                      />
                      <label htmlFor="assignClause" style={{ fontSize: "12px", cursor: "pointer", fontWeight: 600, color: "var(--ink, #f8fafc)" }}>
                        Include Assignability Clause
                      </label>
                    </div>

                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px", color: "var(--ink, #f8fafc)" }}>
                        Closing Timeline (Days)
                      </span>
                      <input
                        type="number"
                        min={3}
                        max={90}
                        value={closingDays}
                        onChange={(e) => setClosingDays(Number(e.target.value) || 14)}
                        style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", border: "1px solid var(--border, #30363d)", background: "var(--panel, #121216)", color: "var(--ink, #f8fafc)", outline: "none", fontSize: "13px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      padding: "10px",
                      fontWeight: 700,
                      backgroundColor: "var(--lime, #d6ff3f)",
                      color: "var(--lime-ink, #0c0d08)",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    onClick={handleCopyText}
                  >
                    📋 Copy Text LOI
                  </button>
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      padding: "10px",
                      fontWeight: 600,
                      backgroundColor: "var(--panel-2, #16161b)",
                      color: "var(--ink, #f8fafc)",
                      border: "1px solid var(--border, #30363d)",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    onClick={handleSaveTermsToProperty}
                    disabled={savingToCrm}
                  >
                    {savingToCrm ? "Saving..." : "💾 Save Terms & Fee to Property"}
                  </button>

                  {copySuccess && (
                    <div style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", fontSize: "12px", textAlign: "center", fontWeight: 700 }}>
                      {copySuccess}
                    </div>
                  )}
                  {saveSuccessMsg && (
                    <div style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", fontSize: "12px", textAlign: "center", fontWeight: 700 }}>
                      {saveSuccessMsg}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setViewMode("formatted")}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: viewMode === "formatted" ? "1px solid #38bdf8" : "1px solid var(--border, #30363d)",
                        background: viewMode === "formatted" ? "var(--primary, #0284c7)" : "var(--panel-2, #16161b)",
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      Executive Formatted
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("plain")}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: viewMode === "plain" ? "1px solid #38bdf8" : "1px solid var(--border, #30363d)",
                        background: viewMode === "plain" ? "var(--primary, #0284c7)" : "var(--panel-2, #16161b)",
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      Plain Text / Email
                    </button>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", fontWeight: 500 }}>
                    Live Synchronized Proposal
                  </span>
                </div>

                <div
                  style={{
                    background: "var(--panel-2, #16161b)",
                    borderRadius: "10px",
                    border: "1px solid var(--border, #30363d)",
                    padding: "20px",
                    minHeight: "500px",
                    maxHeight: "680px",
                    overflowY: "auto",
                  }}
                >
                  {viewMode === "formatted" ? (
                    <div dangerouslySetInnerHTML={{ __html: proposalData.htmlMarkup }} />
                  ) : (
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "13px", lineHeight: "1.6", margin: 0, color: "var(--ink, #f8fafc)", background: "var(--panel, #121216)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      {proposalData.plainText}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: CASH WHOLESALE & MAO */}
          {/* ================================================================ */}
          {tab === "cash" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "24px" }}>
              {/* Inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                    Property Valuation & Rehab Scope
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <CurrencyField label="After-Repair Value (ARV)" value={cashArv} onChange={setCashArv} hint="Appraised retail" />
                    <CurrencyField label="Estimated Repairs" value={cashRepairs} onChange={setCashRepairs} hint="Scope of rehab" />
                    <NumberField label="Target Investor Rule" value={cashInvestorRule} onChange={setCashInvestorRule} suffix="%" hint="Usually 70% or 75%" />
                    <CurrencyField label="Wholesale Assignment Fee" value={cashAssignmentFee} onChange={setCashAssignmentFee} hint="Your net fee" />
                  </div>
                </div>

                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                    Wholesale MAO Breakdown
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border, #30363d)", color: "var(--ink, #f8fafc)" }}>
                      <span>1. ARV × Investor Target ({cashInvestorRule}%):</span>
                      <strong style={{ fontSize: "15px", color: "var(--ink, #f8fafc)" }}>
                        ${Math.round(cashArv * (cashInvestorRule / 100)).toLocaleString()}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border, #30363d)", color: "var(--ink, #f8fafc)" }}>
                      <span>2. Less Estimated Rehab:</span>
                      <span style={{ color: "#f87171", fontWeight: 700, fontSize: "14px" }}>
                        -${cashRepairs.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border, #30363d)", color: "var(--ink, #f8fafc)" }}>
                      <span>3. Less Buyer Closing Friction (1.5%):</span>
                      <span style={{ color: "#f87171", fontWeight: 700, fontSize: "14px" }}>
                        -${cashMetrics.buyerClosingCostAmount.toLocaleString()}
                      </span>
                    </div>
                    
                    {/* Highlight MAO Row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                      <span style={{ fontWeight: 800, color: "#38bdf8", fontSize: "14px" }}>
                        Gross Max Allowable Offer (MAO):
                      </span>
                      <span style={{ color: "#38bdf8", fontWeight: 900, fontSize: "17px" }}>
                        ${cashMetrics.maxAllowableOffer.toLocaleString()}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border, #30363d)", color: "var(--ink, #f8fafc)" }}>
                      <span>4. Less Wholesale Assignment Fee:</span>
                      <span style={{ color: "#34d399", fontWeight: 800, fontSize: "15px" }}>
                        -${cashAssignmentFee.toLocaleString()}
                      </span>
                    </div>

                    {/* Prominent Offer Box */}
                    <div style={{ marginTop: "8px", padding: "16px 18px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", border: "2px solid #10b981", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                          YOUR NET PURCHASE OFFER TO SELLER
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", marginTop: "2px" }}>
                          Contract purchase price written on state PSA
                        </div>
                      </div>
                      <div style={{ fontSize: "24px", fontWeight: 900, color: "#10b981" }}>
                        ${cashMetrics.netWholesaleOffer.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Viability & End Buyer Output */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Viability Card */}
                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                        Revzenta Deal Viability Index
                      </h3>
                      <span style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", fontWeight: 600 }}>
                        {currentViability.verdict}
                      </span>
                    </div>
                    <span style={{ fontSize: "22px", fontWeight: 900, color: currentViability.score >= 80 ? "#10b981" : currentViability.score >= 60 ? "#f59e0b" : "#ef4444" }}>
                      {currentViability.score}/100 ({currentViability.grade})
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {currentViability.checks.map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", padding: "8px 12px", borderRadius: "6px", background: "var(--panel, #121216)", border: "1px solid var(--border, #30363d)" }}>
                        <span style={{ color: "var(--ink, #f8fafc)", fontWeight: 600 }}>{c.title}</span>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: "var(--ink, #f8fafc)" }}>{c.metricValue}</span>
                          <span style={{ fontWeight: 800, color: c.status === "passed" ? "#10b981" : c.status === "warning" ? "#f59e0b" : "#ef4444" }}>
                            {c.status === "passed" ? "✓" : c.status === "warning" ? "!" : "✕"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cash Buyer Pitch Box */}
                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                    Cash Buyer Metrics (Pitch Deck)
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Buyer Purchase Price
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink, #f8fafc)", marginTop: "4px", display: "block" }}>
                        ${(cashMetrics.netWholesaleOffer + cashAssignmentFee).toLocaleString()}
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Projected Flip Profit
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "#10b981", marginTop: "4px", display: "block" }}>
                        ${cashMetrics.investorGrossProfit.toLocaleString()}
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Buyer Target ROI
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "#38bdf8", marginTop: "4px", display: "block" }}>
                        {cashMetrics.investorROI.toFixed(1)}%
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Your Assignment Fee
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "#a855f7", marginTop: "4px", display: "block" }}>
                        ${cashAssignmentFee.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: SELLER FINANCING (CREATIVE TERMS) */}
          {/* ================================================================ */}
          {tab === "creative" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "24px" }}>
              {/* Inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                    Note Terms & Purchase Price
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <CurrencyField label="Purchase Price" value={creativePrice} onChange={setCreativePrice} />
                    <CurrencyField label="Down Payment" value={creativeDown} onChange={setCreativeDown} hint={creativeMetrics.downPaymentPct.toFixed(1) + "% down"} />
                    <NumberField label="Annual Interest Rate" value={creativeInterestRate} onChange={setCreativeInterestRate} suffix="%" step={0.25} />
                    <NumberField label="Amortization Schedule" value={creativeAmortYears} onChange={setCreativeAmortYears} suffix=" yrs" />
                    <NumberField label="Balloon Term Due" value={creativeBalloonYears} onChange={setCreativeBalloonYears} suffix=" yrs" />
                    <CurrencyField label="Wholesale Assignment Fee" value={creativeAssignmentFee} onChange={setCreativeAssignmentFee} />
                  </div>

                  <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      id="isIOCheck"
                      checked={creativeIsIO}
                      onChange={(e) => setCreativeIsIO(e.target.checked)}
                    />
                    <label htmlFor="isIOCheck" style={{ fontSize: "12px", cursor: "pointer", fontWeight: 700, color: "var(--ink, #f8fafc)" }}>
                      Interest-Only (I/O) Monthly Payments
                    </label>
                  </div>
                </div>

                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                    Property Revenue & Holding Costs
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <CurrencyField label="Expected Monthly Rent" value={creativeRent} onChange={setCreativeRent} hint="Gross rental revenue" />
                    <CurrencyField label="Monthly Property Taxes" value={creativeTaxes} onChange={setCreativeTaxes} />
                    <CurrencyField label="Monthly Hazard Insurance" value={creativeInsurance} onChange={setCreativeInsurance} />
                    <CurrencyField label="Monthly HOA (if any)" value={creativeHoa} onChange={setCreativeHoa} />
                  </div>
                </div>
              </div>

              {/* Viability & Summary Output */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Scorecard */}
                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                        Deal Viability Index
                      </h3>
                      <span style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", fontWeight: 600 }}>
                        {currentViability.verdict}
                      </span>
                    </div>
                    <span style={{ fontSize: "22px", fontWeight: 900, color: currentViability.score >= 80 ? "#10b981" : currentViability.score >= 60 ? "#f59e0b" : "#ef4444" }}>
                      {currentViability.score}/100 ({currentViability.grade})
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {currentViability.checks.map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", padding: "8px 12px", borderRadius: "6px", background: "var(--panel, #121216)", border: "1px solid var(--border, #30363d)" }}>
                        <span style={{ color: "var(--ink, #f8fafc)", fontWeight: 600 }}>{c.title}</span>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: "var(--ink, #f8fafc)" }}>{c.metricValue}</span>
                          <span style={{ fontWeight: 800, color: c.status === "passed" ? "#10b981" : c.status === "warning" ? "#f59e0b" : "#ef4444" }}>
                            {c.status === "passed" ? "✓" : c.status === "warning" ? "!" : "✕"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seller Finance Economics Output */}
                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                    Owner Carry Note Economics
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Monthly Note Payment (P&I)
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink, #f8fafc)", marginTop: "4px", display: "block" }}>
                        ${Math.round(creativeMetrics.monthlyDebtService).toLocaleString()}/mo
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Net Monthly Cash Flow
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: creativeMetrics.netMonthlyCashFlow >= 0 ? "#10b981" : "#ef4444", marginTop: "4px", display: "block" }}>
                        ${Math.round(creativeMetrics.netMonthlyCashFlow).toLocaleString()}/mo
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Cash-on-Cash Return
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "#10b981", marginTop: "4px", display: "block" }}>
                        {creativeMetrics.cashOnCashReturn.toFixed(1)}%
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Buyer Total Entry Capital
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink, #f8fafc)", marginTop: "4px", display: "block" }}>
                        ${creativeMetrics.totalBuyerEntryCapital.toLocaleString()}
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Balloon Payoff ({creativeBalloonYears} yr)
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink, #f8fafc)", marginTop: "4px", display: "block" }}>
                        ${Math.round(creativeMetrics.balloonRemainingBalance).toLocaleString()}
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Total Paid to Seller
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "#38bdf8", marginTop: "4px", display: "block" }}>
                        ${Math.round(creativeMetrics.totalPayoutToSeller).toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 4: SUBJECT-TO (SUBTO) MORTGAGE TAKEOVER */}
          {/* ================================================================ */}
          {tab === "subto" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "24px" }}>
              {/* Inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                    Existing Debt Portfolios (Mortgage Liens)
                  </h3>
                  {liens.map((lien, index) => (
                    <div key={lien.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "12px", marginBottom: "14px", alignItems: "end" }}>
                      <div>
                        <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                          Lien Label
                        </span>
                        <input
                          type="text"
                          value={lien.label}
                          onChange={(e) => {
                            const next = [...liens];
                            next[index].label = e.target.value;
                            setLiens(next);
                          }}
                          style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "7px", border: "1px solid var(--border, #30363d)", background: "var(--panel, #121216)", color: "var(--ink, #f8fafc)", outline: "none", fontSize: "14px", fontWeight: 600, boxSizing: "border-box" }}
                        />
                      </div>
                      <CurrencyField
                        label="Balance"
                        value={lien.unpaidPrincipalBalance}
                        onChange={(val) => {
                          const next = [...liens];
                          next[index].unpaidPrincipalBalance = val;
                          setLiens(next);
                        }}
                      />
                      <NumberField
                        label="Rate %"
                        value={lien.interestRate}
                        onChange={(val) => {
                          const next = [...liens];
                          next[index].interestRate = val;
                          setLiens(next);
                        }}
                        suffix="%"
                        step={0.125}
                      />
                      <CurrencyField
                        label="PITI Payment"
                        value={lien.monthlyPaymentPITI}
                        onChange={(val) => {
                          const next = [...liens];
                          next[index].monthlyPaymentPITI = val;
                          setLiens(next);
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                    Cash-to-Seller & Entry Costs
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <CurrencyField label="Contract Purchase Price" value={subtoPrice} onChange={setSubtoPrice} />
                    <CurrencyField label="Cash to Seller at Closing" value={subtoCashToSeller} onChange={setSubtoCashToSeller} hint="Seller walkaway cash" />
                    <CurrencyField label="Arrears / Reinstatement" value={subtoArrears} onChange={setSubtoArrears} hint="Catch up missed payments" />
                    <CurrencyField label="Wholesale Assignment Fee" value={subtoAssignmentFee} onChange={setSubtoAssignmentFee} hint="Your net spread" />
                    <CurrencyField label="Monthly Market Rent" value={subtoRent} onChange={setSubtoRent} />
                    <CurrencyField label="Taxes & Insurance (if not in PITI)" value={subtoTaxesIns} onChange={setSubtoTaxesIns} />
                  </div>
                </div>
              </div>

              {/* Viability & Summary Output */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Scorecard */}
                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                        Deal Viability Index
                      </h3>
                      <span style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", fontWeight: 600 }}>
                        {currentViability.verdict}
                      </span>
                    </div>
                    <span style={{ fontSize: "22px", fontWeight: 900, color: currentViability.score >= 80 ? "#10b981" : currentViability.score >= 60 ? "#f59e0b" : "#ef4444" }}>
                      {currentViability.score}/100 ({currentViability.grade})
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {currentViability.checks.map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", padding: "8px 12px", borderRadius: "6px", background: "var(--panel, #121216)", border: "1px solid var(--border, #30363d)" }}>
                        <span style={{ color: "var(--ink, #f8fafc)", fontWeight: 600 }}>{c.title}</span>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: "var(--ink, #f8fafc)" }}>{c.metricValue}</span>
                          <span style={{ fontWeight: 800, color: c.status === "passed" ? "#10b981" : c.status === "warning" ? "#f59e0b" : "#ef4444" }}>
                            {c.status === "passed" ? "✓" : c.status === "warning" ? "!" : "✕"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SubTo Metrics Summary */}
                <div style={{ background: "var(--panel-2, #16161b)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border, #30363d)" }}>
                  <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: 800, color: "var(--ink, #f8fafc)" }}>
                    Mortgage Assumption Economics
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Total Debt Taken Over
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "#38bdf8", marginTop: "4px", display: "block" }}>
                        ${subtoMetrics.totalExistingDebt.toLocaleString()}
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Monthly Debt Service
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink, #f8fafc)", marginTop: "4px", display: "block" }}>
                        ${Math.round(subtoMetrics.totalMonthlyDebtService).toLocaleString()}/mo
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Net Monthly Cash Flow
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: subtoMetrics.netMonthlyCashFlow >= 0 ? "#10b981" : "#ef4444", marginTop: "4px", display: "block" }}>
                        ${Math.round(subtoMetrics.netMonthlyCashFlow).toLocaleString()}/mo
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Total Buyer Entry Capital
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "#10b981", marginTop: "4px", display: "block" }}>
                        ${subtoMetrics.totalBuyerEntryCapital.toLocaleString()} ({subtoMetrics.entryCapitalPct.toFixed(1)}%)
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Cash-on-Cash Return
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "#10b981", marginTop: "4px", display: "block" }}>
                        {subtoMetrics.cashOnCashReturn.toFixed(1)}%
                      </strong>
                    </div>

                    <div style={{ background: "var(--panel, #121216)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border, #30363d)" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                        Captured Equity Spread
                      </span>
                      <strong style={{ fontSize: "18px", fontWeight: 800, color: "#38bdf8", marginTop: "4px", display: "block" }}>
                        ${subtoMetrics.sellerEquityCaptured.toLocaleString()} ({subtoMetrics.equityPct.toFixed(1)}%)
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border, #30363d)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--panel-2, #16161b)",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", fontWeight: 500 }}>
            Revzenta Acquisitions Engine • 100% Proprietary Underwriting
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid var(--border, #30363d)",
                background: "transparent",
                color: "var(--ink, #f8fafc)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveTermsToProperty}
              disabled={savingToCrm}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                background: "var(--lime, #d6ff3f)",
                color: "var(--lime-ink, #0c0d08)",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {savingToCrm ? "Saving…" : "Apply & Save to CRM"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
