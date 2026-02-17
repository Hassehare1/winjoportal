import { describe, expect, it } from "vitest";
import {
  deriveCashflowWeatherDefaults,
  runCashflowWeather,
  sanitizeCashflowWeatherInputs
} from "@/features/cashflow-weather/lib/model";

describe("cashflow weather model", () => {
  it("builds 30/60/90 forecast points", () => {
    const result = runCashflowWeather({
      netSales: 1_000_000,
      marginPct: 45,
      estimatedStockValue: 1_100_000,
      monthlyTrendPct: 0,
      fixedCostsMonthly: 300_000,
      arDays: 32,
      targetArDays: 24,
      cashBuffer: 0
    });

    expect(result.points).toHaveLength(3);
    expect(result.points.map((p) => p.horizonDays)).toEqual([30, 60, 90]);
    expect(result.inventoryDays).toBeGreaterThan(0);
  });

  it("reduces risk when AR days are lowered", () => {
    const highAr = runCashflowWeather({
      netSales: 1_000_000,
      marginPct: 45,
      estimatedStockValue: 900_000,
      monthlyTrendPct: 0,
      fixedCostsMonthly: 350_000,
      arDays: 60,
      targetArDays: 30,
      cashBuffer: 0
    });

    const lowAr = runCashflowWeather({
      netSales: 1_000_000,
      marginPct: 45,
      estimatedStockValue: 900_000,
      monthlyTrendPct: 0,
      fixedCostsMonthly: 350_000,
      arDays: 25,
      targetArDays: 20,
      cashBuffer: 0
    });

    expect(highAr.points[0].riskScore).toBeGreaterThan(lowAr.points[0].riskScore);
  });

  it("improves cash effect when AP days increase", () => {
    const lowAp = runCashflowWeather({
      netSales: 1_000_000,
      marginPct: 45,
      estimatedStockValue: 900_000,
      monthlyTrendPct: 6,
      fixedCostsMonthly: 350_000,
      arDays: 30,
      targetArDays: 24,
      apDays: 10,
      cashBuffer: 0,
      creditLine: 0
    });

    const highAp = runCashflowWeather({
      netSales: 1_000_000,
      marginPct: 45,
      estimatedStockValue: 900_000,
      monthlyTrendPct: 6,
      fixedCostsMonthly: 350_000,
      arDays: 30,
      targetArDays: 24,
      apDays: 45,
      cashBuffer: 0,
      creditLine: 0
    });

    expect(highAp.points[2].netCash).toBeGreaterThan(lowAp.points[2].netCash);
  });

  it("uses credit line before reporting uncovered deficit", () => {
    const withoutCredit = runCashflowWeather({
      netSales: 2_000_000,
      marginPct: 35,
      estimatedStockValue: 3_200_000,
      monthlyTrendPct: 12,
      fixedCostsMonthly: 1_200_000,
      arDays: 75,
      targetArDays: 25,
      apDays: 20,
      cashBuffer: 0,
      creditLine: 0
    });

    const withCredit = runCashflowWeather({
      netSales: 2_000_000,
      marginPct: 35,
      estimatedStockValue: 3_200_000,
      monthlyTrendPct: 12,
      fixedCostsMonthly: 1_200_000,
      arDays: 75,
      targetArDays: 25,
      apDays: 20,
      cashBuffer: 0,
      creditLine: 5_000_000
    });

    expect(withCredit.points[2].creditUsed).toBeGreaterThan(0);
    expect(withCredit.points[2].uncoveredDeficit).toBeLessThan(withoutCredit.points[2].uncoveredDeficit);
  });

  it("flags storm when trend and cost pressure are too high", () => {
    const result = runCashflowWeather({
      netSales: 2_000_000,
      marginPct: 35,
      estimatedStockValue: 3_200_000,
      monthlyTrendPct: -15,
      fixedCostsMonthly: 1_200_000,
      arDays: 75,
      targetArDays: 25,
      cashBuffer: 0
    });

    expect(result.points[2].weather).toBe("Storm");
    expect(result.summaryLevel).toBe("Storm");
    expect(result.points[2].uncoveredDeficit).toBeGreaterThanOrEqual(0);
  });

  it("adds warning for high growth trend", () => {
    const result = runCashflowWeather({
      netSales: 2_000_000,
      marginPct: 45,
      estimatedStockValue: 2_200_000,
      monthlyTrendPct: 18,
      fixedCostsMonthly: 600_000,
      arDays: 35,
      targetArDays: 24,
      apDays: 30,
      cashBuffer: 250_000,
      creditLine: 500_000
    });

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("sanitizes out-of-range inputs and derives defaults from seed", () => {
    const sanitized = sanitizeCashflowWeatherInputs({
      netSales: -10,
      marginPct: 250,
      estimatedStockValue: -8,
      monthlyTrendPct: -200,
      fixedCostsMonthly: -99,
      arDays: 999,
      targetArDays: -1,
      apDays: 999,
      cashBuffer: -2,
      creditLine: -77
    });

    expect(sanitized.netSales).toBe(0);
    expect(sanitized.marginPct).toBe(95);
    expect(sanitized.estimatedStockValue).toBe(0);
    expect(sanitized.monthlyTrendPct).toBe(-35);
    expect(sanitized.fixedCostsMonthly).toBe(0);
    expect(sanitized.arDays).toBe(180);
    expect(sanitized.targetArDays).toBe(0);
    expect(sanitized.apDays).toBe(180);
    expect(sanitized.cashBuffer).toBe(0);
    expect(sanitized.creditLine).toBe(0);

    const defaults = deriveCashflowWeatherDefaults({
      netSales: 4_000_000,
      grossMarginPercent: 50,
      estimatedStockValue: 4_500_000,
      trendPct: -2
    });

    expect(defaults.netSales).toBeCloseTo(4_000_000, 6);
    expect(defaults.marginPct).toBeCloseTo(50, 6);
    expect(defaults.estimatedStockValue).toBeCloseTo(4_500_000, 6);
    expect(defaults.monthlyTrendPct).toBeCloseTo(-2, 6);
  });
});
