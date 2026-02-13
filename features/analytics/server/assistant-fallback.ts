function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(value: number): string {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value);
}

function fmtPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function text(value: unknown, fallback = "-"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.length > 0 ? raw : fallback;
}

export function buildAnalyticsFallbackAnswer(
  question: string,
  month: string,
  contextPayload: Record<string, unknown>
): string {
  const summary = asRecord(contextPayload.summary) ?? {};
  const stores = asArray(contextPayload.store_share_top);
  const departments = asArray(contextPayload.department_share_top);
  const riskItems = asArray(contextPayload.margin_risk_items_top);
  const hotspots = asArray(contextPayload.inventory_hotspots_top);

  const topStore = stores[0] ?? null;
  const topDepartment = departments[0] ?? null;
  const topRisk = riskItems[0] ?? null;
  const topHotspot = hotspots[0] ?? null;

  const netSales = toNumber(summary.net_sales);
  const tb = toNumber(summary.gross_profit);
  const tbPct = toNumber(summary.gross_margin_percent);
  const units = toNumber(summary.units_sold);

  const parts: string[] = [];
  parts.push(`Fallback-svar (regelbaserat) for ${month}.`);
  parts.push(`Fraga: ${question}`);
  parts.push("");
  parts.push(
    `Basbild: Netto ${fmtMoney(netSales)}, TB ${fmtMoney(tb)}, TB% ${fmtPct(tbPct)}, salda enheter ${fmtMoney(units)}.`
  );

  if (topStore) {
    parts.push(
      `Storsta butik pa forsaljning: ${text(topStore.filial)} (${fmtMoney(toNumber(topStore.net_sales))} i netto).`
    );
  }
  if (topDepartment) {
    parts.push(
      `Storsta avdelning pa forsaljning: ${text(topDepartment.avdelning)} (${fmtMoney(toNumber(topDepartment.net_sales))} i netto, TB% ${fmtPct(toNumber(topDepartment.gross_margin_percent))}).`
    );
  }
  if (topRisk) {
    parts.push(
      `Riskartikel i toppen: ${text(topRisk.varutext, text(topRisk.artnr))} (${text(topRisk.avdelning)}), netto ${fmtMoney(toNumber(topRisk.net_sales))}, TB ${fmtMoney(toNumber(topRisk.gross_profit))}, TB% ${fmtPct(toNumber(topRisk.gross_margin_percent))}.`
    );
  }
  if (topHotspot) {
    const ratio = toNumber(topHotspot.stock_to_sales_ratio);
    parts.push(
      `Lagerhotspot: ${text(topHotspot.filial)} / ${text(topHotspot.avdelning)} med lagerestimat ${fmtMoney(toNumber(topHotspot.estimated_stock_value))} och lager/forsaljning ${ratio.toFixed(2)}x.`
    );
  }

  parts.push("");
  parts.push("OpenAI var inte tillgangligt, sa svaret ar framtaget direkt ur KPI-underlaget.");
  return parts.join("\n");
}
