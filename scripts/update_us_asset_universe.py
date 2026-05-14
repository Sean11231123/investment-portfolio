from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "public" / "data" / "universe" / "us-assets.json"
SOURCE_NAME = "nasdaqtrader-symbol-directory"
NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
OTHER_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"

EXCHANGE_BY_CODE = {
    "A": "NYSEAMERICAN",
    "N": "NYSE",
    "P": "NYSEARCA",
    "V": "IEX",
    "Z": "BATS",
}

NON_TARGET_NAME_PATTERNS = (
    r"\bwarrants?\b",
    r"\bright(s)?\b",
    r"\bunits?\b",
    r"\bpreferred\b",
    r"\bpreference\b",
    r"\bdepositary shares?\b",
    r"\bnotes?\b",
    r"\bsenior notes?\b",
    r"\bsubordinated notes?\b",
    r"\bdebentures?\b",
    r"\bbaby bond\b",
    r"\betn\b",
    r"\bexchange traded notes?\b",
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the US searchable asset universe from Nasdaq Trader symbol directories.",
    )
    parser.add_argument("--nasdaq-listed", type=Path, help="Fixture nasdaqlisted.txt path.")
    parser.add_argument("--other-listed", type=Path, help="Fixture otherlisted.txt path.")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    try:
        nasdaq_text = (
            args.nasdaq_listed.read_text(encoding="utf-8-sig")
            if args.nasdaq_listed
            else fetch_text(NASDAQ_LISTED_URL)
        )
        other_text = (
            args.other_listed.read_text(encoding="utf-8-sig")
            if args.other_listed
            else fetch_text(OTHER_LISTED_URL)
        )
        assets, skipped_count = parse_us_asset_universe(nasdaq_text, other_text)
    except Exception as exc:  # noqa: BLE001 - avoid clobbering last good universe.
        return report_failure(args.output, [f"Nasdaq Trader fetch/parse failed: {exc}"])

    if not assets:
        return report_failure(args.output, ["Nasdaq Trader parse produced no target assets."])

    stock_count = sum(1 for asset in assets if asset["type"] == "us_stock")
    etf_count = sum(1 for asset in assets if asset["type"] == "us_etf")
    payload = build_payload(
        assets=assets,
        generated_at=generated_at,
        skipped_count=skipped_count,
        errors=[],
        existing_path=args.output,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"source: {SOURCE_NAME}")
    print(f"assets generated: {len(assets)}")
    print(f"stocks: {stock_count}")
    print(f"etfs: {etf_count}")
    print(f"skipped: {skipped_count}")
    print(f"output path: {args.output}")
    return 0


def fetch_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "text/plain,*/*",
            "User-Agent": "investment-portfolio-us-universe-updater/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read().decode("utf-8-sig")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"{url} returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{url}: {exc.reason}") from exc


def parse_us_asset_universe(
    nasdaq_listed_text: str,
    other_listed_text: str,
) -> tuple[list[dict[str, Any]], int]:
    assets: list[dict[str, Any]] = []
    skipped_count = 0
    seen: set[tuple[str, str]] = set()

    for row in parse_pipe_rows(nasdaq_listed_text):
        asset = asset_from_nasdaq_row(row)
        if asset is None:
            skipped_count += 1
            continue
        add_asset(assets, seen, asset)

    for row in parse_pipe_rows(other_listed_text):
        asset = asset_from_other_row(row)
        if asset is None:
            skipped_count += 1
            continue
        add_asset(assets, seen, asset)

    return sorted(assets, key=lambda asset: asset["symbol"]), skipped_count


def parse_pipe_rows(text: str) -> list[dict[str, str]]:
    lines = [
        line
        for line in text.splitlines()
        if line.strip() and not line.startswith("File Creation Time:")
    ]
    if not lines:
        return []
    return list(csv.DictReader(lines, delimiter="|"))


def asset_from_nasdaq_row(row: dict[str, str]) -> dict[str, Any] | None:
    return build_asset(
        symbol=row.get("Symbol", ""),
        name=row.get("Security Name", ""),
        etf_flag=row.get("ETF", ""),
        test_issue=row.get("Test Issue", ""),
        exchange="NASDAQ",
    )


def asset_from_other_row(row: dict[str, str]) -> dict[str, Any] | None:
    return build_asset(
        symbol=row.get("ACT Symbol", ""),
        name=row.get("Security Name", ""),
        etf_flag=row.get("ETF", ""),
        test_issue=row.get("Test Issue", ""),
        exchange=EXCHANGE_BY_CODE.get(row.get("Exchange", "").strip().upper(), "US"),
    )


def build_asset(
    symbol: str,
    name: str,
    etf_flag: str,
    test_issue: str,
    exchange: str,
) -> dict[str, Any] | None:
    normalized_symbol = normalize_symbol(symbol)
    normalized_name = clean_name(name)
    is_etf = etf_flag.strip().upper() == "Y"

    if test_issue.strip().upper() == "Y":
        return None
    if not normalized_symbol or not normalized_name:
        return None
    if not re.fullmatch(r"[A-Z][A-Z0-9]{0,5}", normalized_symbol):
        return None
    if has_non_target_name(normalized_name):
        return None
    if etf_flag.strip().upper() not in {"Y", "N"}:
        return None

    return {
        "symbol": normalized_symbol,
        "name": normalized_name,
        "type": "us_etf" if is_etf else "us_stock",
        "market": "US",
        "currency": "USD",
        "unitLabel": "股",
        "priceSource": "us_static",
        "aliases": [alias_name(normalized_name)],
        "exchange": exchange,
        "source": SOURCE_NAME,
        "sourceSymbol": normalized_symbol,
        "stooqSymbol": f"{normalized_symbol.lower()}.us",
        "isETF": is_etf,
        "dataQuality": "generated",
    }


def add_asset(
    assets: list[dict[str, Any]],
    seen: set[tuple[str, str]],
    asset: dict[str, Any],
) -> None:
    key = (asset["symbol"], asset["type"])
    if key in seen:
        return
    seen.add(key)
    assets.append(asset)


def build_payload(
    assets: list[dict[str, Any]],
    generated_at: str,
    skipped_count: int,
    errors: list[str],
    existing_path: Path = OUTPUT_PATH,
) -> dict[str, Any]:
    stock_count = sum(1 for asset in assets if asset["type"] == "us_stock")
    etf_count = sum(1 for asset in assets if asset["type"] == "us_etf")
    payload = {
        "version": 1,
        "market": "US",
        "source": SOURCE_NAME,
        "generatedAt": generated_at,
        "count": len(assets),
        "stockCount": stock_count,
        "etfCount": etf_count,
        "skippedCount": skipped_count,
        "sourceFiles": ["nasdaqlisted.txt", "otherlisted.txt"],
        "assets": assets,
        "errors": errors,
    }

    existing = load_existing_payload(existing_path)
    if existing and payload_without_generated_at(existing) == payload_without_generated_at(payload):
        payload["generatedAt"] = existing["generatedAt"]

    return payload


def load_existing_payload(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) and isinstance(value.get("generatedAt"), str) else None


def payload_without_generated_at(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if key != "generatedAt"}


def normalize_symbol(value: str) -> str:
    return str(value or "").strip().upper()


def clean_name(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def alias_name(name: str) -> str:
    return re.sub(r"\s+-\s+Common Stock$", "", name).strip()


def has_non_target_name(name: str) -> bool:
    lowered = name.lower()
    return any(re.search(pattern, lowered) for pattern in NON_TARGET_NAME_PATTERNS)


def report_failure(output_path: Path, errors: list[str]) -> int:
    print(f"source: {SOURCE_NAME}")
    print("assets generated: 0")
    print("stocks: 0")
    print("etfs: 0")
    print("skipped: 0")
    print(f"output path preserved: {output_path}")
    print("errors:")
    for error in errors:
        print(f"- {error}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
