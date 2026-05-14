from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "update_us_prices.py"
CONFIG_PATH = ROOT / "scripts" / "market_symbols_us.json"

spec = importlib.util.spec_from_file_location("update_us_prices", SCRIPT_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load update_us_prices.py")
updater = importlib.util.module_from_spec(spec)
sys.modules["update_us_prices"] = updater
spec.loader.exec_module(updater)


class FakeResponse:
    def __init__(self, text: str) -> None:
        self.text = text

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return self.text.encode("utf-8")


class USPriceUpdaterTests(unittest.TestCase):
    def test_config_contains_popular_expanded_subset(self) -> None:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        symbols = {item["symbol"]: item["stooqSymbol"] for item in data["symbols"]}

        for symbol in [
            "AAPL",
            "MSFT",
            "NVDA",
            "TSLA",
            "VOO",
            "SPY",
            "QQQ",
            "VT",
            "VTI",
            "AMD",
            "META",
            "SCHD",
            "XLK",
            "TLT",
        ]:
            self.assertIn(symbol, symbols)

        self.assertEqual(symbols["AMD"], "amd.us")
        self.assertEqual(symbols["SCHD"], "schd.us")
        self.assertNotIn("BRK.B", symbols)

    def test_fetch_quote_parses_expanded_stock_fixture(self) -> None:
        quote, error = fetch_with_fixture("AMD", "Advanced Micro Devices, Inc.", "amd.us", "123.45")

        self.assertIsNone(error)
        self.assertEqual(quote["symbol"], "AMD")
        self.assertEqual(quote["price"], 123.45)
        self.assertEqual(quote["status"], "ok")
        self.assertEqual(quote["stooqSymbol"], "amd.us")

    def test_fetch_quote_parses_expanded_etf_fixture(self) -> None:
        quote, error = fetch_with_fixture("XLK", "Technology Select Sector SPDR Fund", "xlk.us", "250.75")

        self.assertIsNone(error)
        self.assertEqual(quote["symbol"], "XLK")
        self.assertEqual(quote["price"], 250.75)
        self.assertEqual(quote["status"], "ok")

    def test_failed_symbol_is_unavailable_not_zero(self) -> None:
        quote, error = fetch_with_fixture("SCHD", "Schwab U.S. Dividend Equity ETF", "schd.us", "N/D")

        self.assertIsNotNone(error)
        self.assertIsNone(quote["price"])
        self.assertEqual(quote["status"], "unavailable")
        self.assertIn("unavailable", quote["error"])

    def test_output_schema_remains_frontend_compatible(self) -> None:
        quote, _ = fetch_with_fixture("META", "Meta Platforms, Inc.", "meta.us", "700.10")
        output = {
            "version": 1,
            "market": "US",
            "source": "stooq",
            "generatedAt": "2026-05-15T00:00:00.000Z",
            "tradeDate": quote["tradeDate"],
            "currency": "USD",
            "quotes": {"META": quote},
            "errors": [],
        }

        self.assertEqual(output["version"], 1)
        self.assertEqual(output["market"], "US")
        self.assertEqual(output["currency"], "USD")
        self.assertEqual(output["quotes"]["META"]["source"], "static-us-market-json")


def fetch_with_fixture(
    symbol: str,
    name: str,
    stooq_symbol: str,
    close: str,
) -> tuple[dict[str, object], str | None]:
    csv_text = (
        "Symbol,Date,Time,Open,High,Low,Close,Volume\n"
        f"{stooq_symbol},2026-05-14,22:00:00,1,2,1,{close},1000\n"
    )
    with patch.object(updater.urllib.request, "urlopen", return_value=FakeResponse(csv_text)):
        return updater.fetch_quote(symbol, name, stooq_symbol, "2026-05-15T00:00:00.000Z")


if __name__ == "__main__":
    unittest.main()
