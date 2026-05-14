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
OUTPUT_PATH = ROOT / "public" / "data" / "market" / "tw-prices.json"
SOURCE_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_AVG_ALL"
SOURCE_NAME = "twse-openapi-STOCK_DAY_AVG_ALL"


def main() -> int:
    symbols = load_symbols()
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    errors: list[str] = []
    records: list[dict[str, Any]] = []

    try:
        records = fetch_twse_records()
    except Exception as exc:  # noqa: BLE001 - produce valid JSON on any fetch failure.
        errors.append(f"TWSE fetch failed: {exc}")

    quotes, trade_date, missing = build_quotes(symbols, records, generated_at)
    errors.extend([f"{symbol} price unavailable" for symbol in missing])

    payload = {
        "version": 1,
        "market": "TW",
        "source": SOURCE_NAME,
        "generatedAt": generated_at,
        "tradeDate": trade_date,
        "currency": "TWD",
        "quotes": quotes,
        "errors": errors,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"source: {SOURCE_NAME}")
    print(f"symbols requested: {len(symbols)}")
    print(f"quotes found: {len([q for q in quotes.values() if q['status'] == 'ok'])}")
    print(f"quotes missing: {len(missing)}")
    print(f"output path: {OUTPUT_PATH}")
    if errors:
        print("errors:")
        for error in errors:
            print(f"- {error}")

    return 0


def load_symbols() -> list[dict[str, str]]:
    raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    symbols = raw.get("symbols")
    if not isinstance(symbols, list):
        raise ValueError("market_symbols_tw.json must contain a symbols array")
    return symbols


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
) -> tuple[dict[str, dict[str, Any]], str | None, list[str]]:
    by_symbol = {str(record.get("Code", "")).strip(): record for record in records}
    quotes: dict[str, dict[str, Any]] = {}
    missing: list[str] = []
    trade_date: str | None = None

    for item in symbols:
        symbol = str(item["symbol"]).strip()
        configured_name = str(item["name"])
        record = by_symbol.get(symbol)
        record_date = str(record.get("Date", "")).strip() if record else ""
        price = parse_price(record.get("ClosingPrice")) if record else None
        if record_date and trade_date is None:
            trade_date = roc_date_to_iso(record_date)

        if price is None:
            missing.append(symbol)
            quotes[symbol] = {
                "symbol": symbol,
                "name": configured_name,
                "price": None,
                "currency": "TWD",
                "source": "twse",
                "tradeDate": roc_date_to_iso(record_date) if record_date else trade_date,
                "lastUpdated": generated_at,
                "status": "unavailable",
            }
            continue

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

    return quotes, trade_date, missing


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


def roc_date_to_iso(value: str) -> str | None:
    digits = "".join(char for char in value if char.isdigit())
    if len(digits) != 7:
        return None
    year = int(digits[:3]) + 1911
    month = int(digits[3:5])
    day = int(digits[5:7])
    return f"{year:04d}-{month:02d}-{day:02d}"


if __name__ == "__main__":
    sys.exit(main())
