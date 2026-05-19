from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "scripts" / "market_symbols_tw.json"
UNIVERSE_PATH = ROOT / "public" / "data" / "universe" / "tw-assets.json"
OUTPUT_PATH = ROOT / "public" / "data" / "market" / "tw-prices.json"
SOURCE_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_AVG_ALL"
SOURCE_NAME = "twse-openapi-STOCK_DAY_AVG_ALL"
UNAVAILABLE_TW_PRICE_MESSAGE = "尚未取得台股/ETF 價格。"


def main() -> int:
    symbols, target_source = load_target_symbols()
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    try:
        records = fetch_twse_records()
    except Exception as exc:  # noqa: BLE001 - avoid clobbering the last good file.
        return report_failure([f"TWSE fetch failed: {exc}"])

    quotes, trade_date, stats = build_quotes(symbols, records, generated_at)

    payload = {
        "version": 1,
        "market": "TW",
        "source": SOURCE_NAME,
        "generatedAt": generated_at,
        "tradeDate": trade_date,
        "currency": "TWD",
        "mode": "broad",
        "targetSource": target_source,
        "targetCount": len(symbols),
        "quoteCount": len(quotes),
        "pricedCount": stats["priced"],
        "unavailableCount": stats["unavailable"],
        "skippedSourceRowCount": stats["skipped_source_rows"],
        "quotes": quotes,
        "errors": [],
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"source: {SOURCE_NAME}")
    print(f"mode: broad")
    print(f"target source: {target_source}")
    print(f"target symbols: {len(symbols)}")
    print(f"quotes written: {len(quotes)}")
    print(f"quotes priced: {stats['priced']}")
    print(f"quotes unavailable: {stats['unavailable']}")
    print(f"source rows skipped: {stats['skipped_source_rows']}")
    print(f"output path: {OUTPUT_PATH}")

    return 0


def load_target_symbols() -> tuple[list[dict[str, str]], str]:
    universe_symbols = load_universe_symbols()
    if universe_symbols:
        return universe_symbols, "tw-assets.json"
    return load_symbols(), "market_symbols_tw.json"


def load_universe_symbols() -> list[dict[str, str]]:
    try:
        raw = json.loads(UNIVERSE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    assets = raw.get("assets")
    if not isinstance(assets, list):
        return []

    symbols: list[dict[str, str]] = []
    seen: set[str] = set()
    for asset in assets:
        if not isinstance(asset, dict):
            continue
        symbol = normalize_symbol(asset.get("symbol"))
        asset_type = str(asset.get("type", "")).strip()
        market = str(asset.get("market", "")).strip()
        name = str(asset.get("name", "")).strip()
        exchange = str(asset.get("exchange", "")).strip().upper()
        price_source = str(asset.get("priceSource", "")).strip()
        if (
            not symbol
            or symbol in seen
            or market != "TW"
            or asset_type not in {"taiwan_stock", "taiwan_etf"}
            or (exchange and exchange != "TWSE")
            or (price_source and price_source != "twse")
        ):
            continue
        seen.add(symbol)
        symbols.append({"symbol": symbol, "name": name or symbol, "type": asset_type})
    return sorted(symbols, key=lambda item: item["symbol"])


def load_symbols() -> list[dict[str, str]]:
    raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    symbols = raw.get("symbols")
    if not isinstance(symbols, list):
        raise ValueError("market_symbols_tw.json must contain a symbols array")
    normalized: list[dict[str, str]] = []
    for item in symbols:
        symbol = normalize_symbol(item.get("symbol"))
        name = str(item.get("name", "")).strip()
        if symbol:
            normalized.append({"symbol": symbol, "name": name or symbol})
    return normalized


def fetch_twse_records() -> list[dict[str, Any]]:
    request = urllib.request.Request(
        SOURCE_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "investment-portfolio-market-data-updater/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8-sig")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(str(exc.reason)) from exc

    parsed = json.loads(body)
    if not isinstance(parsed, list):
        raise ValueError("TWSE response was not a JSON array")
    return parsed


def build_quotes(
    symbols: list[dict[str, str]],
    records: list[dict[str, Any]],
    generated_at: str,
) -> tuple[dict[str, dict[str, Any]], str | None, dict[str, int]]:
    by_symbol = {
        normalize_symbol(record.get("Code")): record
        for record in records
        if normalize_symbol(record.get("Code"))
    }
    target_symbols = {item["symbol"] for item in symbols}
    quotes: dict[str, dict[str, Any]] = {}
    trade_date: str | None = None
    priced = 0
    unavailable = 0

    for item in symbols:
        symbol = normalize_symbol(item["symbol"])
        configured_name = str(item["name"])
        record = by_symbol.get(symbol)
        record_date = str(record.get("Date", "")).strip() if record else ""
        price = parse_price(record.get("ClosingPrice")) if record else None
        if record_date and trade_date is None:
            trade_date = roc_date_to_iso(record_date)

        if price is None:
            unavailable += 1
            quotes[symbol] = {
                "symbol": symbol,
                "name": configured_name,
                "price": None,
                "currency": "TWD",
                "source": "twse",
                "tradeDate": roc_date_to_iso(record_date) if record_date else trade_date,
                "lastUpdated": generated_at,
                "status": "unavailable",
                "error": UNAVAILABLE_TW_PRICE_MESSAGE,
            }
            continue

        priced += 1
        quotes[symbol] = {
            "symbol": symbol,
            "name": configured_name,
            "price": price,
            "currency": "TWD",
            "source": "twse",
            "tradeDate": roc_date_to_iso(record_date),
            "lastUpdated": generated_at,
            "status": "ok",
        }

    skipped_source_rows = len(
        [
            symbol
            for symbol, record in by_symbol.items()
            if symbol not in target_symbols and parse_price(record.get("ClosingPrice")) is not None
        ],
    )

    return quotes, trade_date, {
        "priced": priced,
        "unavailable": unavailable,
        "skipped_source_rows": skipped_source_rows,
    }


def parse_price(value: Any) -> float | None:
    if value is None:
        return None
    normalized = str(value).replace(",", "").strip()
    if not normalized:
        return None
    try:
        price = float(normalized)
    except ValueError:
        return None
    return price if price > 0 else None


def normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def roc_date_to_iso(value: str) -> str | None:
    digits = "".join(char for char in value if char.isdigit())
    if len(digits) != 7:
        return None
    year = int(digits[:3]) + 1911
    month = int(digits[3:5])
    day = int(digits[5:7])
    return f"{year:04d}-{month:02d}-{day:02d}"


def report_failure(errors: list[str]) -> int:
    print(f"source: {SOURCE_NAME}")
    print("mode: broad")
    print("target symbols: 0")
    print("quotes written: 0")
    print("quotes priced: 0")
    print("quotes unavailable: 0")
    print("source rows skipped: 0")
    print(f"output path preserved: {OUTPUT_PATH}")
    print("errors:")
    for error in errors:
        print(f"- {error}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
