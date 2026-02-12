from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from common import SCHEMA_ID, parse_report_month
from ingest_sales_month import ingest_workbook


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def file_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def stat_modified_iso(path: Path) -> str:
    modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    return modified.replace(microsecond=0).isoformat()


def normalize_state_path_key(path: Path) -> str:
    return str(path.resolve()).lower()


def load_state(state_path: Path) -> dict[str, Any]:
    if not state_path.exists():
        return {
            "schema_id": SCHEMA_ID,
            "updated_at": None,
            "files": {},
        }

    payload = json.loads(state_path.read_text(encoding="utf-8"))
    files = payload.get("files", {})
    if not isinstance(files, dict):
        raise ValueError(f"Invalid state file format at {state_path}")

    return {
        "schema_id": payload.get("schema_id", SCHEMA_ID),
        "updated_at": payload.get("updated_at"),
        "files": files,
    }


def save_state(state_path: Path, state: dict[str, Any]) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state["updated_at"] = utc_now_iso()
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def discover_input_files(input_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    candidates: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    for path in sorted(input_dir.glob("*.xlsx")):
        try:
            report_month = parse_report_month(path)
        except ValueError as error:
            skipped.append(
                {
                    "file": str(path),
                    "reason": f"invalid_report_month: {error}",
                }
            )
            continue

        candidates.append(
            {
                "path": path.resolve(),
                "file_name": path.name,
                "report_month": report_month,
                "size_bytes": path.stat().st_size,
                "modified_at_utc": stat_modified_iso(path),
                "modified_at_epoch": path.stat().st_mtime,
            }
        )

    # Keep only one source file per report month (latest modified wins).
    by_month: dict[str, dict[str, Any]] = {}
    for item in candidates:
        existing = by_month.get(item["report_month"])
        if existing is None:
            by_month[item["report_month"]] = item
            continue

        if item["modified_at_epoch"] > existing["modified_at_epoch"]:
            skipped.append(
                {
                    "file": str(existing["path"]),
                    "reason": f"duplicate_month_replaced_by_newer_file:{item['file_name']}",
                }
            )
            by_month[item["report_month"]] = item
        else:
            skipped.append(
                {
                    "file": str(item["path"]),
                    "reason": f"duplicate_month_older_than:{existing['file_name']}",
                }
            )

    selected = [by_month[month] for month in sorted(by_month.keys())]
    return selected, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest all monthly sales workbooks incrementally.")
    parser.add_argument("--input-dir", required=True, help="Folder containing monthly .xlsx files.")
    parser.add_argument("--output-root", required=True, help="Output root for raw parquet/reports/state.")
    parser.add_argument(
        "--state-file",
        required=False,
        help="Optional custom state file path. Default: <output-root>/state/sales_monthly/v1/processed_files.json",
    )
    parser.add_argument(
        "--allow-header-mismatch",
        action="store_true",
        help="Continue even if source header does not match expected schema header.",
    )
    parser.add_argument(
        "--build-curated",
        action="store_true",
        help="After raw ingest, build curated layer for processed months only.",
    )
    parser.add_argument(
        "--generate-kpis",
        action="store_true",
        help="After ingest/curated, generate fixed KPI report from curated layer.",
    )
    parser.add_argument(
        "--kpi-report-month",
        required=False,
        help="Optional KPI month YYYY-MM. Defaults to latest processed month (or latest curated month).",
    )
    parser.add_argument(
        "--kpi-top-n",
        type=int,
        default=10,
        help="Top N rows in KPI ranking sections.",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir).expanduser().resolve()
    output_root = Path(args.output_root).expanduser().resolve()
    if not input_dir.exists() or not input_dir.is_dir():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    state_path = (
        Path(args.state_file).expanduser().resolve()
        if args.state_file
        else output_root / "state" / "sales_monthly" / "v1" / "processed_files.json"
    )
    report_dir = output_root / "reports" / "sales_monthly" / "v1"
    runs_dir = report_dir / "runs"
    report_dir.mkdir(parents=True, exist_ok=True)
    runs_dir.mkdir(parents=True, exist_ok=True)

    base_dir = Path(__file__).resolve().parents[1]
    state = load_state(state_path)

    files_to_consider, discovery_skips = discover_input_files(input_dir)
    processed: list[dict[str, Any]] = []
    unchanged: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []

    for file_info in files_to_consider:
        path: Path = file_info["path"]
        key = normalize_state_path_key(path)
        checksum = file_sha256(path)
        previous = state["files"].get(key, {})

        if previous.get("sha256") == checksum and previous.get("report_month") == file_info["report_month"]:
            unchanged.append(
                {
                    "file": str(path),
                    "report_month": file_info["report_month"],
                }
            )
            continue

        try:
            table, report = ingest_workbook(
                input_path=path,
                base_dir=base_dir,
                strict_headers=not args.allow_header_mismatch,
            )

            report_month = report["report_month"]
            raw_dir = output_root / "raw" / "sales_monthly" / "v1" / f"report_month_{report_month}"
            raw_dir.mkdir(parents=True, exist_ok=True)
            parquet_path = raw_dir / "sales_monthly_v1.parquet"

            ingest_report_path = report_dir / f"{report_month}_ingest.json"
            pq.write_table(table, parquet_path, compression="zstd")
            ingest_report_path.write_text(
                json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            state["files"][key] = {
                "file_name": path.name,
                "absolute_path": str(path),
                "report_month": report_month,
                "sha256": checksum,
                "size_bytes": file_info["size_bytes"],
                "modified_at_utc": file_info["modified_at_utc"],
                "ingested_at_utc": utc_now_iso(),
                "rows_loaded": report["totals"].get("rows_loaded", 0),
                "parquet_path": str(parquet_path),
                "ingest_report_path": str(ingest_report_path),
            }
            processed.append(
                {
                    "file": str(path),
                    "report_month": report_month,
                    "rows_loaded": report["totals"].get("rows_loaded", 0),
                    "parquet_path": str(parquet_path),
                }
            )
        except Exception as error:  # pragma: no cover - operational path
            failed.append(
                {
                    "file": str(path),
                    "report_month": file_info["report_month"],
                    "error": str(error),
                }
            )

    save_state(state_path, state)

    post_steps: dict[str, Any] = {
        "build_curated": {
            "enabled": bool(args.build_curated),
            "executed": False,
            "processed_months": [],
            "error": None,
        },
        "generate_kpis": {
            "enabled": bool(args.generate_kpis),
            "executed": False,
            "report_month": None,
            "output_path": None,
            "error": None,
        },
    }

    processed_months = sorted({item["report_month"] for item in processed})

    if args.build_curated:
        months_for_curated = processed_months if processed_months else None
        try:
            from build_curated_sales_monthly import run_curated_build

            curated_summary = run_curated_build(
                output_root=output_root,
                selected_months=months_for_curated,
                state_path=None,
            )
            post_steps["build_curated"]["executed"] = True
            post_steps["build_curated"]["processed_months"] = processed_months
            post_steps["build_curated"]["summary"] = {
                "requested_month_scope": "processed_only" if processed_months else "all_available",
                "processed_count": curated_summary.get("processed_count", 0),
                "unchanged_count": curated_summary.get("unchanged_count", 0),
                "failed_count": curated_summary.get("failed_count", 0),
                "run_report_path": curated_summary.get("run_report_path"),
            }
        except Exception as error:  # pragma: no cover - operational path
            post_steps["build_curated"]["error"] = str(error)

    if args.generate_kpis:
        try:
            from generate_sales_kpis import generate_kpi_report

            kpi_month = args.kpi_report_month

            payload, kpi_output_path, kpi_html_path = generate_kpi_report(
                output_root=output_root,
                report_month=kpi_month,
                top_n=max(1, int(args.kpi_top_n)),
                output_path=None,
            )
            post_steps["generate_kpis"]["executed"] = True
            post_steps["generate_kpis"]["report_month"] = kpi_month
            post_steps["generate_kpis"]["output_path"] = str(kpi_output_path)
            post_steps["generate_kpis"]["quicklook_html_path"] = str(kpi_html_path)
            post_steps["generate_kpis"]["summary"] = {
                "net_sales": payload.get("summary", {}).get("net_sales"),
                "gross_profit": payload.get("summary", {}).get("gross_profit"),
                "gross_margin_percent": payload.get("summary", {}).get("gross_margin_percent"),
            }
        except Exception as error:  # pragma: no cover - operational path
            post_steps["generate_kpis"]["error"] = str(error)

    run_summary = {
        "schema_id": SCHEMA_ID,
        "ran_at_utc": utc_now_iso(),
        "input_dir": str(input_dir),
        "output_root": str(output_root),
        "state_file": str(state_path),
        "discovered_file_count": len(files_to_consider),
        "processed_count": len(processed),
        "unchanged_count": len(unchanged),
        "failed_count": len(failed),
        "discovery_skipped_count": len(discovery_skips),
        "processed": processed,
        "unchanged": unchanged,
        "failed": failed,
        "discovery_skipped": discovery_skips,
        "post_steps": post_steps,
    }

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_report_path = runs_dir / f"{run_id}_folder_ingest.json"
    latest_report_path = report_dir / "latest_folder_ingest.json"

    run_report_path.write_text(json.dumps(run_summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    latest_report_path.write_text(json.dumps(run_summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Discovered files: {len(files_to_consider)}")
    print(f"Processed: {len(processed)}")
    print(f"Unchanged (skipped): {len(unchanged)}")
    print(f"Failed: {len(failed)}")
    print(f"State updated: {state_path}")
    print(f"Run report: {run_report_path}")
    if args.build_curated:
        print(
            "Post step curated: "
            + ("ok" if post_steps["build_curated"]["executed"] else f"skipped/error ({post_steps['build_curated']['error']})")
        )
    if args.generate_kpis:
        print(
            "Post step kpis: "
            + (
                f"ok ({post_steps['generate_kpis']['output_path']})"
                if post_steps["generate_kpis"]["executed"]
                else f"skipped/error ({post_steps['generate_kpis']['error']})"
            )
        )

    post_failed = (
        post_steps["build_curated"]["error"] is not None
        or post_steps["generate_kpis"]["error"] is not None
    )
    if failed or post_failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
