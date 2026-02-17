import { describe, expect, it } from "vitest";
import { deriveMarginalLabDefaults, runMarginalLabScenario } from "@/features/marginal-lab/lib/model";

describe("marginal lab model", () => {
  it("keeps delta at zero for no-change scenario", () => {
    const result = runMarginalLabScenario({
      netSales: 1_000_000,
      marginPct: 50,
      discountPct: 0,
      returnRatePct: 0,
      mixLiftPctPoints: 0,
      stockDaysNow: 60,
      targetStockDays: 60,
      stockCostNow: 1_000_000
    });

    expect(result.monthlyGrossProfitDelta).toBeCloseTo(0, 6);
    expect(result.releasedCash).toBeCloseTo(0, 6);
    expect(result.additionalCashNeed).toBeCloseTo(0, 6);
    expect(result.adjustedMarginPct).toBeCloseTo(50, 6);
  });

  it("increases gross profit and releases cash for stronger scenario", () => {
    const result = runMarginalLabScenario({
      netSales: 1_000_000,
      marginPct: 48,
      discountPct: 0,
      returnRatePct: 0,
      mixLiftPctPoints: 4,
      stockDaysNow: 80,
      targetStockDays: 50,
      stockCostNow: 1_500_000
    });

    expect(result.monthlyGrossProfitDelta).toBeGreaterThan(0);
    expect(result.releasedCash).toBeGreaterThan(0);
    expect(result.additionalCashNeed).toBe(0);
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
  });

  it("sanitizes invalid and out-of-range values", () => {
    const result = runMarginalLabScenario({
      netSales: -5,
      marginPct: 140,
      discountPct: -10,
      returnRatePct: 200,
      mixLiftPctPoints: 900,
      stockDaysNow: 0,
      targetStockDays: 999,
      stockCostNow: -2
    });

    expect(result.normalized.netSales).toBe(0);
    expect(result.normalized.marginPct).toBe(95);
    expect(result.normalized.discountPct).toBe(0);
    expect(result.normalized.returnRatePct).toBe(95);
    expect(result.normalized.mixLiftPctPoints).toBe(30);
    expect(result.normalized.stockDaysNow).toBe(1);
    expect(result.normalized.targetStockDays).toBe(365);
    expect(result.normalized.stockCostNow).toBe(0);
  });

  it("derives defaults from summary seed", () => {
    const defaults = deriveMarginalLabDefaults({
      netSales: 4_821_389.81,
      grossMarginPercent: 49.5,
      estimatedStockValue: 10_308_958.49
    });

    expect(defaults.netSales).toBeCloseTo(4_821_389.81, 6);
    expect(defaults.marginPct).toBeCloseTo(49.5, 6);
    expect(defaults.stockCostNow).toBeCloseTo(10_308_958.49, 6);
    expect(defaults.targetStockDays).toBeLessThanOrEqual(defaults.stockDaysNow);
  });
});
