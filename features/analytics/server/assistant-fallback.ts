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

function tableCell(value: string): string {
  return value.replace(/\|/g, "/");
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
  parts.push("## Svar");
  parts.push(
    `Regelbaserat svar för ${month}. OpenAI var inte tillgängligt, så analysen bygger direkt på KPI-underlaget för frågan: "${question}".`
  );
  parts.push("Det här ger en snabb nulägesbild utan externa antaganden.");
  parts.push("");
  parts.push("## Nyckeltal");
  parts.push("| Nyckeltal | Värde | Kommentar |");
  parts.push("|---|---:|---|");
  parts.push(`| Nettoförsäljning | ${fmtMoney(netSales)} | Summerad i vald period |`);
  parts.push(`| TB (bruttovinst) | ${fmtMoney(tb)} | Summerad i vald period |`);
  parts.push(`| TB % | ${fmtPct(tbPct)} | TB / nettoförsäljning |`);
  parts.push(`| Sålda enheter | ${fmtMoney(units)} | Summerat antal |`);
  if (topStore) {
    parts.push(
      `| Största butik (netto) | ${fmtMoney(toNumber(topStore.net_sales))} | ${tableCell(text(topStore.filial))} |`
    );
  }
  if (topDepartment) {
    parts.push(
      `| Största avdelning (netto) | ${fmtMoney(toNumber(topDepartment.net_sales))} | ${tableCell(text(topDepartment.avdelning))} |`
    );
  }
  if (topRisk) {
    parts.push(
      `| Riskartikel (TB %) | ${fmtPct(toNumber(topRisk.gross_margin_percent))} | ${tableCell(text(topRisk.varutext, text(topRisk.artnr)))} |`
    );
  }
  if (topHotspot) {
    const ratio = toNumber(topHotspot.stock_to_sales_ratio);
    parts.push(
      `| Lager/försäljning (högst) | ${ratio.toFixed(2)}x | ${tableCell(text(topHotspot.filial))} / ${tableCell(text(topHotspot.avdelning))} |`
    );
  }
  parts.push("");
  parts.push("## Rekommendation");
  parts.push("- Verifiera toppriskerna i tabellen mot artikelnivå innan beslut.");
  parts.push("- Prioritera åtgärder där både låg TB % och hög kapitalbindning sammanfaller.");
  parts.push("- Kör frågan igen när nytt månadsunderlag är uppdaterat för trendkontroll.");
  return parts.join("\n");
}
