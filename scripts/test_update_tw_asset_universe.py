from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from update_tw_asset_universe import (
    build_payload,
    merge_assets,
    parse_tpex_otc_assets,
    parse_twse_isin_assets,
)


TWSE_FIXTURE_HTML = """
<table>
  <tr><td>&#32929;&#31080;</td></tr>
  <tr><td>1101 &#21488;&#27877;</td><td>TW0001101004</td><td>1962/02/09</td></tr>
  <tr><td>2603 &#38263;&#27054;</td><td>TW0002603008</td><td>1987/09/21</td></tr>
  <tr><td>2881A &#23500;&#37030;&#37329;&#29305;</td><td>TW0002881A92</td><td>2016/04/08</td></tr>
  <tr><td>ETF</td></tr>
  <tr><td>0052 &#23500;&#37030;&#31185;&#25216;</td><td>TW0000052000</td><td>2006/08/28</td></tr>
  <tr><td>00981A &#20027;&#21205;&#32113;&#19968;&#21488;&#32929;&#22686;&#38263;</td><td>TW00000981A4</td><td>2025/05/27</td></tr>
  <tr><td>00715L &#26399;&#20803;&#22823;S&amp;P&#30707;&#27833;</td><td>TW00000715L8</td><td>2017/08/01</td></tr>
  <tr><td>&#35469;&#36092;&#27402;&#35657;</td></tr>
  <tr><td>030001 &#21488;&#2787761&#36092;01</td><td>TW0000300011</td><td>2026/01/01</td></tr>
  <tr><td>ETN</td></tr>
  <tr><td>020000 &#23500;&#37030;&#37329;&#24067;&#34349;N</td><td>TW0000200005</td><td>2019/04/30</td></tr>
</table>
"""


TPEX_FIXTURE_HTML = """
<table>
  <tr><td>TPEx Warrants</td></tr>
  <tr><td>700001 4749TEST56C01</td><td>TW25Z7000011</td><td>2026/01/01</td></tr>
  <tr><td>Stocks</td></tr>
  <tr><td>1785 &#20809;&#27915;&#31185;</td><td>TW0001785000</td><td>2000/01/01</td></tr>
  <tr><td>8069 &#20803;&#22826;</td><td>TW0008069006</td><td>2004/03/30</td></tr>
  <tr><td>2603 &#38263;&#27054;&#37325;&#35079;</td><td>TW0002603008</td><td>1987/09/21</td></tr>
  <tr><td>123ABC malformed</td><td>TW0000000000</td><td>2026/01/01</td></tr>
  <tr><td>ETF</td></tr>
  <tr><td>006201 &#20803;&#22823;&#23500;&#27331;50</td><td>TW0000062017</td><td>2011/01/27</td></tr>
  <tr><td>ETN</td></tr>
  <tr><td>020010 &#37325;&#35079;ETN</td><td>TW0000200104</td><td>2020/01/01</td></tr>
</table>
"""


class TaiwanAssetUniverseTests(unittest.TestCase):
    def test_classifies_listed_common_stocks(self) -> None:
        assets = parse_twse_isin_assets(TWSE_FIXTURE_HTML)
        stock = next(asset for asset in assets if asset["symbol"] == "2603")

        self.assertEqual(stock["name"], "\u9577\u69ae")
        self.assertEqual(stock["type"], "taiwan_stock")
        self.assertEqual(stock["exchange"], "TWSE")
        self.assertEqual(stock["marketSegment"], "listed")
        self.assertFalse(stock["isETF"])

    def test_classifies_regular_and_active_etfs(self) -> None:
        assets = parse_twse_isin_assets(TWSE_FIXTURE_HTML)
        by_symbol = {asset["symbol"]: asset for asset in assets}

        self.assertEqual(by_symbol["0052"]["type"], "taiwan_etf")
        self.assertEqual(by_symbol["00981A"]["type"], "taiwan_etf")
        self.assertTrue(by_symbol["00981A"]["isETF"])

    def test_excludes_non_target_instruments(self) -> None:
        symbols = {asset["symbol"] for asset in parse_twse_isin_assets(TWSE_FIXTURE_HTML)}

        self.assertNotIn("2881A", symbols)
        self.assertNotIn("00715L", symbols)
        self.assertNotIn("030001", symbols)
        self.assertNotIn("020000", symbols)

    def test_classifies_tpex_otc_stock_and_etf(self) -> None:
        assets = parse_tpex_otc_assets(TPEX_FIXTURE_HTML)
        by_symbol = {asset["symbol"]: asset for asset in assets}

        self.assertEqual(by_symbol["8069"]["type"], "taiwan_stock")
        self.assertEqual(by_symbol["8069"]["market"], "TW")
        self.assertEqual(by_symbol["8069"]["exchange"], "TPEX")
        self.assertEqual(by_symbol["8069"]["marketSegment"], "otc")
        self.assertEqual(by_symbol["8069"]["currency"], "TWD")
        self.assertEqual(by_symbol["8069"]["priceSource"], "tpex_otc")
        self.assertEqual(by_symbol["006201"]["type"], "taiwan_etf")
        self.assertTrue(by_symbol["006201"]["isETF"])

    def test_tpex_parser_skips_malformed_and_excluded_rows(self) -> None:
        symbols = {asset["symbol"] for asset in parse_tpex_otc_assets(TPEX_FIXTURE_HTML)}

        self.assertNotIn("700001", symbols)
        self.assertNotIn("123ABC", symbols)
        self.assertNotIn("020010", symbols)

    def test_merge_keeps_twse_duplicate_over_tpex(self) -> None:
        twse_assets = parse_twse_isin_assets(TWSE_FIXTURE_HTML)
        tpex_assets = parse_tpex_otc_assets(TPEX_FIXTURE_HTML)
        merged, stats = merge_assets(twse_assets, tpex_assets)
        by_symbol = {asset["symbol"]: asset for asset in merged}

        self.assertEqual(by_symbol["2603"]["exchange"], "TWSE")
        self.assertEqual(stats["duplicates"], 1)
        self.assertEqual(stats["tpex_added"], 3)

    def test_builds_schema_payload(self) -> None:
        twse_assets = parse_twse_isin_assets(TWSE_FIXTURE_HTML)
        tpex_assets = parse_tpex_otc_assets(TPEX_FIXTURE_HTML)
        assets, stats = merge_assets(twse_assets, tpex_assets)
        payload = build_payload(
            assets,
            "2026-05-14T00:00:00Z",
            [],
            stats,
            existing_path=Path(tempfile.gettempdir()) / "missing-tw-assets.json",
        )

        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["market"], "TW")
        self.assertEqual(payload["source"], "twse-isin-listed-and-tpex-otc-securities")
        self.assertEqual(payload["count"], len(assets))
        self.assertEqual(payload["twseCount"], len(twse_assets))
        self.assertEqual(payload["tpexOtcCount"], 3)
        self.assertEqual(payload["duplicateCount"], 1)
        self.assertEqual(payload["errors"], [])
        self.assertIn("0052", {asset["symbol"] for asset in payload["assets"]})
        self.assertIn("00981A", {asset["symbol"] for asset in payload["assets"]})
        self.assertIn("2603", {asset["symbol"] for asset in payload["assets"]})
        self.assertIn("8069", {asset["symbol"] for asset in payload["assets"]})


if __name__ == "__main__":
    unittest.main()
