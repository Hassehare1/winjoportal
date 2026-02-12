from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

CURATED_SCHEMA_ID = "sales_monthly_curated_v1"


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


def file_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def parse_month_from_partition_dir(path: Path) -> str:
    name = path.name
    prefix = "report_month_"
    if not name.startswith(prefix):
        raise ValueError(f"Unexpected partition directory: {path}")
    return name[len(prefix) :]


def discover_raw_partitions(output_root: Path) -> tuple[dict[str, Path], list[dict[str, str]]]:
    raw_base = output_root / "raw" / "sales_monthly" / "v1"
    selected: dict[str, dict[str, Any]] = {}
    skipped: list[dict[str, str]] = []

    for raw_path in sorted(raw_base.glob("report_month_*/sales_monthly_v1.parquet")):
        month = parse_month_from_partition_dir(raw_path.parent)
        current = selected.get(month)
        stat = raw_path.stat()
        candidate = {
            "path": raw_path.resolve(),
            "mtime": stat.st_mtime,
            "size_bytes": stat.st_size,
        }

        if current is None:
            selected[month] = candidate
            continue

        if candidate["mtime"] > current["mtime"]:
            skipped.append(
                {
                    "file": str(current["path"]),
                    "reason": f"duplicate_month_replaced_by_newer_file:{raw_path.name}",
                }
            )
            selected[month] = candidate
        else:
            skipped.append(
                {
                    "file": str(raw_path),
                    "reason": f"duplicate_month_older_than:{Path(current['path']).name}",
                }
            )

    mapping = {month: Path(meta["path"]) for month, meta in selected.items()}
    return mapping, skipped


def load_state(state_path: Path) -> dict[str, Any]:
    if not state_path.exists():
        return {
            "schema_id": CURATED_SCHEMA_ID,
            "updated_at": None,
            "months": {},
        }

    payload = json.loads(state_path.read_text(encoding="utf-8"))
    months = payload.get("months", {})
    if not isinstance(months, dict):
        raise ValueError(f"Invalid curated state file: {state_path}")

    return {
        "schema_id": payload.get("schema_id", CURATED_SCHEMA_ID),
        "updated_at": payload.get("updated_at"),
        "months": months,
    }


def save_state(state_path: Path, state: dict[str, Any]) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state["updated_at"] = utc_now_iso()
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_curated_table(raw_path: Path):
    duckdb = require_duckdb()
    conn = duckdb.connect(database=":memory:")
    conn.execute("SET threads TO 4")
    conn.execute("SET memory_limit='1GB'")

    query = """
    WITH src AS (
      SELECT
        report_month,
        filial,
        avdelning,
        varugrupp,
        artnr,
        ean,
        varutext,
        huvudleverantor,
        antal_salda,
        fors_sum,
        tb,
        tg_percent,
        fors_m_moms,
        ord_pris,
        snitt_inpris,
        lager_antal,
        source_file
      FROM read_parquet(?)
    ),
    agg AS (
      SELECT
        report_month,
        filial,
        avdelning,
        varugrupp,
        artnr,
        ean,
        varutext,
        huvudleverantor,
        SUM(COALESCE(antal_salda, 0)) AS antal_salda_sum,
        SUM(COALESCE(fors_sum, 0)) AS fors_sum_sum,
        SUM(COALESCE(tb, 0)) AS tb_sum,
        SUM(COALESCE(fors_m_moms, 0)) AS fors_m_moms_sum,
        AVG(ord_pris) FILTER (WHERE ord_pris IS NOT NULL) AS ord_pris_avg,
        AVG(snitt_inpris) FILTER (WHERE snitt_inpris IS NOT NULL) AS snitt_inpris_avg,
        AVG(tg_percent) FILTER (WHERE tg_percent IS NOT NULL) AS tg_percent_avg,
        MAX(lager_antal) FILTER (WHERE lager_antal IS NOT NULL) AS lager_antal_max,
        COUNT(*) AS source_row_count,
        COUNT(DISTINCT source_file) AS source_file_count,
        SUM(CASE WHEN COALESCE(antal_salda, 0) < 0 THEN 1 ELSE 0 END) AS return_row_count,
        SUM(CASE WHEN COALESCE(tb, 0) < 0 THEN 1 ELSE 0 END) AS negative_margin_row_count,
        SUM(CASE WHEN ean IS NULL OR TRIM(ean) = '' THEN 1 ELSE 0 END) AS missing_ean_row_count
      FROM src
      GROUP BY
        report_month,
        filial,
        avdelning,
        varugrupp,
        artnr,
        ean,
        varutext,
        huvudleverantor
    )
    SELECT
      report_month,
      filial,
      avdelning,
      varugrupp,
      artnr,
      ean,
      varutext,
      huvudleverantor,
      ROUND(antal_salda_sum, 4) AS antal_salda_sum,
      ROUND(fors_sum_sum, 2) AS fors_sum_sum,
      ROUND(tb_sum, 2) AS tb_sum,
      ROUND(fors_m_moms_sum, 2) AS fors_m_moms_sum,
      ROUND(ord_pris_avg, 4) AS ord_pris_avg,
      ROUND(snitt_inpris_avg, 4) AS snitt_inpris_avg,
      ROUND(tg_percent_avg, 4) AS tg_percent_avg,
      ROUND(lager_antal_max, 4) AS lager_antal_max,
      ROUND(
        CASE WHEN fors_sum_sum = 0 THEN NULL ELSE (tb_sum / fors_sum_sum) * 100 END,
        4
      ) AS gross_margin_percent_calc,
      ROUND(
        CASE
          WHEN snitt_inpris_avg IS NULL OR lager_antal_max IS NULL THEN NULL
          ELSE snitt_inpris_avg * lager_antal_max
        END,
        2
      ) AS estimated_stock_value,
      source_row_count,
      source_file_count,
      return_row_count,
      negative_margin_row_count,
      missing_ean_row_count,
      (tb_sum < 0) AS has_negative_margin,
      (antal_salda_sum < 0 OR fors_sum_sum < 0) AS has_net_return
    FROM agg
    """
    table = conn.execute(query, [str(raw_path)]).fetch_arrow_table()
    conn.close()
    return table


def run_curated_build(
    *,
    output_root: Path,
    selected_months: list[str] | None = None,
    state_path: Path | None = None,
) -> dict[str, Any]:
    raw_mapping, discovery_skipped = discover_raw_partitions(output_root)
    if selected_months is not None:
        selected_set = set(selected_months)
        raw_mapping = {month: path for month, path in raw_mapping.items() if month in selected_set}

    curated_base = output_root / "curated" / "sales_monthly" / "v1"
    report_dir = output_root / "reports" / "sales_monthly" / "v1"
    runs_dir = report_dir / "runs"
    curated_base.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    runs_dir.mkdir(parents=True, exist_ok=True)

    effective_state_path = (
        state_path
        if state_path is not None
        else output_root / "state" / "sales_monthly" / "v1" / "curated_processed_months.json"
    )
    state = load_state(effective_state_path)

    processed: list[dict[str, Any]] = []
    unchanged: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []

    for month in sorted(raw_mapping.keys()):
        raw_path = raw_mapping[month]
        raw_checksum = file_sha256(raw_path)
        previous = state["months"].get(month, {})

        previous_matches = (
            previous.get("raw_sha256") == raw_checksum
            and Path(previous.get("curated_parquet_path", "")).exists()
        )
        if previous_matches:
            unchanged.append(
                {
                    "report_month": month,
                    "raw_parquet_path": str(raw_path),
                    "curated_parquet_path": previous.get("curated_parquet_path"),
                }
            )
            continue

        try:
            table = build_curated_table(raw_path)
            out_dir = curated_base / f"report_month_{month}"
            out_dir.mkdir(parents=True, exist_ok=True)
            curated_path = out_dir / "sales_monthly_curated_v1.parquet"
            pq.write_table(table, curated_path, compression="zstd")

            month_report = {
                "schema_id": CURATED_SCHEMA_ID,
                "report_month": month,
                "raw_parquet_path": str(raw_path),
                "raw_sha256": raw_checksum,
                "curated_parquet_path": str(curated_path),
                "row_count": table.num_rows,
                "column_count": table.num_columns,
                "generated_at_utc": utc_now_iso(),
            }
            month_report_path = report_dir / f"{month}_curated.json"
            month_report_path.write_text(json.dumps(month_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            state["months"][month] = {
                "raw_parquet_path": str(raw_path),
                "raw_sha256": raw_checksum,
                "curated_parquet_path": str(curated_path),
                "curated_report_path": str(month_report_path),
                "row_count": table.num_rows,
                "column_count": table.num_columns,
                "updated_at_utc": utc_now_iso(),
            }
            processed.append(month_report)
        except Exception as error:  # pragma: no cover - operational path
            failed.append(
                {
                    "report_month": month,
                    "raw_parquet_path": str(raw_path),
                    "error": str(error),
                }
            )

    save_state(effective_state_path, state)

    run_summary = {
        "schema_id": CURATED_SCHEMA_ID,
        "ran_at_utc": utc_now_iso(),
        "output_root": str(output_root),
        "state_file": str(effective_state_path),
        "discovered_raw_month_count": len(raw_mapping),
        "processed_count": len(processed),
        "unchanged_count": len(unchanged),
        "failed_count": len(failed),
        "discovery_skipped_count": len(discovery_skipped),
        "processed": processed,
        "unchanged": unchanged,
        "failed": failed,
        "discovery_skipped": discovery_skipped,
    }

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_report_path = runs_dir / f"{run_id}_curated_build.json"
    latest_path = report_dir / "latest_curated_build.json"
    run_report_path.write_text(json.dumps(run_summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    latest_path.write_text(json.dumps(run_summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    run_summary["run_report_path"] = str(run_report_path)
    run_summary["latest_report_path"] = str(latest_path)
    return run_summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Build curated monthly sales parquet incrementally.")
    parser.add_argument("--output-root", required=True, help="Root path for analytics data.")
    parser.add_argument(
        "--report-month",
        action="append",
        default=None,
        help="Optional month filter YYYY-MM. Can be provided multiple times.",
    )
    parser.add_argument(
        "--state-file",
        required=False,
        help="Optional custom state file path.",
    )
    args = parser.parse_args()

    output_root = Path(args.output_root).expanduser().resolve()
    state_path = Path(args.state_file).expanduser().resolve() if args.state_file else None
    summary = run_curated_build(
        output_root=output_root,
        selected_months=args.report_month,
        state_path=state_path,
    )

    print(f"Discovered raw months: {summary['discovered_raw_month_count']}")
    print(f"Processed: {summary['processed_count']}")
    print(f"Unchanged (skipped): {summary['unchanged_count']}")
    print(f"Failed: {summary['failed_count']}")
    print(f"Run report: {summary['run_report_path']}")

    if summary["failed_count"] > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
