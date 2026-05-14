from __future__ import annotations

import unittest

from update_tw_prices import build_quotes, parse_price, roc_date_to_iso


TARGET_SYMBOLS = [
    {"symbol": "0052", "name": "富邦科技", "type": "taiwan_etf"},
    {"symbol": "00981A", "name": "主動統一台股增長", "type": "taiwan_etf"},
    {"symbol": "2603", "name": "長榮", "type": "taiwan_stock"},
    {"symbol": "2881", "name": "富邦金", "type": "taiwan_stock"},
    {"symbol": "9999", "name": "Missing Co", "type": "taiwan_stock"},
]

TWSE_RECORDS = [
    {
        "Code": "0052",
        "Name": "富邦科技",
        "ClosingPrice": "178.30",
        "Date": "1150513",
    },
    {
        "Code": "00981A",
        "Name": "主動統一台股增長",
        "ClosingPrice": "12.34",
        "Date": "1150513",
    },
    {
        "Code": "2603",
        "Name": "長榮",
        "ClosingPrice": "210.50",
        "Date": "1150513",
    },
    {
        "Code": "2881",
        "Name": "富邦金",
        "ClosingPrice": "--",
        "Date": "1150513",
    },
    {
        "Code": "7777",
        "Name": "Source Only",
        "ClosingPrice": "50.00",
        "Date": "1150513",
    },
]


class TaiwanBroadPriceTests(unittest.TestCase):
    def test_builds_broad_quotes_for_universe_targets(self) -> None:
        quotes, trade_date, stats = build_quotes(
            TARGET_SYMBOLS,
            TWSE_RECORDS,
            "2026-05-14T00:00:00Z",
        )

        self.assertEqual(trade_date, "2026-05-13")
        self.assertEqual(set(quotes), {"0052", "00981A", "2603", "2881", "9999"})
        self.assertEqual(quotes["0052"]["price"], 178.30)
        self.assertEqual(quotes["00981A"]["price"], 12.34)
        self.assertEqual(quotes["2603"]["price"], 210.50)
        self.assertEqual(quotes["0052"]["status"], "ok")
        self.assertEqual(stats["priced"], 3)

    def test_malformed_and_absent_prices_are_unavailable_not_zero(self) -> None:
        quotes, _, stats = build_quotes(
            TARGET_SYMBOLS,
            TWSE_RECORDS,
            "2026-05-14T00:00:00Z",
        )

        self.assertIsNone(quotes["2881"]["price"])
        self.assertEqual(quotes["2881"]["status"], "unavailable")
        self.assertIn("尚未取得", quotes["2881"]["error"])
        self.assertIsNone(quotes["9999"]["price"])
        self.assertEqual(quotes["9999"]["status"], "unavailable")
        self.assertEqual(stats["unavailable"], 2)

    def test_skips_source_rows_outside_universe_without_crashing(self) -> None:
        _, _, stats = build_quotes(
            TARGET_SYMBOLS,
            TWSE_RECORDS,
            "2026-05-14T00:00:00Z",
        )

        self.assertEqual(stats["skipped_source_rows"], 1)

    def test_parser_helpers_keep_frontend_compatible_values(self) -> None:
        self.assertEqual(parse_price("1,234.50"), 1234.50)
        self.assertIsNone(parse_price("0"))
        self.assertIsNone(parse_price("--"))
        self.assertEqual(roc_date_to_iso("1150513"), "2026-05-13")


if __name__ == "__main__":
    unittest.main()
