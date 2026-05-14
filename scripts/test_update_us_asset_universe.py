from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from update_us_asset_universe import build_payload, parse_us_asset_universe


NASDAQ_LISTED_FIXTURE = """Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
AAPL|Apple Inc. - Common Stock|Q|N|N|100|N|N
AMD|Advanced Micro Devices, Inc. - Common Stock|Q|N|N|100|N|N
META|Meta Platforms, Inc. - Class A Common Stock|Q|N|N|100|N|N
PLTR|Palantir Technologies Inc. - Class A Common Stock|Q|N|N|100|N|N
QQQ|Invesco QQQ Trust, Series 1|Q|N|N|100|Y|N
TEST|Test Company - Common Stock|Q|Y|N|100|N|N
BAD.W|Bad Symbol Corp. - Common Stock|Q|N|N|100|N|N
WARR|Example Corp. - Warrants|Q|N|N|100|N|N
File Creation Time: 0514202621:34
"""


OTHER_LISTED_FIXTURE = """ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
AVGO|Broadcom Inc. - Common Stock|Q|AVGO|N|100|N|AVGO
SCHD|Schwab U.S. Dividend Equity ETF|P|SCHD|Y|100|N|SCHD
IWM|iShares Russell 2000 ETF|P|IWM|Y|100|N|IWM
TLT|iShares 20+ Year Treasury Bond ETF|Q|TLT|Y|100|N|TLT
DIA|SPDR Dow Jones Industrial Average ETF Trust|P|DIA|Y|100|N|DIA
XLE|Energy Select Sector SPDR Fund|P|XLE|Y|100|N|XLE
XLK|Technology Select Sector SPDR Fund|P|XLK|Y|100|N|XLK
PREF|Example Inc. Depositary Shares Preferred Stock|N|PREF|N|100|N|PREF
RIGHT|Example Inc. Rights|A|RIGHT|N|100|N|RIGHT
ETN1|Example Exchange Traded Notes|P|ETN1|Y|100|N|ETN1
FAKE|Fake Test ETF|P|FAKE|Y|100|Y|FAKE
BRK.B|Berkshire Hathaway Inc. Class B|N|BRK.B|N|100|N|BRK.B
File Creation Time: 0514202621:34
"""


class UsAssetUniverseTests(unittest.TestCase):
    def test_classifies_us_stocks_from_etf_flag_n(self) -> None:
        assets, _ = parse_us_asset_universe(NASDAQ_LISTED_FIXTURE, OTHER_LISTED_FIXTURE)
        by_symbol = {asset["symbol"]: asset for asset in assets}

        self.assertEqual(by_symbol["AMD"]["type"], "us_stock")
        self.assertFalse(by_symbol["AMD"]["isETF"])
        self.assertEqual(by_symbol["PLTR"]["type"], "us_stock")
        self.assertEqual(by_symbol["META"]["type"], "us_stock")

    def test_classifies_us_etfs_from_etf_flag_y(self) -> None:
        assets, _ = parse_us_asset_universe(NASDAQ_LISTED_FIXTURE, OTHER_LISTED_FIXTURE)
        by_symbol = {asset["symbol"]: asset for asset in assets}

        self.assertEqual(by_symbol["SCHD"]["type"], "us_etf")
        self.assertTrue(by_symbol["SCHD"]["isETF"])
        self.assertEqual(by_symbol["IWM"]["type"], "us_etf")
        self.assertEqual(by_symbol["TLT"]["type"], "us_etf")

    def test_skips_test_malformed_and_non_target_rows(self) -> None:
        assets, skipped_count = parse_us_asset_universe(
            NASDAQ_LISTED_FIXTURE,
            OTHER_LISTED_FIXTURE,
        )
        symbols = {asset["symbol"] for asset in assets}

        self.assertNotIn("TEST", symbols)
        self.assertNotIn("BAD.W", symbols)
        self.assertNotIn("WARR", symbols)
        self.assertNotIn("PREF", symbols)
        self.assertNotIn("RIGHT", symbols)
        self.assertNotIn("ETN1", symbols)
        self.assertNotIn("FAKE", symbols)
        self.assertNotIn("BRK.B", symbols)
        self.assertGreaterEqual(skipped_count, 8)

    def test_builds_schema_payload(self) -> None:
        assets, skipped_count = parse_us_asset_universe(
            NASDAQ_LISTED_FIXTURE,
            OTHER_LISTED_FIXTURE,
        )
        payload = build_payload(
            assets,
            "2026-05-14T00:00:00Z",
            skipped_count,
            [],
            existing_path=Path(tempfile.gettempdir()) / "missing-us-assets.json",
        )

        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["market"], "US")
        self.assertEqual(payload["source"], "nasdaqtrader-symbol-directory")
        self.assertEqual(payload["count"], len(assets))
        self.assertGreater(payload["stockCount"], 0)
        self.assertGreater(payload["etfCount"], 0)
        self.assertEqual(payload["errors"], [])


if __name__ == "__main__":
    unittest.main()
