from __future__ import annotations

import json
import math
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import openpyxl
import pyarrow as pa

SCHEMA_REL_PATH = Path("schemas") / "sales_monthly_v1.json"
SCHEMA_ID = "sales_monthly_v1"
EXPECTED_SOURCE_COLUMN_COUNT = 15


@dataclass(frozen=True)
class SchemaDefinition:
    schema_id: str
    expected_header_order: list[str]
    fields: list[dict[str, Any]]


def normalize_header(value: Any) -> str:
    text = "" if value is None else str(value)
    ascii_text = (
        unicodedata.normalize("NFKD", text)
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
        .lower()
    )
    return re.sub(r"\s+", " ", ascii_text)


def parse_report_month(path: Path) -> str:
    match = re.search(r"(20\d{2}-\d{2})", path.name)
    if match:
        return match.group(1)
    raise ValueError(f"Could not parse report month from file name: {path.name}")


def load_schema_definition(base_dir: Path) -> SchemaDefinition:
    schema_path = base_dir / SCHEMA_REL_PATH
    with schema_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    schema_id = payload.get("schema_id")
    if schema_id != SCHEMA_ID:
        raise ValueError(f"Unexpected schema_id: {schema_id!r}")

    source = payload.get("source", {})
    header_order = source.get("header_order", [])
    fields = payload.get("fields", [])

    if len(header_order) != EXPECTED_SOURCE_COLUMN_COUNT:
        raise ValueError("Schema header order does not contain 15 columns.")
    if not fields:
        raise ValueError("Schema must define fields.")

    return SchemaDefinition(
        schema_id=schema_id,
        expected_header_order=[str(x) for x in header_order],
        fields=fields,
    )


def build_arrow_schema(fields: list[dict[str, Any]]) -> pa.Schema:
    type_map: dict[str, Any] = {
        "string": pa.string(),
        "int32": pa.int32(),
        "int64": pa.int64(),
        "float64": pa.float64(),
        "bool": pa.bool_(),
    }

    arrow_fields: list[pa.Field] = []
    for field in fields:
        field_name = str(field["name"])
        type_name = str(field["type"])
        nullable = bool(field.get("nullable", True))
        if type_name not in type_map:
            raise ValueError(f"Unsupported field type: {type_name}")
        arrow_fields.append(pa.field(field_name, type_map[type_name], nullable=nullable))
    return pa.schema(arrow_fields)


def parse_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text if text else None
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if math.isnan(value):
            return None
        if value.is_integer():
            return str(int(value))
        text = format(value, "f").rstrip("0").rstrip(".")
        return text if text else "0"
    text = str(value).strip()
    return text if text else None


def parse_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
        return None if math.isnan(numeric) else numeric
    if isinstance(value, str):
        cleaned = value.strip().replace(" ", "").replace("\u00A0", "")
        if not cleaned:
            return None
        cleaned = cleaned.replace(",", ".")
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def header_matches(actual_header: list[Any], expected_header: list[str]) -> bool:
    if len(actual_header) < len(expected_header):
        return False
    actual_norm = [normalize_header(v) for v in actual_header[: len(expected_header)]]
    expected_norm = [normalize_header(v) for v in expected_header]
    return actual_norm == expected_norm


def open_workbook(path: Path):
    return openpyxl.load_workbook(path, data_only=True, read_only=True)


def is_empty_row(row: tuple[Any, ...]) -> bool:
    for value in row:
        if value not in (None, ""):
            return False
    return True
