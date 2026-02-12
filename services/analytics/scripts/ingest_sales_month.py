from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from common import (
    build_arrow_schema,
    header_matches,
    is_empty_row,
    load_schema_definition,
    open_workbook,
    parse_number,
    parse_text,
    parse_report_month,
)


def map_row_to_record(
    row: tuple[Any, ...],
    *,
    source_file: str,
    source_sheet: str,
    source_row: int,
    report_month: str,
) -> dict[str, Any]:
    padded = list(row[:15]) + [None] * max(0, 15 - len(row))
    return {
        "source_file": source_file,
        "source_sheet": source_sheet,
        "source_row": source_row,
        "report_month": report_month,
        "filial": parse_text(padded[0]),
        "avdelning": parse_text(padded[1]),
        "varugrupp": parse_text(padded[2]),
        "artnr": parse_text(padded[3]),
        "ean": parse_text(padded[4]),
        "varutext": parse_text(padded[5]),
        "huvudleverantor": parse_text(padded[6]),
        "antal_salda": parse_number(padded[7]),
        "fors_sum": parse_number(padded[8]),
        "tb": parse_number(padded[9]),
        "tg_percent": parse_number(padded[10]),
        "fors_m_moms": parse_number(padded[11]),
        "ord_pris": parse_number(padded[12]),
        "snitt_inpris": parse_number(padded[13]),
        "lager_antal": parse_number(padded[14]),
    }


def ingest_workbook(input_path: Path, base_dir: Path, strict_headers: bool) -> tuple[pa.Table, dict[str, Any]]:
    schema = load_schema_definition(base_dir)
    report_month = parse_report_month(input_path)
    wb = open_workbook(input_path)

    records: list[dict[str, Any]] = []
    ingest_report: dict[str, Any] = {
        "schema_id": schema.schema_id,
        "input_file": str(input_path),
        "report_month": report_month,
        "sheet_count": len(wb.sheetnames),
        "sheets": [],
    }

    totals = defaultdict(int)

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = ws.iter_rows(values_only=True)
        first_row = next(rows, None)
        header = list(first_row or [])
        header_ok = header_matches(header, schema.expected_header_order)

        if strict_headers and not header_ok:
            raise ValueError(
                f"Header mismatch in sheet {sheet_name!r}. "
                f"Use --allow-header-mismatch to continue in permissive mode."
            )

        rows_seen = 0
        rows_loaded = 0
        rows_skipped_empty = 0
        negative_qty = 0
        negative_tb = 0
        negative_tg = 0
        negative_stock = 0
        missing_ean = 0

        for row_index, row in enumerate(rows, start=2):
            rows_seen += 1
            if is_empty_row(row):
                rows_skipped_empty += 1
                continue

            record = map_row_to_record(
                row,
                source_file=input_path.name,
                source_sheet=sheet_name,
                source_row=row_index,
                report_month=report_month,
            )
            records.append(record)
            rows_loaded += 1

            qty = record["antal_salda"]
            tb = record["tb"]
            tg = record["tg_percent"]
            stock = record["lager_antal"]

            if record["ean"] is None:
                missing_ean += 1
            if qty is not None and qty < 0:
                negative_qty += 1
            if tb is not None and tb < 0:
                negative_tb += 1
            if tg is not None and tg < 0:
                negative_tg += 1
            if stock is not None and stock < 0:
                negative_stock += 1

        ingest_report["sheets"].append(
            {
                "sheet_name": sheet_name,
                "header_ok": header_ok,
                "rows_seen_excluding_header": rows_seen,
                "rows_loaded": rows_loaded,
                "rows_skipped_empty": rows_skipped_empty,
                "anomalies": {
                    "missing_ean": missing_ean,
                    "negative_qty": negative_qty,
                    "negative_tb": negative_tb,
                    "negative_tg": negative_tg,
                    "negative_stock": negative_stock,
                },
            }
        )

        totals["rows_seen_excluding_header"] += rows_seen
        totals["rows_loaded"] += rows_loaded
        totals["rows_skipped_empty"] += rows_skipped_empty
        totals["missing_ean"] += missing_ean
        totals["negative_qty"] += negative_qty
        totals["negative_tb"] += negative_tb
        totals["negative_tg"] += negative_tg
        totals["negative_stock"] += negative_stock

    ingest_report["totals"] = dict(totals)
    ingest_report["all_headers_ok"] = all(s["header_ok"] for s in ingest_report["sheets"])

    arrow_schema = build_arrow_schema(schema.fields)
    table = pa.Table.from_pylist(records, schema=arrow_schema)
    return table, ingest_report


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest monthly sales workbook to Parquet.")
    parser.add_argument("--input", required=True, help="Path to input .xlsx")
    parser.add_argument(
        "--output-root",
        required=True,
        help="Output root for raw parquet and reports.",
    )
    parser.add_argument(
        "--allow-header-mismatch",
        action="store_true",
        help="Continue even if source header does not match expected schema header.",
    )
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    output_root = Path(args.output_root).expanduser().resolve()
    base_dir = Path(__file__).resolve().parents[1]

    table, report = ingest_workbook(
        input_path=input_path,
        base_dir=base_dir,
        strict_headers=not args.allow_header_mismatch,
    )

    report_month = report["report_month"]
    raw_dir = output_root / "raw" / "sales_monthly" / "v1" / f"report_month_{report_month}"
    report_dir = output_root / "reports" / "sales_monthly" / "v1"
    raw_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    parquet_path = raw_dir / "sales_monthly_v1.parquet"
    report_path = report_dir / f"{report_month}_ingest.json"

    pq.write_table(table, parquet_path, compression="zstd")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Rows loaded: {report['totals'].get('rows_loaded', 0)}")
    print(f"Headers OK: {report['all_headers_ok']}")
    print(f"Parquet written: {parquet_path}")
    print(f"Ingest report written: {report_path}")


if __name__ == "__main__":
    main()
