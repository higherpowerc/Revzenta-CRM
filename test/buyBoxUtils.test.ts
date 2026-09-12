import { describe, expect, it } from "bun:test";
import {
  evaluateMatch,
  getPropertyPrice,
  getBuyerMaxBudget,
} from "../src/buyBoxUtils";
import type { Client } from "../src/types";

describe("Buy Box Matching Engine", () => {
  const mockProperty: Client = {
    id: 1,
    companyName: "123 Maple St, Dallas TX",
    contactName: "Seller Bob",
    email: "seller@example.com",
    phone: "214-555-0100",
    industry: "real_estate",
    services: [],
    customFields: [
      { name: "Purchase Price", value: "$175,000" },
      { name: "County", value: "Dallas" },
      { name: "Strategy", value: "Fix & Flip" },
    ],
    dealValue: 175000,
    stage: "Contract",
    nextAction: "",
    notes: "",
    archived: false,
    clientType: "single_family",
    address: "123 Maple St",
    city: "Dallas",
    state: "TX",
    zip: "75201",
    website: "",
    leadSource: "Direct Mail",
    lost: false,
    lostReason: "",
    dnc: false,
    dncReason: "",
    dncDate: "",
    monthlyAmount: 0,
  };

  const matchingBuyer: Client = {
    id: 2,
    companyName: "Lone Star Capital LLC",
    contactName: "Cash Buyer Bill",
    email: "bill@lonestar.com",
    phone: "214-555-0200",
    industry: "investor",
    services: [],
    customFields: [
      { name: "Max Budget", value: "$200,000" },
      { name: "Target Markets", value: "Dallas, Tarrant" },
      { name: "Investment Strategy", value: "Fix & Flip, Buy & Hold" },
    ],
    dealValue: 200000,
    stage: "Buyer",
    nextAction: "",
    notes: "",
    archived: false,
    clientType: "buyer",
    address: "",
    city: "Dallas",
    state: "TX",
    zip: "",
    website: "",
    leadSource: "Referral",
    lost: false,
    lostReason: "",
    dnc: false,
    dncReason: "",
    dncDate: "",
    monthlyAmount: 0,
  };

  const lowBudgetBuyer: Client = {
    ...matchingBuyer,
    id: 3,
    dealValue: 120000,
    customFields: [{ name: "Max Budget", value: "$120,000" }],
  };

  it("extracts property and buyer pricing correctly", () => {
    expect(getPropertyPrice(mockProperty)).toBe(175000);
    expect(getBuyerMaxBudget(matchingBuyer)).toBe(200000);
    expect(getBuyerMaxBudget(lowBudgetBuyer)).toBe(120000);
  });

  it("matches property with qualified buyer and generates high score", () => {
    const match = evaluateMatch(mockProperty, matchingBuyer);
    expect(match).not.toBeNull();
    if (match) {
      expect(match.matchScore).toBeGreaterThan(50);
      expect(match.budgetFit).toBe(true);
      expect(match.reasons.length).toBeGreaterThan(0);
    }
  });

  it("handles budget mismatches appropriately", () => {
    const match = evaluateMatch(mockProperty, lowBudgetBuyer);
    if (match) {
      expect(match.budgetFit).toBe(false);
      expect(match.matchScore).toBeLessThan(70);
    }
  });
});
