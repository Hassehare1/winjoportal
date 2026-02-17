import { describe, expect, it } from "vitest";
import { applyNegotiationFilters, getNegotiationFilterOptions, parseNegotiationFilters } from "@/features/negotiation-coach/lib/filters";
import {
  ALL_NEGOTIATION_LEVERS,
  buildNegotiationCoachModel,
  buildNegotiationSourceRows
} from "@/features/negotiation-coach/lib/model";

function buildRawDataFixture() {
  return {
    report_month: "2024-03",
    time_store_department_breakdown: [
      {
        report_month: "2024-03",
        report_year: "2024",
        report_month_number: 3,
        filial: "EBB_Malmo",
        avdelning: "Dam",
        huvudleverantor: "Sprint Hill Textile AB",
        net_sales: 1_000_000,
        gross_profit: 450_000,
        estimated_stock_value: 2_200_000
      },
      {
        report_month: "2024-03",
        report_year: "2024",
        report_month_number: 3,
        filial: "EBB_Helsingborg",
        avdelning: "Dam",
        huvudleverantor: "Vega Brands AB",
        net_sales: 600_000,
        gross_profit: 240_000,
        estimated_stock_value: 750_000
      }
    ],
    time_low_margin_high_sales_top_n: [
      {
        report_month: "2024-03",
        report_year: "2024",
        report_month_number: 3,
        filial: "EBB_Malmo",
        avdelning: "Dam",
        huvudleverantor: "Sprint Hill Textile AB",
        artnr: "A-1",
        ean: "111",
        varutext: "Damtröja",
        net_sales: 150_000,
        gross_profit: 48_000,
        gross_margin_percent: 32,
        units_sold: 900
      },
      {
        report_month: "2024-03",
        report_year: "2024",
        report_month_number: 3,
        filial: "EBB_Helsingborg",
        avdelning: "Dam",
        huvudleverantor: "Vega Brands AB",
        artnr: "A-2",
        ean: "222",
        varutext: "Damblus",
        net_sales: 100_000,
        gross_profit: 45_000,
        gross_margin_percent: 45,
        units_sold: 700
      }
    ],
    time_margin_risk_items_top_n: [
      {
        report_month: "2024-03",
        report_year: "2024",
        report_month_number: 3,
        filial: "EBB_Malmo",
        avdelning: "Dam",
        huvudleverantor: "Sprint Hill Textile AB",
        artnr: "A-1",
        ean: "111",
        varutext: "Damtröja",
        net_sales: 150_000,
        gross_profit: 48_000,
        gross_margin_percent: 32,
        units_sold: 900,
        return_row_count: 8,
        negative_margin_row_count: 3
      }
    ],
    time_return_risk_items_top_n: [
      {
        report_month: "2024-03",
        report_year: "2024",
        report_month_number: 3,
        filial: "EBB_Malmo",
        avdelning: "Dam",
        huvudleverantor: "Sprint Hill Textile AB",
        artnr: "A-1",
        ean: "111",
        varutext: "Damtröja",
        units_sold: -120,
        net_sales: -35_000,
        gross_profit: -12_000,
        return_row_count: 8
      }
    ]
  } as Record<string, unknown>;
}

describe("negotiation coach", () => {
  it("builds normalized source rows from analytics payload", () => {
    const rows = buildNegotiationSourceRows(buildRawDataFixture());
    expect(rows.length).toBe(2);
    const top = rows.find((row) => row.articleNumber === "A-1");
    expect(top).toBeDefined();
    expect(top?.store).toBe("Malmo");
    expect(top?.supplier).toBe("Sprint Hill Textile AB");
    expect(top?.returnRatePercent ?? 0).toBeGreaterThan(0);
    expect(top?.stockToSalesRatio ?? 0).toBeGreaterThan(1);
  });

  it("applies filters and computes model with package effects", () => {
    const rows = buildNegotiationSourceRows(buildRawDataFixture());
    const options = getNegotiationFilterOptions(rows);
    const filters = parseNegotiationFilters(
      {
        store: ["Malmo"],
        department: ["Dam"],
        supplier: ["Sprint Hill Textile AB"],
        year: ["2024"],
        month_number: ["3"],
        lever: ALL_NEGOTIATION_LEVERS,
        prioritize: "balanced"
      },
      options
    );
    const filteredRows = applyNegotiationFilters(rows, filters);
    const model = buildNegotiationCoachModel(filteredRows, {
      selectedLevers: filters.selectedLevers,
      prioritizeBy: filters.prioritizeBy
    });

    expect(filteredRows.length).toBe(1);
    expect(model.candidates.length).toBe(1);
    expect(model.candidates[0].packages).toHaveLength(3);
    expect(model.candidates[0].packages[1].tbLift).toBeGreaterThan(0);
    expect(model.candidates[0].packages[1].cashLift).toBeGreaterThan(0);
  });

  it("changes ranking when priority mode changes", () => {
    const rows = buildNegotiationSourceRows(buildRawDataFixture());
    const modelTb = buildNegotiationCoachModel(rows, {
      selectedLevers: ALL_NEGOTIATION_LEVERS,
      prioritizeBy: "tb"
    });
    const modelCash = buildNegotiationCoachModel(rows, {
      selectedLevers: ALL_NEGOTIATION_LEVERS,
      prioritizeBy: "cash"
    });

    const hasDifferentPriorityScore = modelTb.candidates.some(
      (candidate, index) => candidate.priorityScore !== modelCash.candidates[index]?.priorityScore
    );
    expect(hasDifferentPriorityScore).toBe(true);
  });

  it("applies manual supplier overrides to scenario packages", () => {
    const rows = buildNegotiationSourceRows(buildRawDataFixture());
    const baseModel = buildNegotiationCoachModel(rows, {
      selectedLevers: ALL_NEGOTIATION_LEVERS,
      prioritizeBy: "balanced"
    });

    const overriddenModel = buildNegotiationCoachModel(rows, {
      selectedLevers: ALL_NEGOTIATION_LEVERS,
      prioritizeBy: "balanced",
      supplierOverrides: [
        {
          supplier: "Sprint Hill Textile AB",
          purchaseCostImprovementPct: 5,
          priceLiftPct: 2,
          apDaysGain: 14,
          stockReleasePct: 15,
          returnReductionPct: 30
        }
      ]
    });

    const baseCandidate = baseModel.candidates.find((candidate) => candidate.supplier === "Sprint Hill Textile AB");
    const overriddenCandidate = overriddenModel.candidates.find(
      (candidate) => candidate.supplier === "Sprint Hill Textile AB"
    );
    expect(baseCandidate).toBeDefined();
    expect(overriddenCandidate).toBeDefined();

    const baseTarget = baseCandidate?.packages.find((pkg) => pkg.id === "target");
    const overriddenTarget = overriddenCandidate?.packages.find((pkg) => pkg.id === "target");
    expect(baseTarget).toBeDefined();
    expect(overriddenTarget).toBeDefined();
    expect((overriddenTarget?.tbLift ?? 0) + (overriddenTarget?.cashLift ?? 0)).toBeGreaterThan(
      (baseTarget?.tbLift ?? 0) + (baseTarget?.cashLift ?? 0)
    );
  });

  it("keeps supplier override mapping stable when some override cells are empty", () => {
    const rows = buildNegotiationSourceRows(buildRawDataFixture());
    const options = getNegotiationFilterOptions(rows);

    const filters = parseNegotiationFilters(
      {
        supplier_override_name: ["Sprint Hill Textile AB", "Vega Brands AB"],
        supplier_override_purchase_cost: ["", "5"],
        supplier_override_price_lift: ["", "1,5"],
        supplier_override_ap_days: ["", "12"],
        supplier_override_stock_release: ["", "10"],
        supplier_override_return_reduction: ["", "20"]
      },
      options
    );

    const sprint = filters.supplierOverrides.find((row) => row.supplier === "Sprint Hill Textile AB");
    const vega = filters.supplierOverrides.find((row) => row.supplier === "Vega Brands AB");

    expect(sprint).toBeUndefined();
    expect(vega).toBeDefined();
    expect(vega?.purchaseCostImprovementPct).toBe(5);
    expect(vega?.priceLiftPct).toBe(1.5);
    expect(vega?.apDaysGain).toBe(12);
    expect(vega?.stockReleasePct).toBe(10);
    expect(vega?.returnReductionPct).toBe(20);
  });

  it("parses supplier overrides from compact json payload", () => {
    const rows = buildNegotiationSourceRows(buildRawDataFixture());
    const options = getNegotiationFilterOptions(rows);

    const filters = parseNegotiationFilters(
      {
        supplier_overrides_json: JSON.stringify([
          {
            supplier: "Sprint Hill Textile AB",
            purchaseCostImprovementPct: "5,0",
            priceLiftPct: "1,8",
            apDaysGain: "14",
            stockReleasePct: "15",
            returnReductionPct: "30"
          },
          {
            supplier: "Vega Brands AB",
            purchaseCostImprovementPct: "",
            priceLiftPct: "",
            apDaysGain: "",
            stockReleasePct: "",
            returnReductionPct: ""
          }
        ])
      },
      options
    );

    expect(filters.supplierOverrides).toHaveLength(1);
    expect(filters.supplierOverrides[0]?.supplier).toBe("Sprint Hill Textile AB");
    expect(filters.supplierOverrides[0]?.purchaseCostImprovementPct).toBe(5);
    expect(filters.supplierOverrides[0]?.priceLiftPct).toBe(1.8);
    expect(filters.supplierOverrides[0]?.apDaysGain).toBe(14);
    expect(filters.supplierOverrides[0]?.stockReleasePct).toBe(15);
    expect(filters.supplierOverrides[0]?.returnReductionPct).toBe(30);
  });

  it("applies compact json overrides end-to-end in model totals", () => {
    const rows = buildNegotiationSourceRows(buildRawDataFixture());
    const options = getNegotiationFilterOptions(rows);

    const withoutOverride = parseNegotiationFilters({}, options);
    const withoutOverrideModel = buildNegotiationCoachModel(
      applyNegotiationFilters(rows, withoutOverride),
      {
        selectedLevers: withoutOverride.selectedLevers,
        prioritizeBy: withoutOverride.prioritizeBy,
        supplierOverrides: withoutOverride.supplierOverrides
      }
    );

    const withOverride = parseNegotiationFilters(
      {
        supplier_overrides_json: JSON.stringify([
          {
            supplier: "Sprint Hill Textile AB",
            purchaseCostImprovementPct: "5,0",
            priceLiftPct: "1,8",
            apDaysGain: "14",
            stockReleasePct: "15",
            returnReductionPct: "30"
          }
        ])
      },
      options
    );
    const withOverrideModel = buildNegotiationCoachModel(applyNegotiationFilters(rows, withOverride), {
      selectedLevers: withOverride.selectedLevers,
      prioritizeBy: withOverride.prioritizeBy,
      supplierOverrides: withOverride.supplierOverrides
    });

    expect(withOverrideModel.totals.targetTotalPotential).toBeGreaterThan(
      withoutOverrideModel.totals.targetTotalPotential
    );
  });
});
