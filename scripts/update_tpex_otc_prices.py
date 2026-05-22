from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
UNIVERSE_PATH = ROOT / "public" / "data" / "universe" / "tw-assets.json"
OUTPUT_PATH = ROOT / "public" / "data" / "market" / "tpex-otc-prices.json"
SOURCE_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes"
SOURCE_NAME = "tpex-openapi-mainboard-daily-close-quotes"
STATIC_SOURCE = "static-tpex-otc-json"
UNAVAILABLE_MESSAGE = "上櫃價格尚未追蹤。"


def main() -> int:
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    symbols = load_otc_universe_symbols()

    try:
        records = fetch_tpex_records()
    except Exception as exc:  # noqa: BLE001 - preserve previous valid data on source failure.
        return report_failure([f"TPEx fetch failed: {exc}"])

    quotes, trade_date, stats = build_quotes(symbols, records, generated_at)
    payload = {
        "version": 1,
        "market": "TW",
        "segment": "otc",
        "source": SOURCE_NAME,
        "generatedAt": generated_at,
        "tradeDate": trade_date,
        "currency": "TWD",
        "targetSource": "tw-assets.json",
        "targetCount": len(symbols),
        "quoteCount": len(quotes),
        "pricedCount": stats["priced"],
        "unavailableCount": stats["unavailable"],
        "skippedSourceRowCount": stats["skipped_source_rows"],
        "malformedSourceRowCount": stats["malformed_source_rows"],
        "quotes": quotes,
        "errors": [],
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"source: {SOURCE_NAME}")
    print(f"target source: tw-assets.json")
    print(f"requested otc assets: {len(symbols)}")
    print(f"quotes written: {len(quotes)}")
    print(f"quotes priced: {stats['priced']}")
    print(f"quotes unavailable: {stats['unavailable']}")
    print(f"source rows skipped: {stats['skipped_source_rows']}")
    print(f"malformed source rows: {stats['malformed_source_rows']}")
    print(f"trade date: {trade_date}")
    print(f"output path: {OUTPUT_PATH}")

    return 0


def load_otc_universe_symbols() -> list[dict[str, str]]:
    raw = json.loads(UNIVERSE_PATH.read_text(encoding="utf-8"))
    assets = raw.get("assets")
    if not isinstance(assets, list):
        raise ValueError("tw-assets.json must contain an assets array")

    symbols: list[dict[str, str]] = []
    seen: set[str] = set()
    for asset in assets:
        if not isinstance(asset, dict):
            continue
        symbol = normalize_symbol(asset.get("symbol"))
        asset_type = str(asset.get("type", "")).strip()
        market = str(asset.get("market", "")).strip()
        exchange = str(asset.get("exchange", "")).strip().upper()
        market_segment = str(asset.get("marketSegment", "")).strip()
        price_source = str(asset.get("priceSource", "")).strip()
        name = str(asset.get("name", "")).strip()
        if (
            not symbol
            or symbol in seen
            or market != "TW"
            or exchange != "TPEX"
            or market_segment != "otc"
            or price_source != "tpex_otc"
            or asset_type not in {"taiwan_stock", "taiwan_etf"}
        ):
            continue
        seen.add(symbol)
        symbols.append({"symbol": symbol, "name": name or symbol, "type": asset_type})
    return sorted(symbols, key=lambda item: item["symbol"])


def fetch_tpex_records() -> list[dict[str, Any]]:
    request = urllib.request.Request(
        SOURCE_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "investment-portfolio-tpex-otc-price-updater/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(str(exc.reason)) from exc

    parsed = json.loads(body.decode("utf-8-sig"))
    if not isinstance(parsed, list):
        raise ValueError("TPEx response was not a JSON array")
    return parsed


def build_quotes(
    symbols: list[dict[str, str]],
    records: list[dict[str, Any]],
    generated_at: str,
) -> tuple[dict[str, dict[str, Any]], str | None, dict[str, int]]:
    by_symbol: dict[str, dict[str, Any]] = {}
    malformed_source_rows = 0
    for record in records:
        symbol = normalize_symbol(record.get("SecuritiesCompanyCode"))
        if not symbol:
            malformed_source_rows += 1
            continue
        by_symbol[symbol] = record

    target_symbols = {item["symbol"] for item in symbols}
    quotes: dict[str, dict[str, Any]] = {}
    trade_date: str | None = None
    priced = 0
    unavailable = 0

    for item in symbols:
        symbol = item["symbol"]
        record = by_symbol.get(symbol)
        record_date = str(record.get("Date", "")).strip() if record else ""
        record_trade_date = roc_date_to_iso(record_date) if record_date else trade_date
        if record_trade_date and trade_date is None:
            trade_date = record_trade_date

        price = parse_price(record.get("Close")) if record else None
        name = str(item.get("name") or symbol)
        if price is None:
            unavailable += 1
            quotes[symbol] = {
                "symbol": symbol,
                "name": name,
                "price": None,
                "currency": "TWD",
                "source": STATIC_SOURCE,
                "tradeDate": record_trade_date,
                "lastUpdated": generated_at,
                "status": "unavailable",
                "error": UNAVAILABLE_MESSAGE,
            }
            continue

        priced += 1
        quotes[symbol] = {
            "symbol": symbol,
            "name": name,
            "price": price,
            "currency": "TWD",
            "source": STATIC_SOURCE,
            "tradeDate": record_trade_date,
            "lastUpdated": generated_at,
            "status": "ok",
        }

    skipped_source_rows = len(
        [
            symbol
            for symbol, record in by_symbol.items()
            if symbol not in target_symbols and parse_price(record.get("Close")) is not None
        ],
    )

    return quotes, trade_date, {
        "priced": priced,
        "unavailable": unavailable,
        "skipped_source_rows": skipped_source_rows,
        "malformed_source_rows": malformed_source_rows,
    }


def parse_price(value: Any) -> float | None:
    if value is None:
        return None
    normalized = str(value).replace(",", "").strip()
    if not normalized or normalized in {"--", "-", "N/A", "NA"}:
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
    print("requested otc assets: 0")
    print("quotes written: 0")
    print("quotes priced: 0")
    print("quotes unavailable: 0")
    print("source rows skipped: 0")
    print("malformed source rows: 0")
    print(f"output path preserved: {OUTPUT_PATH}")
    print("errors:")
    for error in errors:
        print(f"- {error}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
