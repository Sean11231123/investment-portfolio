#!/usr/bin/env python3
"""Update static US stock/ETF prices from Stooq no-key CSV data."""

from __future__ import annotations

import csv
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "scripts" / "market_symbols_us.json"
OUTPUT_PATH = ROOT / "public" / "data" / "market" / "us-prices.json"
STOOQ_URL = "https://stooq.com/q/l/"


def main() -> int:
  generated_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
    "+00:00", "Z"
  )
  symbols = load_symbols()
  quotes: dict[str, dict[str, Any]] = {}
  errors: list[str] = []
  trade_dates: list[str] = []

  for item in symbols:
    symbol = normalize_symbol(item.get("symbol"))
    name = str(item.get("name", "")).strip()
    stooq_symbol = str(item.get("stooqSymbol", "")).strip().lower()

    if not symbol or not name or not stooq_symbol:
      error = f"Invalid symbol config entry: {item!r}"
      errors.append(error)
      continue

    quote, error = fetch_quote(symbol, name, stooq_symbol, generated_at)
    quotes[symbol] = quote
    if quote.get("tradeDate"):
      trade_dates.append(str(quote["tradeDate"]))
    if error:
      errors.append(f"{symbol}: {error}")

  output = {
    "version": 1,
    "market": "US",
    "source": "stooq",
    "generatedAt": generated_at,
    "tradeDate": max(trade_dates) if trade_dates else None,
    "currency": "USD",
    "quotes": quotes,
    "errors": errors,
  }

  OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
  OUTPUT_PATH.write_text(
    json.dumps(output, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
  )

  found = sum(1 for quote in quotes.values() if quote["status"] == "ok")
  missing = len(quotes) - found
  print("US market price update report")
  print(f"symbols requested: {len(symbols)}")
  print(f"quotes found: {found}")
  print(f"quotes missing: {missing}")
  print(f"output path: {OUTPUT_PATH.relative_to(ROOT)}")
  print("source used: stooq")
  if errors:
    print("errors:")
    for error in errors:
      print(f"- {error}")
  if len(symbols) > 0 and found == 0:
    print("WARNING: no US quotes were fetched successfully.")
  elif len(symbols) > 0 and found < max(1, len(symbols) // 2):
    print("WARNING: most US quotes were unavailable; source/network may be degraded.")

  return 0


def load_symbols() -> list[dict[str, Any]]:
  data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
  symbols = data.get("symbols")
  if not isinstance(symbols, list):
    raise ValueError("market_symbols_us.json must contain a symbols array.")
  return symbols


def fetch_quote(
  symbol: str,
  name: str,
  stooq_symbol: str,
  generated_at: str,
) -> tuple[dict[str, Any], str | None]:
  try:
    params = urllib.parse.urlencode(
      {
        "s": stooq_symbol,
        "f": "sd2t2ohlcv",
        "h": "",
        "e": "csv",
      }
    )
    request = urllib.request.Request(
      f"{STOOQ_URL}?{params}",
      headers={"User-Agent": "investment-portfolio-static-updater/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
      text = response.read().decode("utf-8-sig")

    rows = list(csv.DictReader(text.splitlines()))
    if not rows:
      raise ValueError("Stooq returned no CSV rows.")

    row = rows[0]
    close = parse_positive_float(row.get("Close"))
    trade_date = parse_trade_date(row.get("Date"))
    if close is None:
      raise ValueError(f"Stooq close price unavailable: {row.get('Close')!r}")

    return (
      {
        "symbol": symbol,
        "name": name,
        "price": close,
        "currency": "USD",
        "source": "static-us-market-json",
        "tradeDate": trade_date,
        "lastUpdated": generated_at,
        "status": "ok",
        "stooqSymbol": stooq_symbol,
      },
      None,
    )
  except Exception as error:  # noqa: BLE001 - keep pipeline resilient per symbol.
    message = str(error)
    return unavailable_quote(symbol, name, stooq_symbol, generated_at, message), message


def unavailable_quote(
  symbol: str,
  name: str,
  stooq_symbol: str,
  generated_at: str,
  error: str,
) -> dict[str, Any]:
  return {
    "symbol": symbol,
    "name": name,
    "price": None,
    "currency": "USD",
    "source": "static-us-market-json",
    "tradeDate": None,
    "lastUpdated": generated_at,
    "status": "unavailable",
    "stooqSymbol": stooq_symbol,
    "error": error,
  }


def parse_positive_float(value: str | None) -> float | None:
  if value is None:
    return None
  try:
    parsed = float(value)
  except ValueError:
    return None
  return parsed if parsed > 0 else None


def parse_trade_date(value: str | None) -> str | None:
  if not value:
    return None
  try:
    return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
  except ValueError:
    return None


def normalize_symbol(value: Any) -> str:
  return str(value or "").strip().upper()


if __name__ == "__main__":
  try:
    raise SystemExit(main())
  except Exception as exc:  # noqa: BLE001 - fatal config/write failure.
    print(f"US market price update failed: {exc}", file=sys.stderr)
    raise SystemExit(1)
