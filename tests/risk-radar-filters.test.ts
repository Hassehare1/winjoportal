import { describe, expect, it } from "vitest";
import {
  aggregateRiskRadarRows,
  applyRiskRadarFilters,
  buildRiskRadarSourceRows,
  computeDefaultRiskTbThreshold,
  deriveRiskLevel,
  filterRiskRadarSourceRows,
  getRiskRadarFilterOptions,
  parseRiskRadarFilters
} from "@/features/risk-radar/lib/filters";
import type { RiskRadarCell } from "@/features/risk-radar/lib/model";

function makeCell(overrides: Partial<RiskRadarCell>): RiskRadarCell {
  return {
    store: "Malmo",
    department: "Dam",
    netSales: 100000,
    grossProfit: 45000,
    grossMarginPercent: 45,
    estimatedStockValue: 200000,
    stockToSalesRatio: 2,
    riskScore: 50,
    severity: "Medium",
    reason: "test",
    ...overrides
  };
}

describe("risk radar filters", () => {
  it("calculates default risk TB threshold with clamp", () => {
    expect(computeDefaultRiskTbThreshold(49.5)).toBe(39.5);
    expect(computeDefaultRiskTbThreshold(80)).toBe(50);
    expect(computeDefaultRiskTbThreshold(25)).toBe(30);
    expect(computeDefaultRiskTbThreshold(null)).toBe(39.5);
  });

  it("parses selected filters from search params", () => {
    const options = {
      departments: ["Dam", "Kem", "Herr"],
      stores: ["Helsingborg", "Malmo"],
      years: ["2024", "2025"],
      monthNumbers: [1, 2, 3],
      periods: [
        { reportMonth: "2024-01", reportYear: "2024", reportMonthNumber: 1 },
        { reportMonth: "2024-02", reportYear: "2024", reportMonthNumber: 2 },
        { reportMonth: "2024-03", reportYear: "2024", reportMonthNumber: 3 }
      ]
    };

    const filters = parseRiskRadarFilters(
      {
        department: ["Dam", "Kem", "Ogiltig"],
        store: ["Malmo", "Ogiltig"],
        year: ["2024"],
        month_number: ["2", "3", "13"],
        risk_level: ["High", "Medium", "Invalid"],
        risk_tb_threshold: "37,2"
      },
      options,
      39.5
    );

    expect(filters.selectedDepartments).toEqual(["Dam", "Kem"]);
    expect(filters.selectedStores).toEqual(["Malmo"]);
    expect(filters.selectedYears).toEqual(["2024"]);
    expect(filters.selectedMonthNumbers).toEqual([2, 3]);
    expect(filters.selectedRiskLevels).toEqual(["High", "Medium"]);
    expect(filters.riskTbThreshold).toBe(37.2);
  });

  it("applies filters and derives severity from threshold", () => {
    const cells: RiskRadarCell[] = [
      makeCell({ store: "Malmo", department: "Dam", grossMarginPercent: 28, riskScore: 72 }),
      makeCell({ store: "Malmo", department: "Dam", grossMarginPercent: 36, riskScore: 52 }),
      makeCell({ department: "Herr", grossMarginPercent: 46, riskScore: 30 })
    ];

    expect(deriveRiskLevel(cells[0], 39.5)).toBe("High");
    expect(deriveRiskLevel(cells[1], 39.5)).toBe("Medium");
    expect(deriveRiskLevel(cells[2], 39.5)).toBe("Low");

    const filtered = applyRiskRadarFilters(cells, {
      selectedDepartments: ["Dam"],
      selectedStores: ["Malmo"],
      selectedYears: ["2024"],
      selectedMonthNumbers: [3],
      selectedRiskLevels: ["High", "Medium"],
      riskTbThreshold: 39.5
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.map((row) => row.derivedSeverity)).toEqual(["High", "Medium"]);
  });

  it("builds source rows, filters by year/month/store/department and aggregates", () => {
    const sourceRows = buildRiskRadarSourceRows({
      report_month: "2024-03",
      time_store_department_breakdown: [
        {
          report_month: "2024-02",
          report_year: "2024",
          report_month_number: 2,
          filial: "EBB_Malmo",
          avdelning: "Dam",
          net_sales: 100,
          gross_profit: 40,
          estimated_stock_value: 200
        },
        {
          report_month: "2024-03",
          report_year: "2024",
          report_month_number: 3,
          filial: "EBB_Malmo",
          avdelning: "Dam",
          net_sales: 120,
          gross_profit: 50,
          estimated_stock_value: 220
        },
        {
          report_month: "2024-03",
          report_year: "2024",
          report_month_number: 3,
          filial: "EBB_Helsingborg",
          avdelning: "Herr",
          net_sales: 80,
          gross_profit: 20,
          estimated_stock_value: 300
        }
      ]
    });

    const options = getRiskRadarFilterOptions(sourceRows);
    const filters = parseRiskRadarFilters(
      {
        department: ["Dam"],
        store: ["Malmo"],
        year: ["2024"],
        month_number: ["2", "3"]
      },
      options,
      39.5
    );
    const filteredRows = filterRiskRadarSourceRows(sourceRows, filters);
    const aggregates = aggregateRiskRadarRows(filteredRows);

    expect(filteredRows).toHaveLength(2);
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0]).toMatchObject({
      filial: "Malmo",
      avdelning: "Dam",
      net_sales: 220,
      gross_profit: 90,
      estimated_stock_value: 420
    });
  });
});
