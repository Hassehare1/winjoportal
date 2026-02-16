import { describe, expect, it } from "vitest";
import { buildRiskRadarModel } from "@/features/risk-radar/lib/model";

describe("risk radar model", () => {
  it("builds matrix and sorts top risks", () => {
    const model = buildRiskRadarModel({
      store_department_breakdown: [
        {
          filial: "StoreA",
          avdelning: "Dam",
          net_sales: 1_000_000,
          gross_profit: 300_000,
          estimated_stock_value: 2_800_000
        },
        {
          filial: "StoreA",
          avdelning: "Herr",
          net_sales: 600_000,
          gross_profit: 310_000,
          estimated_stock_value: 500_000
        },
        {
          filial: "StoreB",
          avdelning: "Dam",
          net_sales: 500_000,
          gross_profit: 260_000,
          estimated_stock_value: 450_000
        }
      ]
    });

    expect(model.cells).toHaveLength(3);
    expect(model.stores).toEqual(["StoreA", "StoreB"]);
    expect(model.departments).toEqual(["Dam", "Herr"]);
    expect(model.topRisks[0]?.store).toBe("StoreA");
    expect(model.topRisks[0]?.department).toBe("Dam");
    expect(model.averageRiskScore).toBeGreaterThan(0);
  });

  it("returns empty model for missing data", () => {
    const model = buildRiskRadarModel(null);
    expect(model.cells).toEqual([]);
    expect(model.topRisks).toEqual([]);
    expect(model.highRiskCount).toBe(0);
  });
});
