import { describe, expect, it } from "vitest";
import { parseProfitabilityRequest } from "../features/profitability-check/server/request";

describe("profitability request parser", () => {
  it("parses a valid payload", () => {
    const parsed = parseProfitabilityRequest({
      industry: "Konsult",
      businessModel: "consulting",
      annualRevenueSek: 12000000,
      grossMarginPercent: 42,
      payrollCostSek: 4800000,
      fixedCostsSek: 1800000,
      arDays: 45,
      inventoryDays: 0,
      topCustomerSharePercent: 30,
      target12m: "Oka EBIT med 3 procentenheter",
      bottleneck: "utilization"
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.businessModel).toBe("consulting");
      expect(parsed.value.annualRevenueSek).toBe(12000000);
    }
  });

  it("returns error for invalid business model", () => {
    const parsed = parseProfitabilityRequest({
      industry: "Konsult",
      businessModel: "invalid",
      annualRevenueSek: 12000000,
      grossMarginPercent: 42,
      payrollCostSek: 4800000,
      fixedCostsSek: 1800000,
      arDays: 45,
      inventoryDays: 0,
      topCustomerSharePercent: 30,
      target12m: "Oka EBIT",
      bottleneck: "utilization"
    });

    expect(parsed.ok).toBe(false);
  });
});
