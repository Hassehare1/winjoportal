from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from common import (
    header_matches,
    is_empty_row,
    load_schema_definition,
    open_workbook,
    parse_number,
    parse_text,
    parse_report_month,
)


def profile_workbook(input_path: Path, base_dir: Path) -> dict[str, Any]:
    schema = load_schema_definition(base_dir)
    wb = open_workbook(input_path)
    report_month = parse_report_month(input_path)

    workbook_summary: dict[str, Any] = {
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

        per_col_missing = defaultdict(int)
        data_rows = 0
        rows_with_any_value = 0
        negative_qty = 0
        non_integer_qty = 0
        zero_sales = 0
        negative_tb = 0
        negative_tg = 0
        tg_over_100 = 0
        negative_stock = 0
        unique_artnr = set()
        unique_ean = set()

        for row in rows:
            data_rows += 1
            if is_empty_row(row):
                continue
            rows_with_any_value += 1

            padded = list(row[:15]) + [None] * max(0, 15 - len(row))
            for idx, source_col in enumerate(schema.expected_header_order):
                if padded[idx] in (None, ""):
                    per_col_missing[source_col] += 1

            artnr = parse_text(padded[3])
            ean = parse_text(padded[4])
            qty = parse_number(padded[7])
            sales = parse_number(padded[8])
            tb = parse_number(padded[9])
            tg = parse_number(padded[10])
            stock = parse_number(padded[14])

            if artnr:
                unique_artnr.add(artnr)
            if ean:
                unique_ean.add(ean)

            if qty is not None:
                if qty < 0:
                    negative_qty += 1
                if abs(qty - round(qty)) > 1e-9:
                    non_integer_qty += 1
            if sales is not None and abs(sales) < 1e-9:
                zero_sales += 1
            if tb is not None and tb < 0:
                negative_tb += 1
            if tg is not None:
                if tg < 0:
                    negative_tg += 1
                if tg > 100:
                    tg_over_100 += 1
            if stock is not None and stock < 0:
                negative_stock += 1

        sheet_summary = {
            "sheet_name": sheet_name,
            "header_ok": header_ok,
            "rows_total_excluding_header": data_rows,
            "rows_non_empty": rows_with_any_value,
            "unique_artnr": len(unique_artnr),
            "unique_ean": len(unique_ean),
            "anomalies": {
                "negative_qty": negative_qty,
                "non_integer_qty": non_integer_qty,
                "zero_sales": zero_sales,
                "negative_tb": negative_tb,
                "negative_tg": negative_tg,
                "tg_over_100": tg_over_100,
                "negative_stock": negative_stock,
            },
            "missing_by_source_column": {k: v for k, v in per_col_missing.items() if v > 0},
        }
        workbook_summary["sheets"].append(sheet_summary)

        totals["rows_total_excluding_header"] += data_rows
        totals["rows_non_empty"] += rows_with_any_value
        totals["negative_qty"] += negative_qty
        totals["non_integer_qty"] += non_integer_qty
        totals["zero_sales"] += zero_sales
        totals["negative_tb"] += negative_tb
        totals["negative_tg"] += negative_tg
        totals["tg_over_100"] += tg_over_100
        totals["negative_stock"] += negative_stock

    workbook_summary["totals"] = dict(totals)
    workbook_summary["all_headers_ok"] = all(s["header_ok"] for s in workbook_summary["sheets"])
    return workbook_summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Profile monthly sales workbook.")
    parser.add_argument("--input", required=True, help="Path to input .xlsx")
    parser.add_argument(
        "--output",
        required=False,
        help="Optional path for JSON report. If omitted, prints summary only.",
    )
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    base_dir = Path(__file__).resolve().parents[1]
    report = profile_workbook(input_path, base_dir)

    print(f"Profiled file: {input_path.name}")
    print(f"Report month: {report['report_month']}")
    print(f"Sheets: {report['sheet_count']}")
    print(f"Rows (non-empty): {report['totals'].get('rows_non_empty', 0)}")
    print(f"Headers OK: {report['all_headers_ok']}")

    if args.output:
        output_path = Path(args.output).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Profile report written: {output_path}")


if __name__ == "__main__":
    main()
