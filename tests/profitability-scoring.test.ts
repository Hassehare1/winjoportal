import { describe, expect, it } from "vitest";
import { calculateProfitabilityAssessment } from "../features/profitability-check/lib/scoring";

describe("profitability scoring", () => {
  it("produces high risk score for weak economics", () => {
    const result = calculateProfitabilityAssessment({
      industry: "Grossist",
      businessModel: "retail",
      annualRevenueSek: 12_000_000,
      grossMarginPercent: 18,
      payrollCostSek: 3_800_000,
      fixedCostsSek: 2_600_000,
      arDays: 70,
      inventoryDays: 120,
      topCustomerSharePercent: 52,
      target12m: "Forbattra kassaflode",
      bottleneck: "cashflow"
    });

    expect(result.riskLevel).toBe("High");
    expect(result.riskScore).toBeGreaterThanOrEqual(70);
    expect(result.ruleActions.length).toBeGreaterThanOrEqual(3);
  });

  it("produces lower risk score for strong profile", () => {
    const result = calculateProfitabilityAssessment({
      industry: "B2B SaaS",
      businessModel: "subscription",
      annualRevenueSek: 18_000_000,
      grossMarginPercent: 68,
      payrollCostSek: 5_100_000,
      fixedCostsSek: 2_100_000,
      arDays: 22,
      inventoryDays: 0,
      topCustomerSharePercent: 12,
      target12m: "Skala tillvaxt med bibehallen marginal",
      bottleneck: "sales"
    });

    expect(result.riskScore).toBeLessThan(40);
    expect(result.riskLevel).toBe("Low");
    expect(result.potentialRangeSek.midpoint).toBeGreaterThan(0);
  });
});
