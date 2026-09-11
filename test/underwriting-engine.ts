import { strict as assert } from "node:assert";
import {
  calculateUnderwriting,
  mapCotalityPayload,
  monthlyPayment,
  normalizeAddress,
} from "../src/underwritingEngine";

const profile = mapCotalityPayload({
  data: {
    annualPropertyTax: 6_000,
    estimatedMonthlyInsurance: 150,
    estimatedMarketValue: 500_000,
    fairMarketRent: 3_200,
    voluntaryMortgages: [{
      id: "senior-1",
      originalLoanAmount: 350_000,
      recordingDate: "2020-01-15",
      termMonths: 360,
      interestRate: 3.25,
      rateType: "Fixed",
      lienPosition: "First",
      lienType: "Mortgage",
    }],
  },
}, "123 Main St, Austin, TX 78701");

const result = calculateUnderwriting({
  profile,
  purchasePrice: 450_000,
  cashToSeller: 25_000,
  carrybackRate: 5,
  carrybackTermMonths: 120,
  sellerFinanceDownPayment: 45_000,
  sellerFinanceRate: 6,
  sellerFinanceAmortizationMonths: 360,
  sellerFinanceBalloonPaymentMonth: 60,
  wrapLoanAmount: 405_000,
  wrapRate: 7,
  wrapTermMonths: 360,
  asOf: new Date("2026-09-11T12:00:00Z"),
});

assert.equal(normalizeAddress("123 Main St, Austin, TX 78701").oneLine, "123 Main St, Austin, TX 78701");
assert.equal(result.activeLoans[0].elapsedMonths, 79);
assert.equal(result.subjectTo.cashToSeller, 25_000);
assert.ok(result.subjectTo.equitySpread > 0);
assert.ok(result.subjectTo.sellerCarrybackPrincipal < result.subjectTo.equitySpread);
assert.ok(result.subjectTo.buyerTotalMonthlyOutlay > result.underlyingPiti.totalMonthlyPiti);
assert.equal(result.sellerFinancing.eligible, false);
assert.ok(result.wrap.wrapSpread > 0);
assert.equal(monthlyPayment(120_000, 0, 360), 333.3333333333333);
console.log("underwriting-engine: all assertions passed");