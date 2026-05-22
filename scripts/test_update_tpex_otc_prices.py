from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from update_tpex_otc_prices import (
    build_quotes,
    load_otc_universe_symbols,
    parse_price,
    roc_date_to_iso,
)


UNIVERSE_FIXTURE = {
    "assets": [
        {
            "symbol": "8069",
            "name": "元太",
            "type": "taiwan_stock",
            "market": "TW",
            "exchange": "TPEX",
            "marketSegment": "otc",
            "priceSource": "tpex_otc",
        },
        {
            "symbol": "006201",
            "name": "元大富櫃50",
            "type": "taiwan_etf",
            "market": "TW",
            "exchange": "TPEX",
            "marketSegment": "otc",
            "priceSource": "tpex_otc",
        },
        {
            "symbol": "1785",
            "name": "光洋科",
            "type": "taiwan_stock",
            "market": "TW",
            "exchange": "TPEX",
            "marketSegment": "otc",
            "priceSource": "tpex_otc",
        },
        {
            "symbol": "6187",
            "name": "萬潤",
            "type": "taiwan_stock",
            "market": "TW",
            "exchange": "TPEX",
            "marketSegment": "otc",
            "priceSource": "tpex_otc",
        },
        {
            "symbol": "2603",
            "name": "長榮",
            "type": "taiwan_stock",
            "market": "TW",
            "exchange": "TWSE",
            "marketSegment": "listed",
            "priceSource": "twse",
        },
    ],
}

TARGET_SYMBOLS = [
    {"symbol": "006201", "name": "元大富櫃50", "type": "taiwan_etf"},
    {"symbol": "1785", "name": "光洋科", "type": "taiwan_stock"},
    {"symbol": "6187", "name": "萬潤", "type": "taiwan_stock"},
    {"symbol": "8069", "name": "元太", "type": "taiwan_stock"},
]

TPEX_RECORDS = [
    {
        "Date": "1150518",
        "SecuritiesCompanyCode": "8069",
        "CompanyName": "元太",
        "Close": "123.45",
    },
    {
        "Date": "1150518",
        "SecuritiesCompanyCode": "006201",
        "CompanyName": "元大富櫃50",
        "Close": "46.20",
    },
    {
        "Date": "1150518",
        "SecuritiesCompanyCode": "1785",
        "CompanyName": "光洋科",
        "Close": "--",
    },
    {
        "Date": "1150518",
        "SecuritiesCompanyCode": "9999",
        "CompanyName": "Source Only",
        "Close": "50.00",
    },
    {
        "Date": "1150518",
        "SecuritiesCompanyCode": "0000",
        "CompanyName": "Zero",
        "Close": "0",
    },
    {
        "Date": "1150518",
        "SecuritiesCompanyCode": "",
        "CompanyName": "Malformed",
        "Close": "1.23",
    },
]


class TpexOtcPriceTests(unittest.TestCase):
    def test_loads_only_tpex_otc_universe_symbols(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "tw-assets.json"
            path.write_text(json.dumps(UNIVERSE_FIXTURE), encoding="utf-8")
            with patch("update_tpex_otc_prices.UNIVERSE_PATH", path):
                symbols = load_otc_universe_symbols()

        self.assertEqual([item["symbol"] for item in symbols], ["006201", "1785", "6187", "8069"])
        self.assertNotIn("2603", [item["symbol"] for item in symbols])

    def test_builds_valid_stock_and_etf_quotes(self) -> None:
        quotes, trade_date, stats = build_quotes(
            TARGET_SYMBOLS,
            TPEX_RECORDS,
            "2026-05-19T00:00:00Z",
        )

        self.assertEqual(trade_date, "2026-05-18")
        self.assertEqual(quotes["8069"]["price"], 123.45)
        self.assertEqual(quotes["006201"]["price"], 46.20)
        self.assertEqual(quotes["8069"]["source"], "static-tpex-otc-json")
        self.assertEqual(quotes["006201"]["status"], "ok")
        self.assertEqual(stats["priced"], 2)

    def test_missing_and_malformed_prices_are_unavailable_not_zero(self) -> None:
        quotes, _, stats = build_quotes(
            TARGET_SYMBOLS,
            TPEX_RECORDS,
            "2026-05-19T00:00:00Z",
        )

        self.assertIsNone(quotes["1785"]["price"])
        self.assertEqual(quotes["1785"]["status"], "unavailable")
        self.assertIsNone(quotes["6187"]["price"])
        self.assertEqual(quotes["6187"]["status"], "unavailable")
        self.assertEqual(stats["unavailable"], 2)
        self.assertEqual(stats["malformed_source_rows"], 1)
        self.assertEqual(stats["skipped_source_rows"], 1)

    def test_parser_helpers_keep_frontend_compatible_values(self) -> None:
        self.assertEqual(parse_price("1,234.50"), 1234.50)
        self.assertIsNone(parse_price("--"))
        self.assertIsNone(parse_price(""))
        self.assertIsNone(parse_price("0"))
        self.assertEqual(roc_date_to_iso("1150518"), "2026-05-18")


if __name__ == "__main__":
    unittest.main()
