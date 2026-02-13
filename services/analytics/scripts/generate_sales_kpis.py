from __future__ import annotations

import argparse
import atexit
import html
import json
import re
import sys
from decimal import Decimal
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def require_duckdb():
    try:
        import duckdb  # type: ignore
    except ModuleNotFoundError as error:  # pragma: no cover - runtime dependency
        raise RuntimeError(
            "duckdb is not installed. Install dependencies with: pip install -r services/analytics/requirements.txt"
        ) from error
    return duckdb


def discover_curated_month_files(output_root: Path) -> dict[str, Path]:
    curated_base = output_root / "curated" / "sales_monthly" / "v1"
    mapping: dict[str, Path] = {}
    for parquet_path in sorted(curated_base.glob("report_month_*/sales_monthly_curated_v1.parquet")):
        partition_name = parquet_path.parent.name
        if not partition_name.startswith("report_month_"):
            continue
        month = partition_name[len("report_month_") :]
        mapping[month] = parquet_path.resolve()
    return mapping


def is_valid_report_month(value: str) -> bool:
    return bool(re.fullmatch(r"\d{4}-\d{2}", value))


def selected_history_months(
    all_months: list[str],
    target_month: str,
    history_months: int | None,
) -> list[str]:
    target_index = all_months.index(target_month)
    months_up_to_target = all_months[: target_index + 1]
    if history_months is None:
        return months_up_to_target
    return months_up_to_target[-history_months:]


def normalize_duckdb_memory_limit(value: str) -> str:
    cleaned = str(value).strip().upper().replace(" ", "")
    if not re.fullmatch(r"\d+(\.\d+)?(KB|MB|GB|TB|%)", cleaned):
        raise ValueError("duckdb_memory_limit must be like 768MB, 1GB, or 50%.")
    return cleaned


def fetch_rows(conn, sql: str, params: list[Any] | tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    result = conn.execute(sql, params)
    columns = [desc[0] for desc in result.description]
    return [dict(zip(columns, row)) for row in result.fetchall()]


def fetch_one(conn, sql: str, params: list[Any] | tuple[Any, ...] = ()) -> dict[str, Any]:
    rows = fetch_rows(conn, sql, params)
    return rows[0] if rows else {}


def to_json_compatible(value: Any) -> Any:
    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)
        return float(value)
    if isinstance(value, dict):
        return {k: to_json_compatible(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_json_compatible(v) for v in value]
    if isinstance(value, tuple):
        return [to_json_compatible(v) for v in value]
    return value


def json_for_html_script(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False)
    return raw.replace("</", "<\\/")


def build_quicklook_html(payload: dict[str, Any]) -> str:
    report_month = html.escape(str(payload.get("report_month", "")))
    generated_at = html.escape(str(payload.get("generated_at_utc", "")))
    payload_json = json_for_html_script(payload)
    template = """<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KPI Quicklook __REPORT_MONTH__</title>
  <style>
    :root {
      --bg: #f3f6fb;
      --surface: #ffffff;
      --text: #0f172a;
      --muted: #4b5563;
      --line: #d8e1ee;
      --sales: #0284c7;
      --profit: #16a34a;
      --warn: #ea580c;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Segoe UI, Arial, sans-serif; }
    .page { max-width: 1240px; margin: 0 auto; padding: 20px; display: grid; gap: 14px; }
    .card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
    h1, h2 { margin: 0 0 10px 0; }
    .meta { color: var(--muted); font-size: 13px; }
    .toolbar-sticky {
      position: sticky;
      top: 0;
      z-index: 45;
      margin: 0 -14px 10px;
      padding: 8px 14px 10px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.92));
      backdrop-filter: blur(2px);
    }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .btn { border: 1px solid var(--line); background: #fff; color: var(--text); border-radius: 10px; padding: 7px 10px; font-size: 13px; cursor: pointer; }
    .dropdown { position: relative; display: inline-block; }
    .dropdown-panel { position: absolute; top: calc(100% + 6px); left: 0; min-width: 280px; max-height: 320px; overflow: auto; border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 8px; z-index: 30; box-shadow: 0 8px 24px rgba(2, 6, 23, 0.12); display: none; }
    .dropdown-panel.open { display: block; }
    .check-row { display: flex; gap: 8px; align-items: center; font-size: 13px; padding: 5px 4px; }
    .kpi-grid { margin-top: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
    .kpi-grid-secondary { margin-top: 8px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .kpi { border: 1px solid var(--line); border-radius: 10px; padding: 10px; background: #fbfdff; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 3px; }
    .kpi strong { font-size: 20px; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .share-head, .share-row { display: grid; grid-template-columns: 180px 1fr 66px 1fr 66px; gap: 7px; align-items: center; }
    .share-head { color: var(--muted); font-size: 12px; margin-bottom: 8px; }
    .share-row { margin-bottom: 7px; font-size: 13px; }
    .bar-wrap { height: 10px; border-radius: 999px; background: #edf2f8; overflow: hidden; }
    .bar { height: 100%; border-radius: 999px; }
    .bar-sales { background: var(--sales); }
    .bar-profit { background: var(--profit); }
    .viz-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }
    .viz-panel {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.07);
    }
    .viz-kicker {
      display: inline-block;
      margin: 0 0 6px 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #1d4ed8;
    }
    .viz-panel h3 { margin: 0 0 4px 0; font-size: 16px; line-height: 1.3; }
    .viz-panel .meta { margin: 0 0 10px 0; font-size: 12px; line-height: 1.4; }
    .chart-frame {
      border: 1px solid #dbe7f5;
      border-radius: 10px;
      background: radial-gradient(circle at 20% 0%, #f5fbff, #ffffff 58%);
      padding: 10px;
    }
    .store-trend { margin-top: 0; }
    .store-trend-chart { width: 100%; height: 280px; display: block; }
    .store-trend-legend { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px 10px; }
    .trend-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--muted);
      border: 1px solid #e5edf8;
      background: #f8fbff;
      border-radius: 999px;
      padding: 3px 8px;
    }
    .trend-dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
    .store-trend-empty { color: var(--muted); font-size: 12px; margin: 6px 0; }
    .store-stock { margin-top: 0; }
    .store-stock-empty { color: var(--muted); font-size: 12px; margin: 6px 0; }
    .stock-bars { display: grid; gap: 10px; }
    .stock-bar-row { display: grid; grid-template-columns: 132px 1fr 102px; gap: 8px; align-items: center; font-size: 12px; }
    .stock-bar-label { color: var(--text); font-weight: 600; }
    .stock-bar-track { height: 12px; border-radius: 999px; background: #e7eef7; overflow: hidden; }
    .stock-bar-fill { height: 100%; border-radius: 999px; background: #2563eb; }
    .stock-bar-value { text-align: right; color: #334155; font-weight: 600; }
    .stock-ratio { margin-top: 10px; }
    .stock-ratio-head { margin: 0 0 4px 0; font-size: 12px; color: var(--muted); }
    .stock-ratio-empty { color: var(--muted); font-size: 12px; margin: 4px 0; }
    .stock-ratio-bars { display: grid; gap: 8px; }
    .stock-ratio-row { display: grid; grid-template-columns: 132px 1fr 132px; gap: 8px; align-items: center; font-size: 12px; }
    .stock-ratio-track { height: 12px; border-radius: 999px; background: #e8edf4; overflow: hidden; }
    .stock-ratio-fill { height: 100%; border-radius: 999px; background: #0ea5e9; }
    .stock-ratio-value { text-align: right; color: #1f2937; font-weight: 600; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 6px; border-bottom: 1px solid var(--line); text-align: left; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .col-ean { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; letter-spacing: 0.02em; white-space: nowrap; }
    .risk-pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .warn-pill-btn { display: inline-flex; align-items: center; border: 1px solid #fed7aa; background: #fff7ed; color: #9a3412; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .warn-pill-btn.active { background: #9a3412; color: #ffffff; border-color: #9a3412; }
    .risk-analysis { margin-top: 10px; border: 1px solid var(--line); border-radius: 10px; padding: 10px; background: #fbfdff; }
    .risk-analysis h3 { margin: 0 0 6px 0; font-size: 14px; }
    .risk-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-top: 8px; }
    .risk-kpi { border: 1px solid var(--line); border-radius: 8px; padding: 8px; background: #fff; }
    .risk-kpi span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 3px; }
    .risk-kpi strong { font-size: 16px; }
    .risk-table-grid { margin-top: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 10px; }
    .risk-table-wrap { border: 1px solid var(--line); border-radius: 10px; background: #ffffff; padding: 8px; overflow-x: auto; }
    .risk-section-title { margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.04em; }
    .risk-table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 520px; }
    .risk-table th, .risk-table td { padding: 6px 7px; border-bottom: 1px solid #e6edf7; text-align: left; vertical-align: top; }
    .risk-table th { color: #475569; font-weight: 700; background: #f8fbff; white-space: nowrap; }
    .risk-table tbody tr:last-child td { border-bottom: none; }
    .risk-empty { color: var(--muted); font-size: 12px; }
    @media (max-width: 980px) {
      .split { grid-template-columns: 1fr; }
      .viz-grid { grid-template-columns: 1fr; }
      .share-head, .share-row { grid-template-columns: 140px 1fr 58px 1fr 58px; }
      .stock-bar-row { grid-template-columns: 110px 1fr 90px; }
      .stock-ratio-row { grid-template-columns: 110px 1fr 110px; }
      .toolbar-sticky { margin: 0 -14px 8px; padding: 8px 14px; }
      .risk-table-grid { grid-template-columns: 1fr; }
      .risk-table { min-width: 460px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="card">
      <h1>KPI Quicklook - __REPORT_MONTH__</h1>
      <p class="meta">Retail klader. Uppdaterad: __GENERATED_AT__</p>
      <div class="toolbar-sticky">
        <div class="toolbar">
          <div class="dropdown">
            <button class="btn" id="deptToggle" type="button">Avdelningar</button>
            <div class="dropdown-panel" id="deptPanel">
              <div style="display:flex; gap:6px; margin-bottom:6px;">
                <button class="btn" id="deptAll" type="button">Markera alla</button>
                <button class="btn" id="deptNone" type="button">Rensa</button>
              </div>
              <div id="deptOptions"></div>
            </div>
          </div>
          <div class="dropdown">
            <button class="btn" id="storeToggle" type="button">Butiker</button>
            <div class="dropdown-panel" id="storePanel">
              <div style="display:flex; gap:6px; margin-bottom:6px;">
                <button class="btn" id="storeAll" type="button">Markera alla</button>
                <button class="btn" id="storeNone" type="button">Rensa</button>
              </div>
              <div id="storeOptions"></div>
            </div>
          </div>
          <div class="dropdown">
            <button class="btn" id="yearToggle" type="button">Ar</button>
            <div class="dropdown-panel" id="yearPanel">
              <div style="display:flex; gap:6px; margin-bottom:6px;">
                <button class="btn" id="yearAll" type="button">Markera alla</button>
                <button class="btn" id="yearNone" type="button">Rensa</button>
              </div>
              <div id="yearOptions"></div>
            </div>
          </div>
          <div class="dropdown">
            <button class="btn" id="monthToggle" type="button">Manader</button>
            <div class="dropdown-panel" id="monthPanel">
              <div style="display:flex; gap:6px; margin-bottom:6px;">
                <button class="btn" id="monthAll" type="button">Markera alla</button>
                <button class="btn" id="monthNone" type="button">Rensa</button>
              </div>
              <div id="monthOptions"></div>
            </div>
          </div>
          <span class="meta" id="selectedInfo"></span>
        </div>
      </div>
      <div class="kpi-grid">
        <article class="kpi"><span>Nettoforsaljning</span><strong id="kpiSales" title="Summa nettoforsaljning for valt urval och vald period." aria-label="Summa nettoforsaljning for valt urval och vald period.">-</strong></article>
        <article class="kpi"><span>TB (bruttovinst)</span><strong id="kpiProfit" title="Summa TB (bruttovinst) for valt urval och vald period." aria-label="Summa TB (bruttovinst) for valt urval och vald period.">-</strong></article>
        <article class="kpi"><span>TB %</span><strong id="kpiMargin" title="TB dividerat med nettoforsaljning multiplicerat med 100." aria-label="TB dividerat med nettoforsaljning multiplicerat med 100.">-</strong></article>
        <article class="kpi"><span>Salda enheter</span><strong id="kpiUnits" title="Summa salda enheter for valt urval och vald period." aria-label="Summa salda enheter for valt urval och vald period.">-</strong></article>
        <article class="kpi"><span>Lagerestimat</span><strong id="kpiStock" title="Uppskattat lagervarde till kostnad: summa (snitt_inpris x lagerantal) i senaste valda period." aria-label="Uppskattat lagervarde till kostnad: summa (snitt_inpris x lagerantal) i senaste valda period.">-</strong></article>
      </div>
      <div class="kpi-grid kpi-grid-secondary">
        <article class="kpi"><span>Snitt lagervarde per enhet</span><strong id="kpiAvgStockUnitValue" title="Lagerestimat dividerat med antal pa lager i senaste valda period." aria-label="Lagerestimat dividerat med antal pa lager i senaste valda period.">-</strong></article>
        <article class="kpi"><span>Snittpris salda enheter</span><strong id="kpiAvgSellingPrice" title="Nettoforsaljning dividerat med salda enheter for valt urval." aria-label="Nettoforsaljning dividerat med salda enheter for valt urval.">-</strong></article>
        <article class="kpi"><span>Marginal pa lager</span><strong id="kpiStockMargin" title="Potentiell lagerbruttovinst: summa (max(ord_pris - snitt_inpris, 0) x lagerantal) i senaste valda period." aria-label="Potentiell lagerbruttovinst: summa (max(ord_pris - snitt_inpris, 0) x lagerantal) i senaste valda period.">-</strong></article>
        <article class="kpi"><span>Marginal % pa lager</span><strong id="kpiStockMarginPct" title="Marginal pa lager dividerat med (lagerestimat + marginal pa lager), multiplicerat med 100." aria-label="Marginal pa lager dividerat med (lagerestimat + marginal pa lager), multiplicerat med 100.">-</strong></article>
        <article class="kpi"><span>Lagertackning (man)</span><strong id="kpiStockCoverageMonths" title="Lagerestimat dividerat med COGS i senaste valda period, dar COGS = nettoforsaljning - TB." aria-label="Lagerestimat dividerat med COGS i senaste valda period, dar COGS = nettoforsaljning - TB.">-</strong></article>
      </div>
    </section>

    <section class="card split">
      <article>
        <h2>Avdelning andel forsaljning/vinst</h2>
        <div class="share-head"><div>Avdelning</div><div>Forsaljning</div><div></div><div>Vinst</div><div></div></div>
        <div id="deptShareRows"></div>
      </article>
      <article>
        <h2>Butik andel forsaljning/vinst</h2>
        <div class="share-head"><div>Butik</div><div>Forsaljning</div><div></div><div>Vinst</div><div></div></div>
        <div id="storeShareRows"></div>
      </article>
    </section>

    <section class="card">
      <h2>Grafyta</h2>
      <div class="viz-grid">
        <article class="viz-panel store-trend">
          <span class="viz-kicker">Trend</span>
          <h3>Forsaljning per butik over tid</h3>
          <p class="meta">Visas nar minst tva perioder ar valda.</p>
          <div class="chart-frame">
            <p id="storeTrendEmpty" class="store-trend-empty">Valj minst tva perioder for att visa grafen.</p>
            <svg id="storeTrendSvg" class="store-trend-chart" viewBox="0 0 760 260" preserveAspectRatio="none" role="img" aria-label="Forsaljning per butik over tid"></svg>
          </div>
          <div id="storeTrendLegend" class="store-trend-legend"></div>
        </article>
        <article class="viz-panel store-stock">
          <span class="viz-kicker">Lager</span>
          <h3>Lager per butik</h3>
          <p class="meta">Bygger pa senaste valda period (lager ackumuleras inte mellan manader).</p>
          <div class="chart-frame">
            <p id="storeStockEmpty" class="store-stock-empty">Ingen lagerdata for valt urval.</p>
            <div id="storeStockBars" class="stock-bars"></div>
          </div>
          <div class="chart-frame stock-ratio">
            <p class="stock-ratio-head">Lager i forhallande till forsaljning (%) per butik, senaste valda period.</p>
            <p id="storeStockRatioEmpty" class="stock-ratio-empty">Ingen data for kvotberakning.</p>
            <div id="storeStockRatioBars" class="stock-ratio-bars"></div>
          </div>
        </article>
      </div>
    </section>

    <section class="card" id="momCard" style="display:none;">
      <h2>Manad mot manad</h2>
      <p class="meta" id="momRange"></p>
      <div class="kpi-grid">
        <article class="kpi"><span>Forsaljning delta</span><strong id="momSalesDelta">-</strong></article>
        <article class="kpi"><span>Forsaljning delta %</span><strong id="momSalesDeltaPct">-</strong></article>
        <article class="kpi"><span>TB delta</span><strong id="momProfitDelta">-</strong></article>
        <article class="kpi"><span>TB delta %</span><strong id="momProfitDeltaPct">-</strong></article>
      </div>
    </section>

    <section class="card split">
      <article>
        <h2>Topp avdelningar</h2>
        <table>
          <thead><tr><th>Avdelning</th><th>Netto</th><th>TB</th><th>TB %</th></tr></thead>
          <tbody id="topDeptBody"></tbody>
        </table>
      </article>
      <article>
        <h2>Lag marginal + hog forsaljning</h2>
        <table>
          <thead><tr><th>Avdelning</th><th>Artikel</th><th>EAN</th><th class="num">Antal</th><th class="num">Netto</th><th class="num">TB %</th></tr></thead>
          <tbody id="lowMarginBody"></tbody>
        </table>
      </article>
    </section>

    <section class="card">
      <h2>Snabb riskindikator</h2>
      <div id="riskPills" class="risk-pills"></div>
      <div id="riskAnalysis" class="risk-analysis"></div>
    </section>
  </main>

  <script id="kpiPayload" type="application/json">__PAYLOAD_JSON__</script>
  <script>
    (function () {
      const data = JSON.parse(document.getElementById("kpiPayload").textContent || "{}");
      const topN = Number(data.top_n || 10);
      const formatMoney = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
      const formatQty = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
      const formatDecimal = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

      const deptToggle = document.getElementById("deptToggle");
      const deptPanel = document.getElementById("deptPanel");
      const deptOptions = document.getElementById("deptOptions");
      const deptAll = document.getElementById("deptAll");
      const deptNone = document.getElementById("deptNone");
      const storeToggle = document.getElementById("storeToggle");
      const storePanel = document.getElementById("storePanel");
      const storeOptions = document.getElementById("storeOptions");
      const storeAll = document.getElementById("storeAll");
      const storeNone = document.getElementById("storeNone");
      const yearToggle = document.getElementById("yearToggle");
      const yearPanel = document.getElementById("yearPanel");
      const yearOptions = document.getElementById("yearOptions");
      const yearAll = document.getElementById("yearAll");
      const yearNone = document.getElementById("yearNone");
      const monthToggle = document.getElementById("monthToggle");
      const monthPanel = document.getElementById("monthPanel");
      const monthOptions = document.getElementById("monthOptions");
      const monthAll = document.getElementById("monthAll");
      const monthNone = document.getElementById("monthNone");
      const selectedInfo = document.getElementById("selectedInfo");
      const storeTrendEmpty = document.getElementById("storeTrendEmpty");
      const storeTrendSvg = document.getElementById("storeTrendSvg");
      const storeTrendLegend = document.getElementById("storeTrendLegend");
      const storeStockEmpty = document.getElementById("storeStockEmpty");
      const storeStockBars = document.getElementById("storeStockBars");
      const storeStockRatioEmpty = document.getElementById("storeStockRatioEmpty");
      const storeStockRatioBars = document.getElementById("storeStockRatioBars");

      const fallbackMonth = String(data.report_month || "");
      const fallbackYear = fallbackMonth.slice(0, 4);
      const fallbackMonthNumber = Number(fallbackMonth.slice(5, 7)) || 1;
      const riskState = { activeKey: "negative_margin" };

      function esc(value) {
        return String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      }

      function toNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
      }

      function pct(part, total) {
        if (!Number.isFinite(part) || !Number.isFinite(total) || total === 0) return 0;
        return (part / total) * 100;
      }

      function monthLabel(monthNumber) {
        const n = Number(monthNumber);
        if (!Number.isFinite(n) || n < 1 || n > 12) return String(monthNumber);
        return String(n).padStart(2, "0") + " " + monthNames[n - 1];
      }

      function displayStoreName(value) {
        const raw = String(value || "");
        const withoutPrefix = raw.replace(/^EBB_/i, "");
        return withoutPrefix.replaceAll("_", " ").trim() || raw;
      }

      function reportMonthLabel(reportMonth) {
        const text = String(reportMonth || "");
        if (text.length < 7) return text;
        const year = text.slice(0, 4);
        const month = Number(text.slice(5, 7));
        return monthLabel(month) + " " + year;
      }

      function normalizeRows(rows, defaultMonth) {
        const defaultMonthText = String(defaultMonth || fallbackMonth);
        const defaultYear = defaultMonthText.slice(0, 4) || fallbackYear;
        const defaultMonthNum = Number(defaultMonthText.slice(5, 7)) || fallbackMonthNumber;
        return (rows || []).map((row) => {
          const reportMonth = String(row.report_month || defaultMonthText);
          const reportYear = String(row.report_year || reportMonth.slice(0, 4) || defaultYear);
          const reportMonthNumber = Number(row.report_month_number || Number(reportMonth.slice(5, 7)) || defaultMonthNum);
          return {
            ...row,
            report_month: reportMonth,
            report_year: reportYear,
            report_month_number: reportMonthNumber,
          };
        });
      }

      const historyRows = normalizeRows(
        (data.time_store_department_breakdown && data.time_store_department_breakdown.length > 0)
          ? data.time_store_department_breakdown
          : (data.store_department_breakdown || []),
        fallbackMonth
      );
      const marginRiskRows = normalizeRows(
        (data.time_margin_risk_items_top_n && data.time_margin_risk_items_top_n.length > 0)
          ? data.time_margin_risk_items_top_n
          : (data.margin_risk_items_top_n || []),
        fallbackMonth
      );
      const returnRiskRows = normalizeRows(
        (data.time_return_risk_items_top_n && data.time_return_risk_items_top_n.length > 0)
          ? data.time_return_risk_items_top_n
          : (data.return_risk_items_top_n || []),
        fallbackMonth
      );
      const lowMarginRows = normalizeRows(
        (data.time_low_margin_high_sales_top_n && data.time_low_margin_high_sales_top_n.length > 0)
          ? data.time_low_margin_high_sales_top_n
          : (data.low_margin_high_sales_top_n || []),
        fallbackMonth
      );

      const allDepartments = (data.available_departments && data.available_departments.length > 0)
        ? data.available_departments.map((value) => String(value)).filter((value) => value.length > 0)
        : Array.from(new Set(historyRows.map((row) => String(row.avdelning || "")).filter((value) => value.length > 0))).sort();
      const allStores = (data.available_stores && data.available_stores.length > 0)
        ? data.available_stores.map((value) => String(value)).filter((value) => value.length > 0)
        : Array.from(new Set(historyRows.map((row) => String(row.filial || "")).filter((value) => value.length > 0))).sort();
      const allYears = (data.available_report_years && data.available_report_years.length > 0)
        ? data.available_report_years.map((value) => String(value)).filter((value) => value.length > 0)
        : Array.from(new Set(historyRows.map((row) => String(row.report_year || "")).filter((value) => value.length > 0))).sort();
      const allMonthNumbers = (data.available_month_numbers && data.available_month_numbers.length > 0)
        ? data.available_month_numbers.map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
        : Array.from(new Set(historyRows.map((row) => Number(row.report_month_number)).filter((value) => Number.isFinite(value)))).sort((a, b) => a - b);

      const selectedDepartments = new Set(allDepartments);
      const selectedStores = new Set(allStores);
      const selectedYears = new Set(allYears);
      const selectedMonthNumbers = new Set(allMonthNumbers);

      function fmtMoney(value) { return formatMoney.format(toNumber(value)); }
      function fmtQty(value) { return formatQty.format(toNumber(value)); }
      function fmtDecimal(value) { return formatDecimal.format(toNumber(value)); }
      function fmtPct(value, decimals = 1) { return toNumber(value).toFixed(decimals) + "%"; }
      function sumBy(rows, key) { return rows.reduce((acc, row) => acc + toNumber(row[key]), 0); }
      function formatEan(value) {
        const text = String(value ?? "").trim();
        return text.length > 0 ? text : "-";
      }

      function aggregateBy(rows, key, valueKey) {
        const totals = new Map();
        for (const row of rows) {
          const group = String(row[key] || "Okand");
          totals.set(group, (totals.get(group) || 0) + toNumber(row[valueKey]));
        }
        return Array.from(totals.entries()).map(([name, total]) => ({ name, total }));
      }

      function aggregateStoreOrDepartment(rows, key) {
        const byKey = new Map();
        for (const row of rows) {
          const name = String(row[key] || "Okand");
          const current = byKey.get(name) || {
            name: name,
            net_sales: 0,
            gross_profit: 0,
            units_sold: 0,
            estimated_stock_value: 0,
            stock_units: 0,
            stock_margin_value: 0,
          };
          current.net_sales += toNumber(row.net_sales);
          current.gross_profit += toNumber(row.gross_profit);
          current.units_sold += toNumber(row.units_sold);
          current.estimated_stock_value += toNumber(row.estimated_stock_value);
          current.stock_units += toNumber(row.stock_units);
          current.stock_margin_value += toNumber(row.stock_margin_value);
          byKey.set(name, current);
        }
        return Array.from(byKey.values());
      }

      function aggregateArticles(rows, sortKey, ascending) {
        const grouped = new Map();
        for (const row of rows) {
          const avdelning = String(row.avdelning || "Okand");
          const artnr = String(row.artnr || "");
          const ean = String(row.ean || "");
          const varutext = String(row.varutext || "");
          const key = avdelning + "||" + artnr + "||" + ean + "||" + varutext;
          const current = grouped.get(key) || {
            avdelning: avdelning,
            artnr: artnr,
            ean: ean,
            varutext: varutext,
            net_sales: 0,
            gross_profit: 0,
            units_sold: 0,
          };
          current.net_sales += toNumber(row.net_sales);
          current.gross_profit += toNumber(row.gross_profit);
          current.units_sold += toNumber(row.units_sold);
          grouped.set(key, current);
        }
        return Array.from(grouped.values())
          .map((row) => ({
            ...row,
            gross_margin_percent: pct(toNumber(row.gross_profit), toNumber(row.net_sales)),
          }))
          .sort((a, b) => {
            const diff = toNumber(a[sortKey]) - toNumber(b[sortKey]);
            return ascending ? diff : -diff;
          });
      }

      function inSelectedFilters(row) {
        const avdelning = String(row.avdelning || "");
        const filial = String(row.filial || "");
        const reportYear = String(row.report_year || "");
        const reportMonthNumber = Number(row.report_month_number);
        return selectedDepartments.has(avdelning)
          && selectedStores.has(filial)
          && selectedYears.has(reportYear)
          && selectedMonthNumbers.has(reportMonthNumber);
      }

      function inSelectedFiltersWithoutDepartment(row) {
        const filial = String(row.filial || "");
        const reportYear = String(row.report_year || "");
        const reportMonthNumber = Number(row.report_month_number);
        return selectedStores.has(filial)
          && selectedYears.has(reportYear)
          && selectedMonthNumbers.has(reportMonthNumber);
      }

      function getFilteredRows() {
        return historyRows.filter((row) => inSelectedFilters(row));
      }

      function getDepartmentFilterOrder() {
        const salesByDepartment = new Map();
        for (const row of historyRows) {
          if (!inSelectedFiltersWithoutDepartment(row)) continue;
          const department = String(row.avdelning || "");
          if (!department) continue;
          const current = salesByDepartment.get(department) || 0;
          salesByDepartment.set(department, current + toNumber(row.net_sales));
        }
        return [...allDepartments].sort((a, b) => {
          const salesDiff = (salesByDepartment.get(b) || 0) - (salesByDepartment.get(a) || 0);
          if (Math.abs(salesDiff) > 0.000001) return salesDiff;
          return a.localeCompare(b, "sv");
        });
      }

      function getUniqueReportMonths(rows) {
        return Array.from(new Set(rows.map((row) => String(row.report_month || ""))))
          .filter((value) => value.length > 0)
          .sort();
      }

      function getLatestReportMonth(rows) {
        const months = getUniqueReportMonths(rows);
        return months.length === 0 ? null : months[months.length - 1];
      }

      function renderCheckOptions(container, values, selectedSet, dataKey, labelFn, parseValueFn) {
        if (!container) return;
        container.innerHTML = values.map((value) => {
          const valueText = String(value);
          const checked = selectedSet.has(value) ? "checked" : "";
          return '<label class="check-row"><input type="checkbox" data-' + dataKey + '="' + esc(valueText) + '" ' + checked + ' />' + esc(labelFn(value)) + "</label>";
        }).join("");
        container.querySelectorAll("input[type='checkbox']").forEach((node) => {
          node.addEventListener("change", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            const raw = target.getAttribute("data-" + dataKey) || "";
            const parsed = parseValueFn(raw);
            if (target.checked) selectedSet.add(parsed); else selectedSet.delete(parsed);
            render();
          });
        });
      }

      function renderShareRows(containerId, rows, labelKey) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (rows.length === 0) {
          container.innerHTML = '<p class="meta">Ingen data for valt urval.</p>';
          return;
        }
        container.innerHTML = rows.map((row) => {
          const salesPct = Math.max(0, Math.min(100, toNumber(row.sales_share_percent)));
          const profitPct = Math.max(0, Math.min(100, toNumber(row.profit_share_percent)));
          const rawLabel = String(row[labelKey] || "");
          const label = labelKey === "filial" ? displayStoreName(rawLabel) : rawLabel;
          return '<div class="share-row">'
            + '<div>' + esc(label) + '</div>'
            + '<div class="bar-wrap"><div class="bar bar-sales" style="width:' + salesPct.toFixed(2) + '%"></div></div>'
            + '<div>' + fmtPct(salesPct, 1) + '</div>'
            + '<div class="bar-wrap"><div class="bar bar-profit" style="width:' + profitPct.toFixed(2) + '%"></div></div>'
            + '<div>' + fmtPct(profitPct, 1) + '</div>'
            + '</div>';
        }).join("");
      }

      function renderStoreTrend(filteredRows) {
        if (!storeTrendEmpty || !storeTrendSvg || !storeTrendLegend) return;
        const months = getUniqueReportMonths(filteredRows);
        if (months.length < 2) {
          storeTrendEmpty.textContent = "Valj minst tva perioder for att visa grafen.";
          storeTrendEmpty.style.display = "block";
          storeTrendSvg.style.display = "none";
          storeTrendSvg.innerHTML = "";
          storeTrendLegend.innerHTML = "";
          return;
        }

        const byStoreMonth = new Map();
        const storeSet = new Set();
        for (const row of filteredRows) {
          const store = String(row.filial || "");
          const month = String(row.report_month || "");
          if (!store || !month) continue;
          storeSet.add(store);
          const key = store + "||" + month;
          byStoreMonth.set(key, (byStoreMonth.get(key) || 0) + toNumber(row.net_sales));
        }

        const stores = Array.from(storeSet);
        if (stores.length === 0) {
          storeTrendEmpty.textContent = "Ingen butiksdata for valt urval.";
          storeTrendEmpty.style.display = "block";
          storeTrendSvg.style.display = "none";
          storeTrendSvg.innerHTML = "";
          storeTrendLegend.innerHTML = "";
          return;
        }

        const series = stores.map((store) => {
          const values = months.map((month) => toNumber(byStoreMonth.get(store + "||" + month) || 0));
          const total = values.reduce((acc, value) => acc + value, 0);
          return { store: store, values: values, total: total };
        }).sort((a, b) => b.total - a.total);

        let minValue = 0;
        let maxValue = 0;
        for (const row of series) {
          for (const value of row.values) {
            if (value < minValue) minValue = value;
            if (value > maxValue) maxValue = value;
          }
        }
        if (Math.abs(maxValue - minValue) < 0.000001) {
          maxValue = minValue + 1;
        }

        const width = 760;
        const height = 260;
        const left = 44;
        const right = 10;
        const top = 12;
        const bottom = 26;
        const plotWidth = width - left - right;
        const plotHeight = height - top - bottom;
        const xStep = months.length > 1 ? plotWidth / (months.length - 1) : 0;
        const palette = ["#0284c7", "#16a34a", "#ea580c", "#7c3aed", "#0f766e", "#be123c", "#0369a1", "#4338ca"];

        function xAt(index) {
          return left + (index * xStep);
        }

        function yAt(value) {
          return top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
        }

        const parts = [];
        const ticks = 4;
        for (let index = 0; index <= ticks; index += 1) {
          const value = maxValue - ((maxValue - minValue) * index / ticks);
          const y = yAt(value);
          parts.push('<line x1="' + left.toFixed(2) + '" y1="' + y.toFixed(2) + '" x2="' + (left + plotWidth).toFixed(2) + '" y2="' + y.toFixed(2) + '" stroke="#e6edf7" stroke-width="1" />');
          parts.push('<text x="' + (left - 6).toFixed(2) + '" y="' + (y + 4).toFixed(2) + '" fill="#6b7280" font-size="10" text-anchor="end">' + esc(fmtMoney(value)) + "</text>");
        }

        if (minValue < 0 && maxValue > 0) {
          const yZero = yAt(0);
          parts.push('<line x1="' + left.toFixed(2) + '" y1="' + yZero.toFixed(2) + '" x2="' + (left + plotWidth).toFixed(2) + '" y2="' + yZero.toFixed(2) + '" stroke="#9ca3af" stroke-width="1.2" stroke-dasharray="3 3" />');
        }

        const labelStep = months.length > 8 ? Math.ceil(months.length / 8) : 1;
        for (let index = 0; index < months.length; index += 1) {
          const x = xAt(index);
          if (index % labelStep === 0 || index === months.length - 1) {
            parts.push('<text x="' + x.toFixed(2) + '" y="' + (height - 7).toFixed(2) + '" fill="#6b7280" font-size="10" text-anchor="middle">' + esc(reportMonthLabel(months[index])) + "</text>");
          }
        }

        for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) {
          const row = series[seriesIndex];
          const color = palette[seriesIndex % palette.length];
          const points = row.values.map((value, valueIndex) => ({
            x: xAt(valueIndex),
            y: yAt(value),
          }));
          if (points.length > 1) {
            const areaPath = points
              .map((point, pointIndex) => (pointIndex === 0 ? "M" : "L") + point.x.toFixed(2) + "," + point.y.toFixed(2))
              .join(" ")
              + " L" + points[points.length - 1].x.toFixed(2) + "," + (top + plotHeight).toFixed(2)
              + " L" + points[0].x.toFixed(2) + "," + (top + plotHeight).toFixed(2)
              + " Z";
            parts.push('<path d="' + areaPath + '" fill="' + color + '" opacity="0.06" />');
          }
          const path = points.map((point, pointIndex) =>
            (pointIndex === 0 ? "M" : "L") + point.x.toFixed(2) + "," + point.y.toFixed(2)
          ).join(" ");
          parts.push('<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />');
          const lastPoint = points[points.length - 1];
          if (lastPoint) {
            parts.push('<circle cx="' + lastPoint.x.toFixed(2) + '" cy="' + lastPoint.y.toFixed(2) + '" r="2.8" fill="' + color + '" />');
          }
        }

        storeTrendEmpty.style.display = "none";
        storeTrendSvg.style.display = "block";
        storeTrendSvg.innerHTML = parts.join("");
        storeTrendLegend.innerHTML = series.map((row, index) => {
          const color = palette[index % palette.length];
          return '<span class="trend-legend-item"><span class="trend-dot" style="background:' + color + '"></span>' + esc(displayStoreName(row.store)) + " (" + esc(fmtMoney(row.total)) + ")</span>";
        }).join("");
      }

      function renderStoreStockBars(filteredRows) {
        if (!storeStockEmpty || !storeStockBars || !storeStockRatioEmpty || !storeStockRatioBars) return;
        const latestMonth = getLatestReportMonth(filteredRows);
        if (!latestMonth) {
          storeStockEmpty.textContent = "Ingen lagerdata for valt urval.";
          storeStockEmpty.style.display = "block";
          storeStockBars.innerHTML = "";
          storeStockRatioEmpty.textContent = "Ingen data for kvotberakning.";
          storeStockRatioEmpty.style.display = "block";
          storeStockRatioBars.innerHTML = "";
          return;
        }

        const latestRows = filteredRows.filter((row) => String(row.report_month || "") === latestMonth);
        const storeStocks = aggregateStoreOrDepartment(latestRows, "filial")
          .map((row) => ({
            filial: row.name,
            estimated_stock_value: Math.max(0, toNumber(row.estimated_stock_value)),
            net_sales: toNumber(row.net_sales),
          }))
          .sort((a, b) => b.estimated_stock_value - a.estimated_stock_value);

        if (storeStocks.length === 0) {
          storeStockEmpty.textContent = "Ingen lagerdata i senaste valda period.";
          storeStockEmpty.style.display = "block";
          storeStockBars.innerHTML = "";
          storeStockRatioEmpty.textContent = "Ingen data for kvotberakning.";
          storeStockRatioEmpty.style.display = "block";
          storeStockRatioBars.innerHTML = "";
          return;
        }

        const maxStock = Math.max(...storeStocks.map((row) => row.estimated_stock_value), 1);
        storeStockEmpty.textContent = "Senaste valda period: " + reportMonthLabel(latestMonth);
        storeStockEmpty.style.display = "block";
        storeStockBars.innerHTML = storeStocks.map((row) => {
          const width = Math.max(0, Math.min(100, (row.estimated_stock_value / maxStock) * 100));
          return '<div class="stock-bar-row">'
            + '<div class="stock-bar-label">' + esc(displayStoreName(row.filial)) + '</div>'
            + '<div class="stock-bar-track"><div class="stock-bar-fill" style="width:' + width.toFixed(2) + '%"></div></div>'
            + '<div class="stock-bar-value">' + esc(fmtMoney(row.estimated_stock_value)) + '</div>'
            + '</div>';
        }).join("");

        const ratioRows = storeStocks.map((row) => {
          const ratioPct = row.net_sales > 0 ? (row.estimated_stock_value / row.net_sales) * 100 : null;
          return {
            filial: row.filial,
            ratio_pct: ratioPct,
            estimated_stock_value: row.estimated_stock_value,
            net_sales: row.net_sales,
          };
        }).sort((a, b) => {
          if (a.ratio_pct === null && b.ratio_pct === null) return 0;
          if (a.ratio_pct === null) return 1;
          if (b.ratio_pct === null) return -1;
          return b.ratio_pct - a.ratio_pct;
        });

        const validRatios = ratioRows
          .map((row) => toNumber(row.ratio_pct))
          .filter((value) => Number.isFinite(value) && value > 0);
        const maxRatio = validRatios.length > 0 ? Math.max(...validRatios) : 1;

        if (ratioRows.length === 0) {
          storeStockRatioEmpty.textContent = "Ingen data for kvotberakning.";
          storeStockRatioEmpty.style.display = "block";
          storeStockRatioBars.innerHTML = "";
          return;
        }

        storeStockRatioEmpty.textContent = "Formel: Lagerestimat / Nettoforsaljning x 100.";
        storeStockRatioEmpty.style.display = "block";
        storeStockRatioBars.innerHTML = ratioRows.map((row) => {
          const ratioText = row.ratio_pct === null ? "-" : fmtPct(row.ratio_pct, 1);
          const width = row.ratio_pct === null ? 0 : Math.max(0, Math.min(100, (toNumber(row.ratio_pct) / maxRatio) * 100));
          return '<div class="stock-ratio-row">'
            + '<div class="stock-bar-label">' + esc(displayStoreName(row.filial)) + '</div>'
            + '<div class="stock-ratio-track"><div class="stock-ratio-fill" style="width:' + width.toFixed(2) + '%"></div></div>'
            + '<div class="stock-ratio-value" title="Lagerestimat: ' + esc(fmtMoney(row.estimated_stock_value)) + ', Netto: ' + esc(fmtMoney(row.net_sales)) + '">' + esc(ratioText) + '</div>'
            + '</div>';
        }).join("");
      }

      function renderTopDepartments(rows) {
        const tbody = document.getElementById("topDeptBody");
        if (!tbody) return;
        if (rows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4">Ingen data</td></tr>';
          return;
        }
        tbody.innerHTML = rows.map((row) =>
          '<tr><td>' + esc(row.avdelning) + '</td><td>' + fmtMoney(row.net_sales) + '</td><td>' + fmtMoney(row.gross_profit) + '</td><td>' + fmtPct(row.gross_margin_percent, 2) + '</td></tr>'
        ).join("");
      }

      function renderLowMargin(rows) {
        const tbody = document.getElementById("lowMarginBody");
        if (!tbody) return;
        if (rows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6">Ingen data</td></tr>';
          return;
        }
        tbody.innerHTML = rows.map((row) =>
          '<tr>'
            + '<td>' + esc(row.avdelning) + '</td>'
            + '<td>' + esc(row.varutext || row.artnr) + '</td>'
            + '<td class="col-ean">' + esc(formatEan(row.ean)) + '</td>'
            + '<td class="num">' + fmtQty(row.units_sold) + '</td>'
            + '<td class="num">' + fmtMoney(row.net_sales) + '</td>'
            + '<td class="num">' + fmtPct(row.gross_margin_percent, 2) + '</td>'
          + '</tr>'
        ).join("");
      }

      function buildRiskTable(title, headerHtml, rowHtml, emptyColspan, emptyText) {
        const bodyHtml = rowHtml && rowHtml.length > 0
          ? rowHtml
          : '<tr><td colspan="' + String(emptyColspan) + '" class="risk-empty">' + esc(emptyText) + "</td></tr>";
        return '<section class="risk-table-wrap">'
          + '<h4 class="risk-section-title">' + esc(title) + "</h4>"
          + '<table class="risk-table"><thead><tr>' + headerHtml + "</tr></thead><tbody>" + bodyHtml + "</tbody></table>"
          + "</section>";
      }

      function renderRiskAnalysis(metrics, filteredDepartments) {
        const container = document.getElementById("riskAnalysis");
        if (!container) return;
        if (filteredDepartments.length === 0) {
          container.innerHTML = '<h3>Snabbanalys</h3><p class="meta">Valj minst en avdelning for att se riskanalys.</p>';
          return;
        }

        if (riskState.activeKey === "departments") {
          const topSalesDepartments = [...metrics.departmentRows]
            .sort((a, b) => toNumber(b.net_sales) - toNumber(a.net_sales))
            .slice(0, 8);
          const topRows = topSalesDepartments.map((row, index) =>
            '<tr><td class="num">' + String(index + 1) + "</td><td>" + esc(row.avdelning) + '</td><td class="num">' + fmtMoney(row.net_sales) + '</td><td class="num">' + fmtPct(row.gross_margin_percent, 2) + "</td></tr>"
          ).join("");
          container.innerHTML =
            '<h3>Snabbanalys: valda avdelningar</h3>'
            + '<div class="risk-kpi-grid">'
            + '<div class="risk-kpi"><span>Valda avdelningar</span><strong>' + fmtQty(filteredDepartments.length) + '</strong></div>'
            + '<div class="risk-kpi"><span>Netto for urval</span><strong>' + fmtMoney(metrics.totalSales) + '</strong></div>'
            + '<div class="risk-kpi"><span>TB for urval</span><strong>' + fmtMoney(metrics.totalProfit) + '</strong></div>'
            + '</div>'
            + '<div class="risk-table-grid">'
            + buildRiskTable(
              "Storst avdelningar (netto)",
              '<th class="num">#</th><th>Avdelning</th><th class="num">Netto</th><th class="num">TB %</th>',
              topRows,
              4,
              "Ingen data for valt urval."
            )
            + '</div>';
          return;
        }

        if (riskState.activeKey === "negative_margin") {
          const rows = metrics.negativeRows;
          const riskSales = sumBy(rows, "net_sales");
          const riskProfit = sumBy(rows, "gross_profit");
          const worstDepartments = aggregateBy(rows, "avdelning", "gross_profit")
            .sort((a, b) => a.total - b.total)
            .slice(0, 8);
          const articleRows = aggregateArticles(rows, "gross_profit", true).slice(0, topN);
          const deptTableRows = worstDepartments.map((item, index) =>
            '<tr><td class="num">' + String(index + 1) + "</td><td>" + esc(item.name) + '</td><td class="num">' + fmtMoney(item.total) + "</td></tr>"
          ).join("");
          const articleTableRows = articleRows.map((item) =>
            "<tr>"
              + "<td>" + esc(item.avdelning) + "</td>"
              + "<td>" + esc(item.varutext || item.artnr) + "</td>"
              + '<td class="col-ean">' + esc(formatEan(item.ean)) + "</td>"
              + '<td class="num">' + fmtQty(item.units_sold) + "</td>"
              + '<td class="num">' + fmtMoney(item.net_sales) + "</td>"
              + '<td class="num">' + fmtMoney(item.gross_profit) + "</td>"
              + '<td class="num">' + fmtPct(item.gross_margin_percent, 2) + "</td>"
            + "</tr>"
          ).join("");
          container.innerHTML =
            '<h3>Snabbanalys: negativ marginal</h3>'
            + '<div class="meta">Baserad pa riskartiklar i topp-listan, filtrerad pa valda avdelningar.</div>'
            + '<div class="risk-kpi-grid">'
            + '<div class="risk-kpi"><span>Riskartiklar (topp)</span><strong>' + fmtQty(rows.length) + '</strong></div>'
            + '<div class="risk-kpi"><span>Netto i risklista</span><strong>' + fmtMoney(riskSales) + '</strong></div>'
            + '<div class="risk-kpi"><span>TB i risklista</span><strong>' + fmtMoney(riskProfit) + '</strong></div>'
            + '</div>'
            + '<div class="risk-table-grid">'
            + buildRiskTable(
              "Avdelningar med storst negativ TB",
              '<th class="num">#</th><th>Avdelning</th><th class="num">TB</th>',
              deptTableRows,
              3,
              "Ingen negativ marginal i topp-listan for valt urval."
            )
            + buildRiskTable(
              "Riskartiklar",
              '<th>Avdelning</th><th>Artikel</th><th>EAN</th><th class="num">Antal</th><th class="num">Netto</th><th class="num">TB</th><th class="num">TB %</th>',
              articleTableRows,
              7,
              "Inga riskartiklar for valt urval."
            )
            + '</div>';
          return;
        }

        if (riskState.activeKey === "net_returns") {
          const rows = metrics.returnRows;
          const returnSales = sumBy(rows, "net_sales");
          const returnUnits = sumBy(rows, "units_sold");
          const worstDepartments = aggregateBy(rows, "avdelning", "net_sales")
            .sort((a, b) => a.total - b.total)
            .slice(0, 8);
          const articleRows = aggregateArticles(rows, "net_sales", true).slice(0, topN);
          const deptTableRows = worstDepartments.map((item, index) =>
            '<tr><td class="num">' + String(index + 1) + "</td><td>" + esc(item.name) + '</td><td class="num">' + fmtMoney(item.total) + "</td></tr>"
          ).join("");
          const articleTableRows = articleRows.map((item) =>
            "<tr>"
              + "<td>" + esc(item.avdelning) + "</td>"
              + "<td>" + esc(item.varutext || item.artnr) + "</td>"
              + '<td class="col-ean">' + esc(formatEan(item.ean)) + "</td>"
              + '<td class="num">' + fmtQty(item.units_sold) + "</td>"
              + '<td class="num">' + fmtMoney(item.net_sales) + "</td>"
              + '<td class="num">' + fmtMoney(item.gross_profit) + "</td>"
            + "</tr>"
          ).join("");
          container.innerHTML =
            '<h3>Snabbanalys: nettoreturer</h3>'
            + '<div class="meta">Baserad pa retur-riskartiklar i topp-listan, filtrerad pa valda avdelningar.</div>'
            + '<div class="risk-kpi-grid">'
            + '<div class="risk-kpi"><span>Returartiklar (topp)</span><strong>' + fmtQty(rows.length) + '</strong></div>'
            + '<div class="risk-kpi"><span>Nettoeffekt</span><strong>' + fmtMoney(returnSales) + '</strong></div>'
            + '<div class="risk-kpi"><span>Enheter i retur</span><strong>' + fmtQty(returnUnits) + '</strong></div>'
            + '</div>'
            + '<div class="risk-table-grid">'
            + buildRiskTable(
              "Avdelningar med storst nettoretur",
              '<th class="num">#</th><th>Avdelning</th><th class="num">Netto</th>',
              deptTableRows,
              3,
              "Ingen nettoretur i topp-listan for valt urval."
            )
            + buildRiskTable(
              "Returartiklar",
              '<th>Avdelning</th><th>Artikel</th><th>EAN</th><th class="num">Antal</th><th class="num">Netto</th><th class="num">TB</th>',
              articleTableRows,
              6,
              "Inga returartiklar for valt urval."
            )
            + '</div>';
          return;
        }

        const ratio = metrics.tbRatio;
        const status = ratio < 35 ? "Hog risk" : ratio < 45 ? "Bevaka" : "Stabil";
        const lowMarginDepartments = [...metrics.departmentRows]
          .sort((a, b) => toNumber(a.gross_margin_percent) - toNumber(b.gross_margin_percent))
          .slice(0, 8);
        const lowMarginRows = lowMarginDepartments.map((row, index) =>
          '<tr><td class="num">' + String(index + 1) + "</td><td>" + esc(row.avdelning) + '</td><td class="num">' + fmtPct(row.gross_margin_percent, 2) + '</td><td class="num">' + fmtMoney(row.net_sales) + "</td></tr>"
        ).join("");
        container.innerHTML =
          '<h3>Snabbanalys: TB/netto-forhallande</h3>'
          + '<div class="risk-kpi-grid">'
          + '<div class="risk-kpi"><span>TB/netto</span><strong>' + fmtPct(ratio, 2) + '</strong></div>'
          + '<div class="risk-kpi"><span>Status</span><strong>' + esc(status) + '</strong></div>'
          + '<div class="risk-kpi"><span>Netto for urval</span><strong>' + fmtMoney(metrics.totalSales) + '</strong></div>'
          + '<div class="risk-kpi"><span>TB for urval</span><strong>' + fmtMoney(metrics.totalProfit) + '</strong></div>'
          + '</div>'
          + '<div class="risk-table-grid">'
          + buildRiskTable(
            "Avdelningar med lagst TB %",
            '<th class="num">#</th><th>Avdelning</th><th class="num">TB %</th><th class="num">Netto</th>',
            lowMarginRows,
            4,
            "Ingen data for valt urval."
          )
          + '</div>';
      }

      function renderRiskPills(filteredDepartments) {
        const container = document.getElementById("riskPills");
        if (!container) return;
        const filteredRows = getFilteredRows();
        const departmentRows = aggregateStoreOrDepartment(filteredRows, "avdelning").map((row) => ({
          avdelning: row.name,
          net_sales: row.net_sales,
          gross_profit: row.gross_profit,
          gross_margin_percent: pct(row.gross_profit, row.net_sales),
          units_sold: row.units_sold,
          estimated_stock_value: row.estimated_stock_value,
        }));
        const totalSales = sumBy(departmentRows, "net_sales");
        const totalProfit = sumBy(departmentRows, "gross_profit");
        const negativeRows = marginRiskRows.filter((row) => inSelectedFilters(row));
        const returnRows = returnRiskRows.filter((row) => inSelectedFilters(row));
        const metrics = {
          departmentRows: departmentRows,
          totalSales: totalSales,
          totalProfit: totalProfit,
          tbRatio: pct(totalProfit, totalSales),
          negativeRows: negativeRows,
          returnRows: returnRows,
        };
        const pills = [
          { key: "departments", label: "Valda avdelningar", value: String(filteredDepartments.length) },
          { key: "negative_margin", label: "Negativ marginal artiklar (topp)", value: String(negativeRows.length) },
          { key: "net_returns", label: "Nettoretur artiklar (topp)", value: String(returnRows.length) },
          { key: "tb_ratio", label: "Forhallande TB/netto", value: fmtPct(metrics.tbRatio, 2) },
        ];
        if (!pills.some((pill) => pill.key === riskState.activeKey)) {
          riskState.activeKey = "negative_margin";
        }
        container.innerHTML = pills
          .map((pill) => {
            const isActive = pill.key === riskState.activeKey;
            return '<button type="button" class="warn-pill-btn' + (isActive ? ' active' : '') + '" data-risk-key="' + esc(pill.key) + '" aria-pressed="' + (isActive ? 'true' : 'false') + '">'
              + esc(pill.label) + ': ' + esc(pill.value)
              + '</button>';
          })
          .join("");

        container.querySelectorAll("button[data-risk-key]").forEach((node) => {
          node.addEventListener("click", (event) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLElement)) return;
            const key = target.getAttribute("data-risk-key") || "";
            if (!key) return;
            riskState.activeKey = key;
            renderRiskPills(filteredDepartments);
          });
        });
        renderRiskAnalysis(metrics, filteredDepartments);
      }

      function renderMoM(filteredRows) {
        const card = document.getElementById("momCard");
        if (!card) return;
        const months = getUniqueReportMonths(filteredRows);
        if (months.length < 2) {
          card.style.display = "none";
          return;
        }
        const currentMonth = months[months.length - 1];
        const previousMonth = months[months.length - 2];
        const currentRows = filteredRows.filter((row) => String(row.report_month) === currentMonth);
        const previousRows = filteredRows.filter((row) => String(row.report_month) === previousMonth);

        const currentSales = sumBy(currentRows, "net_sales");
        const previousSales = sumBy(previousRows, "net_sales");
        const currentProfit = sumBy(currentRows, "gross_profit");
        const previousProfit = sumBy(previousRows, "gross_profit");

        const salesDelta = currentSales - previousSales;
        const salesDeltaPct = previousSales === 0 ? null : (salesDelta / previousSales) * 100;
        const profitDelta = currentProfit - previousProfit;
        const profitDeltaPct = previousProfit === 0 ? null : (profitDelta / previousProfit) * 100;

        card.style.display = "block";
        document.getElementById("momRange").textContent = previousMonth + " till " + currentMonth;
        document.getElementById("momSalesDelta").textContent = fmtMoney(salesDelta);
        document.getElementById("momSalesDeltaPct").textContent = salesDeltaPct === null ? "-" : fmtPct(salesDeltaPct, 2);
        document.getElementById("momProfitDelta").textContent = fmtMoney(profitDelta);
        document.getElementById("momProfitDeltaPct").textContent = profitDeltaPct === null ? "-" : fmtPct(profitDeltaPct, 2);
      }

      function render() {
        const filteredRows = getFilteredRows();
        const filteredMonths = getUniqueReportMonths(filteredRows);
        if (selectedInfo) {
          selectedInfo.textContent =
            selectedDepartments.size + "/" + allDepartments.length + " avd, "
            + selectedStores.size + "/" + allStores.length + " butiker, "
            + selectedMonthNumbers.size + "/" + allMonthNumbers.length + " manader, "
            + filteredMonths.length + " perioder";
        }

        const totalSales = sumBy(filteredRows, "net_sales");
        const totalProfit = sumBy(filteredRows, "gross_profit");
        const totalUnits = sumBy(filteredRows, "units_sold");
        const avgSellingPrice = totalUnits > 0 ? totalSales / totalUnits : null;
        const latestMonth = getLatestReportMonth(filteredRows);
        const stockRows = latestMonth
          ? filteredRows.filter((row) => String(row.report_month || "") === latestMonth)
          : [];
        const totalStock = sumBy(stockRows, "estimated_stock_value");
        const totalStockUnits = sumBy(stockRows, "stock_units");
        const totalStockMargin = sumBy(stockRows, "stock_margin_value");
        const stockSellingValue = totalStock + totalStockMargin;
        const stockMarginPct = stockSellingValue > 0 ? (totalStockMargin / stockSellingValue) * 100 : null;
        const latestMonthSales = sumBy(stockRows, "net_sales");
        const latestMonthProfit = sumBy(stockRows, "gross_profit");
        const latestMonthCogs = latestMonthSales - latestMonthProfit;
        const stockCoverageMonths = latestMonthCogs > 0 ? totalStock / latestMonthCogs : null;
        const avgStockUnitValue = totalStockUnits > 0 ? totalStock / totalStockUnits : null;

        document.getElementById("kpiSales").textContent = fmtMoney(totalSales);
        document.getElementById("kpiProfit").textContent = fmtMoney(totalProfit);
        document.getElementById("kpiMargin").textContent = fmtPct(pct(totalProfit, totalSales), 2);
        document.getElementById("kpiUnits").textContent = fmtQty(totalUnits);
        document.getElementById("kpiStock").textContent = fmtMoney(totalStock);
        document.getElementById("kpiAvgStockUnitValue").textContent = avgStockUnitValue === null ? "-" : fmtMoney(avgStockUnitValue);
        document.getElementById("kpiAvgSellingPrice").textContent = avgSellingPrice === null ? "-" : fmtMoney(avgSellingPrice);
        document.getElementById("kpiStockMargin").textContent = fmtMoney(totalStockMargin);
        document.getElementById("kpiStockMarginPct").textContent = stockMarginPct === null ? "-" : fmtPct(stockMarginPct, 2);
        document.getElementById("kpiStockCoverageMonths").textContent = stockCoverageMonths === null ? "-" : (fmtDecimal(stockCoverageMonths) + " man");

        const deptAgg = aggregateStoreOrDepartment(filteredRows, "avdelning");
        const deptShare = deptAgg.map((row) => ({
          avdelning: row.name,
          sales_share_percent: pct(toNumber(row.net_sales), totalSales),
          profit_share_percent: pct(toNumber(row.gross_profit), totalProfit),
          net_sales: toNumber(row.net_sales),
          gross_profit: toNumber(row.gross_profit),
          gross_margin_percent: pct(toNumber(row.gross_profit), toNumber(row.net_sales)),
          units_sold: toNumber(row.units_sold),
          estimated_stock_value: toNumber(row.estimated_stock_value),
          stock_units: toNumber(row.stock_units),
          stock_margin_value: toNumber(row.stock_margin_value),
        })).sort((a, b) => b.net_sales - a.net_sales);
        renderShareRows("deptShareRows", deptShare, "avdelning");

        const storeAgg = aggregateStoreOrDepartment(filteredRows, "filial").map((row) => ({
          filial: row.name,
          net_sales: row.net_sales,
          gross_profit: row.gross_profit,
        }));
        const storeTotalSales = storeAgg.reduce((acc, row) => acc + row.net_sales, 0);
        const storeTotalProfit = storeAgg.reduce((acc, row) => acc + row.gross_profit, 0);
        const storeShare = storeAgg.map((row) => ({
          filial: row.filial,
          sales_share_percent: pct(row.net_sales, storeTotalSales),
          profit_share_percent: pct(row.gross_profit, storeTotalProfit),
          net_sales: row.net_sales,
          gross_profit: row.gross_profit,
        })).sort((a, b) => b.net_sales - a.net_sales);
        renderShareRows("storeShareRows", storeShare, "filial");
        renderStoreTrend(filteredRows);
        renderStoreStockBars(filteredRows);

        renderTopDepartments(deptShare.slice(0, topN));
        renderLowMargin(aggregateArticles(lowMarginRows.filter((row) => inSelectedFilters(row)), "net_sales", false).slice(0, topN));
        renderRiskPills(Array.from(selectedDepartments));
        renderMoM(filteredRows);
      }

      function closePanels() {
        [deptPanel, storePanel, yearPanel, monthPanel].forEach((panel) => {
          if (panel) panel.classList.remove("open");
        });
      }

      function bindToggle(toggle, panel) {
        if (!toggle || !panel) return;
        toggle.addEventListener("click", (event) => {
          event.stopPropagation();
          const wasOpen = panel.classList.contains("open");
          closePanels();
          if (!wasOpen) panel.classList.add("open");
        });
      }

      bindToggle(deptToggle, deptPanel);
      bindToggle(storeToggle, storePanel);
      bindToggle(yearToggle, yearPanel);
      bindToggle(monthToggle, monthPanel);

      document.addEventListener("click", (event) => {
        if (!(event.target instanceof Node)) return;
        const wrappers = [
          [deptPanel, deptToggle],
          [storePanel, storeToggle],
          [yearPanel, yearToggle],
          [monthPanel, monthToggle],
        ];
        for (const pair of wrappers) {
          const panel = pair[0];
          const toggle = pair[1];
          if (!panel || !toggle) continue;
          if (!panel.contains(event.target) && !toggle.contains(event.target)) {
            panel.classList.remove("open");
          }
        }
      });

      function setAll(selectedSet, values) {
        selectedSet.clear();
        values.forEach((value) => selectedSet.add(value));
      }

      function clearAll(selectedSet) {
        selectedSet.clear();
      }

      function bindClick(node, handler) {
        if (!node) return;
        node.addEventListener("click", handler);
      }

      function renderFilterOptions() {
        const sortedDepartments = getDepartmentFilterOrder();
        renderCheckOptions(deptOptions, sortedDepartments, selectedDepartments, "dept", (value) => value, (value) => String(value));
        renderCheckOptions(storeOptions, allStores, selectedStores, "store", (value) => displayStoreName(value), (value) => String(value));
        renderCheckOptions(yearOptions, allYears, selectedYears, "year", (value) => value, (value) => String(value));
        renderCheckOptions(monthOptions, allMonthNumbers, selectedMonthNumbers, "month", (value) => monthLabel(value), (value) => Number(value));
      }

      bindClick(deptAll, () => {
        setAll(selectedDepartments, allDepartments);
        renderFilterOptions();
        render();
      });
      bindClick(deptNone, () => {
        clearAll(selectedDepartments);
        renderFilterOptions();
        render();
      });
      bindClick(storeAll, () => {
        setAll(selectedStores, allStores);
        renderFilterOptions();
        render();
      });
      bindClick(storeNone, () => {
        clearAll(selectedStores);
        renderFilterOptions();
        render();
      });
      bindClick(yearAll, () => {
        setAll(selectedYears, allYears);
        renderFilterOptions();
        render();
      });
      bindClick(yearNone, () => {
        clearAll(selectedYears);
        renderFilterOptions();
        render();
      });
      bindClick(monthAll, () => {
        setAll(selectedMonthNumbers, allMonthNumbers);
        renderFilterOptions();
        render();
      });
      bindClick(monthNone, () => {
        clearAll(selectedMonthNumbers);
        renderFilterOptions();
        render();
      });

      renderFilterOptions();
      render();
    })();
  </script>
</body>
</html>
"""
    return (
        template.replace("__REPORT_MONTH__", report_month)
        .replace("__GENERATED_AT__", generated_at)
        .replace("__PAYLOAD_JSON__", payload_json)
    )


def generate_kpi_report(
    *,
    output_root: Path,
    report_month: str | None = None,
    top_n: int = 10,
    history_months: int | None = 12,
    duckdb_threads: int = 2,
    duckdb_memory_limit: str = "768MB",
    output_path: Path | None = None,
) -> tuple[dict[str, Any], Path, Path]:
    if report_month is not None and not is_valid_report_month(report_month):
        raise ValueError("report_month must have format YYYY-MM.")
    if history_months is not None and history_months < 1:
        raise ValueError("history_months must be >= 1, or None for all history.")
    safe_threads = max(1, int(duckdb_threads))
    safe_memory_limit = normalize_duckdb_memory_limit(duckdb_memory_limit)
    safe_top_n = max(1, min(int(top_n), 200))
    month_files = discover_curated_month_files(output_root)
    if not month_files:
        raise FileNotFoundError("No curated parquet files found under data/curated/sales_monthly/v1.")

    available_months_all = sorted(month_files.keys())
    target_month = report_month or available_months_all[-1]
    if target_month not in month_files:
        raise ValueError(f"Requested report month {target_month!r} not found. Available: {available_months_all}")

    target_path = month_files[target_month]
    available_months = selected_history_months(available_months_all, target_month, history_months)
    previous_month = None
    previous_path = None
    if target_month in available_months_all:
        idx = available_months_all.index(target_month)
    if idx > 0:
        previous_month = available_months_all[idx - 1]
        previous_path = month_files[previous_month]

    def sql_quoted_path(path: Path) -> str:
        return str(path).replace("'", "''")

    duckdb = require_duckdb()
    conn = duckdb.connect(database=":memory:")
    conn_close = conn.close
    atexit.register(conn_close)
    conn.execute(f"SET threads TO {safe_threads}")
    conn.execute(f"SET memory_limit='{safe_memory_limit}'")
    conn.execute(
        f"CREATE OR REPLACE TEMP VIEW curated_month AS SELECT * FROM read_parquet('{sql_quoted_path(target_path)}')"
    )
    if previous_path is not None:
        conn.execute(
            f"CREATE OR REPLACE TEMP VIEW curated_prev AS SELECT * FROM read_parquet('{sql_quoted_path(previous_path)}')"
        )
    all_month_paths = [month_files[month] for month in available_months]
    all_month_paths_sql = ", ".join(f"'{sql_quoted_path(path)}'" for path in all_month_paths)
    conn.execute(
        f"CREATE OR REPLACE TEMP VIEW curated_all AS SELECT * FROM read_parquet([{all_month_paths_sql}])"
    )

    summary = fetch_one(
        conn,
        """
        SELECT
          ? AS report_month,
          ROUND(SUM(fors_sum_sum), 2) AS net_sales,
          ROUND(SUM(tb_sum), 2) AS gross_profit,
          ROUND(CASE WHEN SUM(fors_sum_sum) = 0 THEN NULL ELSE (SUM(tb_sum) / SUM(fors_sum_sum)) * 100 END, 2)
            AS gross_margin_percent,
          ROUND(SUM(antal_salda_sum), 2) AS units_sold,
          ROUND(SUM(COALESCE(lager_antal_max, 0)), 2) AS stock_units,
          ROUND(SUM(COALESCE(estimated_stock_value, 0)), 2) AS estimated_stock_value,
          ROUND(
            SUM(
              CASE
                WHEN COALESCE(lager_antal_max, 0) > 0
                  THEN GREATEST(COALESCE(ord_pris_avg, 0) - COALESCE(snitt_inpris_avg, 0), 0) * COALESCE(lager_antal_max, 0)
                ELSE 0
              END
            ),
            2
          ) AS stock_margin_value,
          COUNT(DISTINCT filial) AS store_count,
          COUNT(DISTINCT avdelning) AS department_count,
          COUNT(DISTINCT artnr) AS sku_count,
          SUM(return_row_count) AS return_row_count,
          SUM(negative_margin_row_count) AS negative_margin_row_count,
          ROUND(SUM(CASE WHEN has_negative_margin THEN fors_sum_sum ELSE 0 END), 2) AS negative_margin_sales,
          ROUND(SUM(CASE WHEN has_net_return THEN fors_sum_sum ELSE 0 END), 2) AS net_return_sales
        FROM curated_month
        """,
        [target_month],
    )

    store_share = fetch_rows(
        conn,
        """
        WITH totals AS (
          SELECT SUM(fors_sum_sum) AS total_sales, SUM(tb_sum) AS total_profit
          FROM curated_month
        )
        SELECT
          filial,
          ROUND(SUM(fors_sum_sum), 2) AS net_sales,
          ROUND(SUM(tb_sum), 2) AS gross_profit,
          ROUND(CASE WHEN SUM(fors_sum_sum) = 0 THEN NULL ELSE (SUM(tb_sum) / SUM(fors_sum_sum)) * 100 END, 2)
            AS gross_margin_percent,
          ROUND(SUM(COALESCE(estimated_stock_value, 0)), 2) AS estimated_stock_value,
          ROUND(CASE WHEN totals.total_sales = 0 THEN NULL ELSE (SUM(fors_sum_sum) / totals.total_sales) * 100 END, 2)
            AS sales_share_percent,
          ROUND(CASE WHEN totals.total_profit = 0 THEN NULL ELSE (SUM(tb_sum) / totals.total_profit) * 100 END, 2)
            AS profit_share_percent
        FROM curated_month
        CROSS JOIN totals
        GROUP BY filial, totals.total_sales, totals.total_profit
        ORDER BY net_sales DESC
        """,
    )

    department_share = fetch_rows(
        conn,
        """
        WITH totals AS (
          SELECT SUM(fors_sum_sum) AS total_sales, SUM(tb_sum) AS total_profit
          FROM curated_month
        )
        SELECT
          avdelning,
          ROUND(SUM(fors_sum_sum), 2) AS net_sales,
          ROUND(SUM(tb_sum), 2) AS gross_profit,
          ROUND(SUM(antal_salda_sum), 2) AS units_sold,
          ROUND(CASE WHEN SUM(fors_sum_sum) = 0 THEN NULL ELSE (SUM(tb_sum) / SUM(fors_sum_sum)) * 100 END, 2)
            AS gross_margin_percent,
          ROUND(SUM(COALESCE(estimated_stock_value, 0)), 2) AS estimated_stock_value,
          ROUND(CASE WHEN totals.total_sales = 0 THEN NULL ELSE (SUM(fors_sum_sum) / totals.total_sales) * 100 END, 2)
            AS sales_share_percent,
          ROUND(CASE WHEN totals.total_profit = 0 THEN NULL ELSE (SUM(tb_sum) / totals.total_profit) * 100 END, 2)
            AS profit_share_percent
        FROM curated_month
        CROSS JOIN totals
        GROUP BY avdelning, totals.total_sales, totals.total_profit
        ORDER BY net_sales DESC
        """,
    )

    store_department_breakdown = fetch_rows(
        conn,
        """
        SELECT
          filial,
          avdelning,
          ROUND(SUM(fors_sum_sum), 2) AS net_sales,
          ROUND(SUM(tb_sum), 2) AS gross_profit,
          ROUND(SUM(antal_salda_sum), 2) AS units_sold,
          ROUND(SUM(COALESCE(lager_antal_max, 0)), 2) AS stock_units,
          ROUND(SUM(COALESCE(estimated_stock_value, 0)), 2) AS estimated_stock_value,
          ROUND(
            SUM(
              CASE
                WHEN COALESCE(lager_antal_max, 0) > 0
                  THEN GREATEST(COALESCE(ord_pris_avg, 0) - COALESCE(snitt_inpris_avg, 0), 0) * COALESCE(lager_antal_max, 0)
                ELSE 0
              END
            ),
            2
          ) AS stock_margin_value,
          ROUND(CASE WHEN SUM(fors_sum_sum) = 0 THEN NULL ELSE (SUM(tb_sum) / SUM(fors_sum_sum)) * 100 END, 2)
            AS gross_margin_percent
        FROM curated_month
        GROUP BY filial, avdelning
        """,
    )

    store_ranking = fetch_rows(
        conn,
        """
        SELECT
          filial,
          ROUND(SUM(fors_sum_sum), 2) AS net_sales,
          ROUND(SUM(tb_sum), 2) AS gross_profit,
          ROUND(CASE WHEN SUM(fors_sum_sum) = 0 THEN NULL ELSE (SUM(tb_sum) / SUM(fors_sum_sum)) * 100 END, 2)
            AS gross_margin_percent,
          ROUND(SUM(antal_salda_sum), 2) AS units_sold,
          ROUND(SUM(COALESCE(estimated_stock_value, 0)), 2) AS estimated_stock_value
        FROM curated_month
        GROUP BY filial
        ORDER BY net_sales DESC
        LIMIT ?
        """,
        [safe_top_n],
    )

    department_ranking = fetch_rows(
        conn,
        """
        SELECT
          avdelning,
          ROUND(SUM(fors_sum_sum), 2) AS net_sales,
          ROUND(SUM(tb_sum), 2) AS gross_profit,
          ROUND(CASE WHEN SUM(fors_sum_sum) = 0 THEN NULL ELSE (SUM(tb_sum) / SUM(fors_sum_sum)) * 100 END, 2)
            AS gross_margin_percent,
          ROUND(SUM(antal_salda_sum), 2) AS units_sold
        FROM curated_month
        GROUP BY avdelning
        ORDER BY net_sales DESC
        LIMIT ?
        """,
        [safe_top_n],
    )

    margin_risks = fetch_rows(
        conn,
        """
        SELECT
          filial,
          avdelning,
          artnr,
          ean,
          varutext,
          ROUND(fors_sum_sum, 2) AS net_sales,
          ROUND(tb_sum, 2) AS gross_profit,
          ROUND(gross_margin_percent_calc, 2) AS gross_margin_percent,
          return_row_count,
          negative_margin_row_count
        FROM curated_month
        WHERE has_negative_margin
        ORDER BY gross_profit ASC
        LIMIT ?
        """,
        [safe_top_n],
    )

    return_risks = fetch_rows(
        conn,
        """
        SELECT
          filial,
          avdelning,
          artnr,
          ean,
          varutext,
          ROUND(antal_salda_sum, 2) AS units_sold,
          ROUND(fors_sum_sum, 2) AS net_sales,
          ROUND(tb_sum, 2) AS gross_profit,
          return_row_count
        FROM curated_month
        WHERE has_net_return
        ORDER BY units_sold ASC, net_sales ASC
        LIMIT ?
        """,
        [safe_top_n],
    )

    product_top_sales = fetch_rows(
        conn,
        """
        SELECT
          filial,
          avdelning,
          artnr,
          ean,
          varutext,
          ROUND(fors_sum_sum, 2) AS net_sales,
          ROUND(tb_sum, 2) AS gross_profit,
          ROUND(gross_margin_percent_calc, 2) AS gross_margin_percent,
          ROUND(antal_salda_sum, 2) AS units_sold
        FROM curated_month
        ORDER BY net_sales DESC
        LIMIT ?
        """,
        [safe_top_n],
    )

    product_top_profit = fetch_rows(
        conn,
        """
        SELECT
          filial,
          avdelning,
          artnr,
          ean,
          varutext,
          ROUND(fors_sum_sum, 2) AS net_sales,
          ROUND(tb_sum, 2) AS gross_profit,
          ROUND(gross_margin_percent_calc, 2) AS gross_margin_percent,
          ROUND(antal_salda_sum, 2) AS units_sold
        FROM curated_month
        ORDER BY gross_profit DESC
        LIMIT ?
        """,
        [safe_top_n],
    )

    low_margin_high_sales = fetch_rows(
        conn,
        """
        SELECT
          filial,
          avdelning,
          artnr,
          ean,
          varutext,
          ROUND(fors_sum_sum, 2) AS net_sales,
          ROUND(tb_sum, 2) AS gross_profit,
          ROUND(gross_margin_percent_calc, 2) AS gross_margin_percent,
          ROUND(antal_salda_sum, 2) AS units_sold
        FROM curated_month
        WHERE fors_sum_sum > 0
          AND gross_margin_percent_calc IS NOT NULL
          AND gross_margin_percent_calc < 35
        ORDER BY net_sales DESC
        LIMIT ?
        """,
        [safe_top_n],
    )

    inventory_hotspots = fetch_rows(
        conn,
        """
        SELECT
          filial,
          avdelning,
          ROUND(SUM(COALESCE(estimated_stock_value, 0)), 2) AS estimated_stock_value,
          ROUND(SUM(fors_sum_sum), 2) AS net_sales,
          ROUND(CASE WHEN SUM(fors_sum_sum) = 0 THEN NULL ELSE SUM(COALESCE(estimated_stock_value, 0)) / SUM(fors_sum_sum) END, 3)
            AS stock_to_sales_ratio
        FROM curated_month
        GROUP BY filial, avdelning
        ORDER BY estimated_stock_value DESC
        LIMIT ?
        """,
        [safe_top_n],
    )

    available_stores = [
        str(row["filial"])
        for row in fetch_rows(conn, "SELECT DISTINCT filial FROM curated_all ORDER BY filial")
        if row.get("filial")
    ]
    available_departments = [
        str(row["avdelning"])
        for row in fetch_rows(conn, "SELECT DISTINCT avdelning FROM curated_all ORDER BY avdelning")
        if row.get("avdelning")
    ]
    available_report_years = sorted({month[:4] for month in available_months if len(month) >= 7})
    available_month_numbers = sorted(
        {
            int(month[5:7])
            for month in available_months
            if len(month) >= 7 and month[5:7].isdigit()
        }
    )

    time_store_department_breakdown = fetch_rows(
        conn,
        """
        SELECT
          report_month,
          SUBSTR(report_month, 1, 4) AS report_year,
          CAST(SUBSTR(report_month, 6, 2) AS INTEGER) AS report_month_number,
          filial,
          avdelning,
          ROUND(SUM(fors_sum_sum), 2) AS net_sales,
          ROUND(SUM(tb_sum), 2) AS gross_profit,
          ROUND(SUM(antal_salda_sum), 2) AS units_sold,
          ROUND(SUM(COALESCE(lager_antal_max, 0)), 2) AS stock_units,
          ROUND(SUM(COALESCE(estimated_stock_value, 0)), 2) AS estimated_stock_value,
          ROUND(
            SUM(
              CASE
                WHEN COALESCE(lager_antal_max, 0) > 0
                  THEN GREATEST(COALESCE(ord_pris_avg, 0) - COALESCE(snitt_inpris_avg, 0), 0) * COALESCE(lager_antal_max, 0)
                ELSE 0
              END
            ),
            2
          ) AS stock_margin_value
        FROM curated_all
        GROUP BY report_month, filial, avdelning
        ORDER BY report_month DESC, filial, avdelning
        """,
    )

    time_margin_risks = fetch_rows(
        conn,
        """
        WITH grouped AS (
          SELECT
            report_month,
            SUBSTR(report_month, 1, 4) AS report_year,
            CAST(SUBSTR(report_month, 6, 2) AS INTEGER) AS report_month_number,
            filial,
            avdelning,
            artnr,
            ean,
            varutext,
            ROUND(SUM(fors_sum_sum), 2) AS net_sales,
            ROUND(SUM(tb_sum), 2) AS gross_profit,
            ROUND(SUM(antal_salda_sum), 2) AS units_sold,
            ROUND(CASE WHEN SUM(fors_sum_sum) = 0 THEN NULL ELSE (SUM(tb_sum) / SUM(fors_sum_sum)) * 100 END, 2)
              AS gross_margin_percent,
            SUM(return_row_count) AS return_row_count,
            SUM(negative_margin_row_count) AS negative_margin_row_count,
            ROW_NUMBER() OVER (PARTITION BY report_month ORDER BY SUM(tb_sum) ASC) AS rn
          FROM curated_all
          WHERE has_negative_margin
          GROUP BY report_month, filial, avdelning, artnr, ean, varutext
        )
        SELECT
          report_month,
          report_year,
          report_month_number,
          filial,
          avdelning,
          artnr,
          ean,
          varutext,
          net_sales,
          gross_profit,
          units_sold,
          gross_margin_percent,
          return_row_count,
          negative_margin_row_count
        FROM grouped
        WHERE rn <= ?
        ORDER BY report_month DESC, gross_profit ASC
        """,
        [safe_top_n],
    )

    time_return_risks = fetch_rows(
        conn,
        """
        WITH grouped AS (
          SELECT
            report_month,
            SUBSTR(report_month, 1, 4) AS report_year,
            CAST(SUBSTR(report_month, 6, 2) AS INTEGER) AS report_month_number,
            filial,
            avdelning,
            artnr,
            ean,
            varutext,
            ROUND(SUM(antal_salda_sum), 2) AS units_sold,
            ROUND(SUM(fors_sum_sum), 2) AS net_sales,
            ROUND(SUM(tb_sum), 2) AS gross_profit,
            SUM(return_row_count) AS return_row_count,
            ROW_NUMBER() OVER (PARTITION BY report_month ORDER BY SUM(antal_salda_sum) ASC, SUM(fors_sum_sum) ASC) AS rn
          FROM curated_all
          WHERE has_net_return
          GROUP BY report_month, filial, avdelning, artnr, ean, varutext
        )
        SELECT
          report_month,
          report_year,
          report_month_number,
          filial,
          avdelning,
          artnr,
          ean,
          varutext,
          units_sold,
          net_sales,
          gross_profit,
          return_row_count
        FROM grouped
        WHERE rn <= ?
        ORDER BY report_month DESC, units_sold ASC, net_sales ASC
        """,
        [safe_top_n],
    )

    time_low_margin_high_sales = fetch_rows(
        conn,
        """
        WITH grouped AS (
          SELECT
            report_month,
            SUBSTR(report_month, 1, 4) AS report_year,
            CAST(SUBSTR(report_month, 6, 2) AS INTEGER) AS report_month_number,
            filial,
            avdelning,
            artnr,
            ean,
            varutext,
            ROUND(SUM(fors_sum_sum), 2) AS net_sales,
            ROUND(SUM(tb_sum), 2) AS gross_profit,
            ROUND(SUM(antal_salda_sum), 2) AS units_sold,
            ROUND(CASE WHEN SUM(fors_sum_sum) = 0 THEN NULL ELSE (SUM(tb_sum) / SUM(fors_sum_sum)) * 100 END, 2)
              AS gross_margin_percent,
            ROW_NUMBER() OVER (PARTITION BY report_month ORDER BY SUM(fors_sum_sum) DESC) AS rn
          FROM curated_all
          WHERE fors_sum_sum > 0
            AND gross_margin_percent_calc IS NOT NULL
            AND gross_margin_percent_calc < 35
          GROUP BY report_month, filial, avdelning, artnr, ean, varutext
        )
        SELECT
          report_month,
          report_year,
          report_month_number,
          filial,
          avdelning,
          artnr,
          ean,
          varutext,
          net_sales,
          gross_profit,
          units_sold,
          gross_margin_percent
        FROM grouped
        WHERE rn <= ?
        ORDER BY report_month DESC, net_sales DESC
        """,
        [safe_top_n],
    )

    month_over_month: dict[str, Any] | None = None
    if previous_path is not None:
        curr = fetch_one(
            conn,
            """
            SELECT
              ROUND(SUM(fors_sum_sum), 2) AS net_sales,
              ROUND(SUM(tb_sum), 2) AS gross_profit,
              ROUND(SUM(antal_salda_sum), 2) AS units_sold
            FROM curated_month
            """,
        )
        prev = fetch_one(
            conn,
            """
            SELECT
              ROUND(SUM(fors_sum_sum), 2) AS net_sales,
              ROUND(SUM(tb_sum), 2) AS gross_profit,
              ROUND(SUM(antal_salda_sum), 2) AS units_sold
            FROM curated_prev
            """,
        )
        month_over_month = {
            "current_month": target_month,
            "previous_month": previous_month,
            "net_sales_delta": round((curr.get("net_sales") or 0) - (prev.get("net_sales") or 0), 2),
            "gross_profit_delta": round((curr.get("gross_profit") or 0) - (prev.get("gross_profit") or 0), 2),
            "units_sold_delta": round((curr.get("units_sold") or 0) - (prev.get("units_sold") or 0), 2),
            "net_sales_delta_percent": round(
                (
                    ((curr.get("net_sales") or 0) - (prev.get("net_sales") or 0))
                    / (prev.get("net_sales") or 1)
                )
                * 100,
                2,
            )
            if (prev.get("net_sales") or 0) != 0
            else None,
            "gross_profit_delta_percent": round(
                (
                    ((curr.get("gross_profit") or 0) - (prev.get("gross_profit") or 0))
                    / (prev.get("gross_profit") or 1)
                )
                * 100,
                2,
            )
            if (prev.get("gross_profit") or 0) != 0
            else None,
            "units_sold_delta_percent": round(
                (
                    ((curr.get("units_sold") or 0) - (prev.get("units_sold") or 0))
                    / (prev.get("units_sold") or 1)
                )
                * 100,
                2,
            )
            if (prev.get("units_sold") or 0) != 0
            else None,
        }

    conn_close()
    try:
        atexit.unregister(conn_close)
    except Exception:
        pass

    payload = {
        "generated_at_utc": utc_now_iso(),
        "schema_id": "sales_monthly_curated_v1",
        "report_month": target_month,
        "source_curated_file": str(target_path),
        "previous_month": previous_month,
        "top_n": safe_top_n,
        "available_report_months": available_months,
        "available_report_months_full": available_months_all,
        "history_months_applied": len(available_months),
        "duckdb_threads": safe_threads,
        "duckdb_memory_limit": safe_memory_limit,
        "available_report_years": available_report_years,
        "available_month_numbers": available_month_numbers,
        "available_stores": available_stores,
        "available_departments": available_departments,
        "summary": summary,
        "store_share": store_share,
        "department_share": department_share,
        "store_department_breakdown": store_department_breakdown,
        "time_store_department_breakdown": time_store_department_breakdown,
        "store_ranking_top_n": store_ranking,
        "department_ranking_top_n": department_ranking,
        "top_products_by_sales_top_n": product_top_sales,
        "top_products_by_profit_top_n": product_top_profit,
        "low_margin_high_sales_top_n": low_margin_high_sales,
        "time_low_margin_high_sales_top_n": time_low_margin_high_sales,
        "inventory_hotspots_top_n": inventory_hotspots,
        "margin_risk_items_top_n": margin_risks,
        "time_margin_risk_items_top_n": time_margin_risks,
        "return_risk_items_top_n": return_risks,
        "time_return_risk_items_top_n": time_return_risks,
        "month_over_month": month_over_month,
    }

    report_dir = output_root / "reports" / "sales_monthly" / "v1"
    report_dir.mkdir(parents=True, exist_ok=True)
    final_output_path = (
        output_path.resolve()
        if output_path is not None
        else report_dir / f"kpi_{target_month}.json"
    )

    html_output_path = report_dir / f"kpi_{target_month}_quicklook.html"
    payload["quicklook_html_path"] = str(html_output_path)
    clean_payload = to_json_compatible(payload)
    final_output_path.write_text(json.dumps(clean_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    html_output_path.write_text(build_quicklook_html(clean_payload), encoding="utf-8")
    return clean_payload, final_output_path, html_output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate fixed KPI report from curated sales parquet.")
    parser.add_argument("--output-root", required=True, help="Root path for analytics data.")
    parser.add_argument(
        "--report-month",
        required=False,
        help="Optional month YYYY-MM. Defaults to latest available month in curated layer.",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=10,
        help="Top N rows for ranking sections.",
    )
    parser.add_argument(
        "--history-months",
        type=int,
        default=12,
        help="Months of history to include in time-series sections (default 12). Use 0 for all.",
    )
    parser.add_argument(
        "--duckdb-threads",
        type=int,
        default=2,
        help="DuckDB worker threads (default 2 for lower crash risk on local machines).",
    )
    parser.add_argument(
        "--duckdb-memory-limit",
        default="768MB",
        help="DuckDB memory limit, e.g. 768MB, 1GB, 50%%.",
    )
    parser.add_argument("--output", required=False, help="Optional custom output file path for KPI JSON.")
    args = parser.parse_args()

    output_root = Path(args.output_root).expanduser().resolve()
    output = Path(args.output).expanduser().resolve() if args.output else None
    history_months = None if int(args.history_months) == 0 else int(args.history_months)
    _, output_path, html_path = generate_kpi_report(
        output_root=output_root,
        report_month=args.report_month,
        top_n=int(args.top_n),
        history_months=history_months,
        duckdb_threads=int(args.duckdb_threads),
        duckdb_memory_limit=str(args.duckdb_memory_limit),
        output_path=output,
    )
    print(f"KPI report written: {output_path}")
    print(f"KPI quicklook html written: {html_path}")


if __name__ == "__main__":
    main()

