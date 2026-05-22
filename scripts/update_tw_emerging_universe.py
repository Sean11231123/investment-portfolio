from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://www.tpex.org.tw/openapi/v1/tpex_esb_latest_statistics"
SOURCE_NAME = "tpex-esb-latest-statistics"
DEFAULT_OUTPUT_PATH = ROOT / "public" / "data" / "universe" / "tw-emerging-assets.json"
DEFAULT_EXISTING_TW_PATH = ROOT / "public" / "data" / "universe" / "tw-assets.json"

MISSING_MARKERS = {"", "-", "--", "...", "…", "N/A", "NA", "null", "None"}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate Taiwan emerging stock metadata from official TPEx OpenAPI data.",
    )
    parser.add_argument("--input", type=Path, help="Read fixture JSON instead of fetching TPEx.")
    parser.add_argument("--existing-tw-assets", type=Path, default=DEFAULT_EXISTING_TW_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--dry-run", action="store_true", help="Print summary without writing output.")
    parser.add_argument("--write", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    errors: list[str] = []

    try:
        rows = load_rows(args.input)
        existing_symbols = load_existing_symbols(args.existing_tw_assets)
        raw_assets, parse_stats = parse_emerging_assets(rows, generated_at)
        assets, excluded_conflicts = exclude_conflicting_assets(raw_assets, existing_symbols)
        payload = build_payload(raw_assets, assets, excluded_conflicts, generated_at, errors)
        audit = audit_assets(rows, raw_assets, assets, existing_symbols, excluded_conflicts)
    except Exception as exc:  # noqa: BLE001 - prototype should fail clearly.
        print(f"source: {SOURCE_NAME}")
        print("status: failed")
        print(f"error: {exc}")
        return 1

    should_write = args.write or not args.dry_run
    print_summary(audit, parse_stats, args.output, write=should_write)

    if should_write:
        write_json_atomic(args.output, payload)
        print(f"output written: {args.output}")
        print(f"output size: {args.output.stat().st_size} bytes")
    else:
        print("dry run: output not written")

    return 0


def load_rows(input_path: Path | None) -> list[dict[str, Any]]:
    if input_path:
        value = json.loads(input_path.read_text(encoding="utf-8"))
    else:
        request = urllib.request.Request(
            SOURCE_URL,
            headers={
                "Accept": "application/json",
                "User-Agent": "investment-portfolio-tw-emerging-prototype/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                value = json.loads(response.read().decode("utf-8-sig"))
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"TPEx endpoint returned HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"TPEx endpoint failed: {exc.reason}") from exc

    if not isinstance(value, list):
        raise ValueError("TPEx emerging source must be a JSON array.")

    return [row for row in value if isinstance(row, dict)]


def load_existing_symbols(path: Path) -> set[str]:
    if not path.exists():
        return set()

    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()

    assets = value.get("assets") if isinstance(value, dict) else None
    if not isinstance(assets, list):
        return set()

    symbols: set[str] = set()
    for asset in assets:
        if isinstance(asset, dict) and isinstance(asset.get("symbol"), str):
            symbols.add(asset["symbol"].strip().upper())
    return symbols


def parse_emerging_assets(
    rows: list[dict[str, Any]],
    generated_at: str,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    assets: list[dict[str, Any]] = []
    malformed = 0
    seen: set[str] = set()
    duplicates = 0

    for row in rows:
        symbol = normalize_symbol(row.get("SecuritiesCompanyCode"))
        name = clean_text(row.get("CompanyName"))
        if not symbol or not name:
            malformed += 1
            continue
        if symbol in seen:
            duplicates += 1
            continue
        seen.add(symbol)

        warnings = build_warnings(row)
        asset: dict[str, Any] = {
            "symbol": symbol,
            "name": name,
            "type": "taiwan_stock",
            "market": "TW",
            "currency": "TWD",
            "unitLabel": "股",
            "priceSource": "manual",
            "aliases": [name],
            "exchange": "TPEX",
            "marketSegment": "emerging",
            "board": "emerging",
            "securityType": "stock",
            "classificationSource": "tpex_openapi",
            "classificationConfidence": "high",
            "classificationUpdatedAt": generated_at,
            "classificationWarnings": warnings,
            "source": "tpex-esb-latest-statistics",
            "sourceSymbol": symbol,
            "dataQuality": "official",
        }
        assets.append(asset)

    return sorted(assets, key=lambda asset: asset["symbol"]), {
        "malformed": malformed,
        "duplicateSymbols": duplicates,
    }


def exclude_conflicting_assets(
    assets: list[dict[str, Any]],
    existing_symbols: set[str],
) -> tuple[list[dict[str, Any]], list[str]]:
    conflicts = sorted({asset["symbol"] for asset in assets} & existing_symbols)
    if not conflicts:
        return assets, []

    conflict_set = set(conflicts)
    return [asset for asset in assets if asset["symbol"] not in conflict_set], conflicts


def build_payload(
    raw_assets: list[dict[str, Any]],
    assets: list[dict[str, Any]],
    excluded_conflicts: list[str],
    generated_at: str,
    errors: list[str],
) -> dict[str, Any]:
    return {
        "version": 1,
        "market": "TW",
        "source": SOURCE_NAME,
        "sourceUrl": SOURCE_URL,
        "generatedAt": generated_at,
        "segment": "emerging",
        "rawCount": len(raw_assets),
        "count": len(assets),
        "excludedConflictCount": len(excluded_conflicts),
        "excludedConflicts": excluded_conflicts,
        "assets": assets,
        "errors": errors,
    }


def audit_assets(
    rows: list[dict[str, Any]],
    raw_assets: list[dict[str, Any]],
    production_assets: list[dict[str, Any]],
    existing_symbols: set[str],
    excluded_conflicts: list[str],
) -> dict[str, Any]:
    raw_symbols = [asset["symbol"] for asset in raw_assets]
    production_symbols = [asset["symbol"] for asset in production_assets]
    names = [asset["name"] for asset in raw_assets]
    source_symbols = [
        normalize_symbol(row.get("SecuritiesCompanyCode"))
        for row in rows
        if normalize_symbol(row.get("SecuritiesCompanyCode"))
    ]
    source_names = [
        clean_text(row.get("CompanyName"))
        for row in rows
        if clean_text(row.get("CompanyName"))
    ]
    symbol_counts = Counter(source_symbols)
    name_counts = Counter(source_names)

    return {
        "sourceRows": len(rows),
        "rawAssets": len(raw_assets),
        "productionAssets": len(production_assets),
        "rowsWithSymbol": len(source_symbols),
        "duplicateSymbolCount": sum(count - 1 for count in symbol_counts.values() if count > 1),
        "duplicateNameCount": sum(count - 1 for count in name_counts.values() if count > 1),
        "existingListedOtcConflictCount": len(excluded_conflicts),
        "existingListedOtcConflicts": excluded_conflicts,
        "sampleSymbols": production_symbols[:5],
        "rawSampleSymbols": raw_symbols[:5],
        "warningCount": sum(len(asset.get("classificationWarnings", [])) for asset in raw_assets),
    }


def print_summary(
    audit: dict[str, Any],
    parse_stats: dict[str, int],
    output_path: Path,
    *,
    write: bool,
) -> None:
    print(f"source: {SOURCE_NAME}")
    print(f"endpoint: {SOURCE_URL}")
    print("format: JSON")
    print("access: public/no-key")
    print(f"source rows: {audit['sourceRows']}")
    print(f"rows with symbol: {audit['rowsWithSymbol']}")
    print(f"raw assets parsed: {audit['rawAssets']}")
    print(f"production assets: {audit['productionAssets']}")
    print(f"malformed rows skipped: {parse_stats['malformed']}")
    print(f"duplicate symbols skipped: {parse_stats['duplicateSymbols']}")
    print(f"duplicate symbol count: {audit['duplicateSymbolCount']}")
    print(f"duplicate name count: {audit['duplicateNameCount']}")
    print(f"listed/otc symbol conflicts: {audit['existingListedOtcConflictCount']}")
    if audit["existingListedOtcConflicts"]:
        print(f"conflict samples: {', '.join(audit['existingListedOtcConflicts'][:10])}")
    print(f"classification warnings: {audit['warningCount']}")
    print(f"sample symbols: {', '.join(audit['sampleSymbols'])}")
    print(f"output path: {output_path}")
    print(f"write mode: {'enabled' if write else 'disabled'}")


def build_warnings(row: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    suspend_time = clean_text(row.get("SuspendTime"))
    applying_status = clean_text(row.get("ApplyingStatus"))
    if suspend_time and suspend_time != "000000":
        warnings.append(f"suspendTime={suspend_time}")
    if applying_status:
        warnings.append(f"applyingStatus={applying_status}")
    return warnings


def normalize_symbol(value: Any) -> str | None:
    text = clean_text(value).upper()
    if text in MISSING_MARKERS:
        return None
    return text if re.fullmatch(r"[0-9A-Z]{4,6}", text) else None


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=path.parent,
        delete=False,
        newline="\n",
    ) as handle:
        handle.write(serialized)
        temp_path = Path(handle.name)
    temp_path.replace(path)


if __name__ == "__main__":
    sys.exit(main())
