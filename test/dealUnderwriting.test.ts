import { describe, expect, it } from "bun:test";
import {
  calculateCashWholesale,
  calculateSellerFinancing,
  calculateSubjectTo,
  evaluateDealViability,
  type CashDealInput,
  type SellerFinanceInput,
  type SubjectToInput,
} from "../src/dealUnderwriting";

describe("Deal Underwriting Core Engine", () => {
  describe("Cash Wholesale & MAO", () => {
    it("computes MAO correctly using 70% rule", () => {
      const input: CashDealInput = {
        arv: 300000,
        estimatedRepairs: 40000,
        targetInvestorRulePct: 70,
        wholesaleAssignmentFee: 10000,
        buyerClosingCostPct: 2.0,
      };

      const result = calculateCashWholesale(input);

      // Investor Buy Ceiling = (300,000 * 0.70) - 40,000 = 170,000
      expect(result.investorBuyCeiling).toBe(170000);
      // Closing costs = 300,000 * 0.02 = 6,000
      expect(result.buyerClosingCostAmount).toBe(6000);
      // MAO = 170,000 - 6,000 = 164,000
      expect(result.maxAllowableOffer).toBe(164000);
      // Net Wholesale Offer = 164,000 - 10,000 = 154,000
      expect(result.netWholesaleOffer).toBe(154000);
      expect(result.investorGrossProfit).toBeGreaterThan(0);
    });

    it("handles zero or negative inputs gracefully", () => {
      const result = calculateCashWholesale({
        arv: 0,
        estimatedRepairs: -100,
        targetInvestorRulePct: 0,
        wholesaleAssignmentFee: 0,
      });

      expect(result.maxAllowableOffer).toBe(0);
      expect(result.netWholesaleOffer).toBe(0);
      expect(result.investorROI).toBe(0);
    });
  });

  describe("Seller Financing Underwriting", () => {
    it("computes monthly payments and cash flow accurately", () => {
      const input: SellerFinanceInput = {
        purchasePrice: 250000,
        downPayment: 25000, // 10%
        annualInterestRate: 4.5,
        amortizationYears: 30,
        balloonMaturityYears: 5,
        monthlyMarketRent: 2200,
        monthlyTaxes: 200,
        monthlyInsurance: 100,
      };

      const result = calculateSellerFinancing(input);

      expect(result.principalLoanAmount).toBe(225000);
      expect(result.downPaymentPct).toBe(10);
      expect(result.monthlyDebtService).toBeGreaterThan(1000);
      expect(result.monthlyDebtService).toBeLessThan(1300);
      expect(result.netMonthlyCashFlow).toBeGreaterThan(0);
      expect(result.balloonRemainingBalance).toBeGreaterThan(150000);
    });
  });

  describe("Subject-To (SubTo) Underwriting", () => {
    it("calculates takeover debt, entry fees, and cash flow", () => {
      const input: SubjectToInput = {
        purchasePrice: 280000,
        cashToSeller: 15000,
        arrearsReinstatement: 5000,
        rehabMakeReady: 10000,
        assignmentFee: 10000,
        closingEscrowCosts: 3000,
        monthlyMarketRent: 2400,
        monthlyTaxesAndInsurance: 250,
        monthlyHoa: 0,
        liens: [
          {
            id: "1",
            label: "Primary Mortgage",
            unpaidPrincipalBalance: 210000,
            interestRate: 3.25,
            monthlyPaymentPITI: 1350,
          },
        ],
      };

      const result = calculateSubjectTo(input);

      expect(result.totalExistingDebt).toBe(210000);
      // Entry capital = 15,000 + 5,000 + 10,000 + 10,000 + 3,000 = 43,000
      expect(result.totalBuyerEntryCapital).toBe(43000);
      expect(result.totalMonthlyDebtService).toBe(1350);
      expect(result.netMonthlyCashFlow).toBeGreaterThan(0);
    });
  });

  describe("Deal Viability Index (DVI) Scorecard", () => {
    it("generates score between 0 and 100 with clear grades", () => {
      const cashRes = calculateCashWholesale({
        arv: 350000,
        estimatedRepairs: 30000,
        targetInvestorRulePct: 70,
        wholesaleAssignmentFee: 15000,
      });

      const scorecard = evaluateDealViability('cash', {
        investorROI: cashRes.investorROI,
        netWholesaleOffer: cashRes.netWholesaleOffer,
        maxAllowableOffer: cashRes.maxAllowableOffer,
      });

      expect(scorecard.score).toBeGreaterThanOrEqual(0);
      expect(scorecard.score).toBeLessThanOrEqual(100);
      expect(["A+", "A", "B", "C", "D", "F"]).toContain(scorecard.grade);
      expect(scorecard.checks.length).toBeGreaterThan(0);
    });
  });
});
