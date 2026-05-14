from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True
import validate_etf_components


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "public" / "data" / "etf-components"
ALLOWED_DATA_QUALITY = {"sample", "manual", "verified", "stale"}

HEADER_MAP = {
    "symbol": "symbol",
    "name": "name",
    "weight": "weight",
    "代號": "symbol",
    "名稱": "name",
    "權重": "weight",
}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Normalize a user-provided ETF component CSV into canonical JSON.",
    )
    parser.add_argument("--csv", required=True, dest="csv_path", help="Input CSV path")
    parser.add_argument("--meta", required=True, dest="meta_path", help="ETF metadata JSON path")
    parser.add_argument("--output", help="Optional output JSON path")
    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    meta_path = Path(args.meta_path)
    warnings: list[str] = []
    errors: list[str] = []

    metadata = read_metadata(meta_path, errors)
    components = read_components_csv(csv_path, errors)

    if metadata is None or components is None:
        print_report(csv_path, meta_path, None, None, None, warnings, errors)
        return 1

    output_path = (
        Path(args.output)
        if args.output
        else DEFAULT_OUTPUT_DIR / f"{metadata['symbol']}.json"
    )
    payload = build_payload(metadata, components)
    validation = validate_etf_components.validate_dataset(output_path.resolve(), payload)
    warnings.extend(validation.warnings)
    errors.extend(validation.errors)

    if errors:
        print_report(
            csv_path,
            meta_path,
            output_path,
            metadata,
            payload,
            warnings,
            errors,
        )
        return 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print_report(
        csv_path,
        meta_path,
        output_path,
        metadata,
        payload,
        warnings,
        errors,
    )
    return 0


def read_metadata(path: Path, errors: list[str]) -> dict[str, str] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        errors.append(f"metadata file not found: {path}")
        return None
    except json.JSONDecodeError as exc:
        errors.append(f"metadata JSON is invalid: {exc}")
        return None

    if not isinstance(data, dict):
        errors.append("metadata must be a JSON object")
        return None

    required = ["symbol", "name", "sourceNote", "lastUpdated", "dataQuality"]
    normalized: dict[str, str] = {}
    for key in required:
        value = data.get(key)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"metadata.{key} is required")
            continue
        normalized[key] = value.strip()

    source_url = data.get("sourceUrl", "")
    if source_url is not None and not isinstance(source_url, str):
        errors.append("metadata.sourceUrl must be a string when provided")
    normalized["sourceUrl"] = source_url.strip() if isinstance(source_url, str) else ""

    if "symbol" in normalized:
        normalized["symbol"] = normalized["symbol"].upper()

    if normalized.get("dataQuality") not in ALLOWED_DATA_QUALITY:
        errors.append(
            f"metadata.dataQuality must be one of {sorted(ALLOWED_DATA_QUALITY)}",
        )

    last_updated = normalized.get("lastUpdated")
    if last_updated:
        try:
            date.fromisoformat(last_updated)
        except ValueError:
            errors.append("metadata.lastUpdated must be a valid YYYY-MM-DD date")

    return normalized if not errors else None


def read_components_csv(path: Path, errors: list[str]) -> list[dict[str, Any]] | None:
    try:
        handle = path.open("r", encoding="utf-8-sig", newline="")
    except FileNotFoundError:
        errors.append(f"CSV file not found: {path}")
        return None

    with handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            errors.append("CSV must include a header row")
            return None

        column_map = normalize_headers(reader.fieldnames, errors)
        if errors:
            return None

        components: list[dict[str, Any]] = []
        seen_symbols: set[str] = set()
        for row_number, row in enumerate(reader, start=2):
            raw_symbol = get_cell(row, column_map, "symbol")
            raw_name = get_cell(row, column_map, "name")
            raw_weight = get_cell(row, column_map, "weight")

            if not raw_symbol and not raw_name and not raw_weight:
                continue

            symbol = raw_symbol.strip().upper()
            name = raw_name.strip()
            if not symbol:
                errors.append(f"row {row_number}: symbol is required")
            if not name:
                errors.append(f"row {row_number}: name is required")
            if symbol and symbol in seen_symbols:
                errors.append(f"row {row_number}: duplicate symbol {symbol}")
            seen_symbols.add(symbol)

            weight = normalize_weight(raw_weight, row_number, errors)
            if symbol and name and weight is not None:
                components.append({
                    "symbol": symbol,
                    "name": name,
                    "weight": weight,
                })

        if not components:
            errors.append("CSV did not contain any valid component rows")

    return components if not errors else None


def normalize_headers(fieldnames: list[str], errors: list[str]) -> dict[str, str]:
    column_map: dict[str, str] = {}
    for fieldname in fieldnames:
        header = (fieldname or "").strip()
        key = HEADER_MAP.get(header.lower()) or HEADER_MAP.get(header)
        if not key:
            errors.append(f"unsupported CSV column: {header}")
            continue
        if key in column_map:
            errors.append(f"duplicate CSV column for {key}: {header}")
            continue
        column_map[key] = fieldname

    for required in ["symbol", "name", "weight"]:
        if required not in column_map:
            errors.append(f"CSV missing required column: {required}")

    return column_map


def get_cell(row: dict[str, str | None], column_map: dict[str, str], key: str) -> str:
    value = row.get(column_map[key], "")
    return value.strip() if isinstance(value, str) else ""


def normalize_weight(raw_value: str, row_number: int, errors: list[str]) -> float | None:
    value = raw_value.strip().replace(",", "")
    if not value:
        errors.append(f"row {row_number}: weight is required")
        return None

    is_percent = value.endswith("%")
    numeric_text = value[:-1].strip() if is_percent else value
    try:
        parsed = float(numeric_text)
    except ValueError:
        errors.append(f"row {row_number}: weight must be numeric")
        return None

    weight = parsed / 100 if is_percent else parsed
    if not is_percent and parsed > 1:
        errors.append(
            f"row {row_number}: bare weight {raw_value} is ambiguous; use 0-1 decimal or percent string",
        )
        return None
    if weight <= 0:
        errors.append(f"row {row_number}: weight must be > 0")
        return None
    if weight > 1:
        errors.append(f"row {row_number}: weight must be <= 1")
        return None

    return round(weight, 10)


def build_payload(metadata: dict[str, str], components: list[dict[str, Any]]) -> dict[str, Any]:
    total_weight = round(sum(float(component["weight"]) for component in components), 10)
    return {
        "version": 1,
        "symbol": metadata["symbol"],
        "name": metadata["name"],
        "market": "TW",
        "sourceNote": metadata["sourceNote"],
        "sourceUrl": metadata.get("sourceUrl", ""),
        "lastUpdated": metadata["lastUpdated"],
        "dataQuality": metadata["dataQuality"],
        "componentCount": len(components),
        "totalWeight": total_weight,
        "components": components,
    }


def print_report(
    csv_path: Path,
    meta_path: Path,
    output_path: Path | None,
    metadata: dict[str, str] | None,
    payload: dict[str, Any] | None,
    warnings: list[str],
    errors: list[str],
) -> None:
    print("ETF component CSV normalization report")
    print(f"input CSV path: {csv_path}")
    print(f"metadata path: {meta_path}")
    if output_path:
        print(f"output path: {output_path}")
    if metadata:
        print(f"ETF: {metadata.get('symbol')} {metadata.get('name')}")
    if payload:
        print(f"component count: {payload['componentCount']}")
        print(f"total weight: {payload['totalWeight']:.10f}")
    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"- {warning}")
    if errors:
        print("Errors:")
        for error in errors:
            print(f"- {error}")
        print("Final: FAIL")
    else:
        print("Final: PASS")
        print("Next: run npm run validate:etf-components")


if __name__ == "__main__":
    sys.exit(main())
