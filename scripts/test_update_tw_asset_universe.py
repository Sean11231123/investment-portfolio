from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from update_tw_asset_universe import build_payload, parse_twse_isin_assets


FIXTURE_HTML = """
<table>
  <tr><td>股票</td></tr>
  <tr><td>1101　台泥</td><td>TW0001101004</td><td>1962/02/09</td></tr>
  <tr><td>2603　長榮</td><td>TW0002603008</td><td>1987/09/21</td></tr>
  <tr><td>2881A　富邦特</td><td>TW0002881A92</td><td>2016/04/08</td></tr>
  <tr><td>ETF</td></tr>
  <tr><td>0052　富邦科技</td><td>TW0000052000</td><td>2006/08/28</td></tr>
  <tr><td>00981A　主動統一台股增長</td><td>TW00000981A4</td><td>2025/05/27</td></tr>
  <tr><td>00715L　期街口布蘭特正2</td><td>TW00000715L8</td><td>2017/08/01</td></tr>
  <tr><td>上市認購(售)權證</td></tr>
  <tr><td>030001　台泥元大61購01</td><td>TW0000300011</td><td>2026/01/01</td></tr>
  <tr><td>ETN</td></tr>
  <tr><td>020000　富邦特選蘋果N</td><td>TW0000200005</td><td>2019/04/30</td></tr>
</table>
"""


class TaiwanAssetUniverseTests(unittest.TestCase):
    def test_classifies_listed_common_stocks(self) -> None:
        assets = parse_twse_isin_assets(FIXTURE_HTML)
        stock = next(asset for asset in assets if asset["symbol"] == "2603")

        self.assertEqual(stock["name"], "長榮")
        self.assertEqual(stock["type"], "taiwan_stock")
        self.assertFalse(stock["isETF"])

    def test_classifies_regular_and_active_etfs(self) -> None:
        assets = parse_twse_isin_assets(FIXTURE_HTML)
        by_symbol = {asset["symbol"]: asset for asset in assets}

        self.assertEqual(by_symbol["0052"]["type"], "taiwan_etf")
        self.assertEqual(by_symbol["00981A"]["type"], "taiwan_etf")
        self.assertTrue(by_symbol["00981A"]["isETF"])

    def test_excludes_non_target_instruments(self) -> None:
        symbols = {asset["symbol"] for asset in parse_twse_isin_assets(FIXTURE_HTML)}

        self.assertNotIn("2881A", symbols)
        self.assertNotIn("00715L", symbols)
        self.assertNotIn("030001", symbols)
        self.assertNotIn("020000", symbols)

    def test_builds_schema_payload(self) -> None:
        assets = parse_twse_isin_assets(FIXTURE_HTML)
        payload = build_payload(
            assets,
            "2026-05-14T00:00:00Z",
            [],
            existing_path=Path(tempfile.gettempdir()) / "missing-tw-assets.json",
        )

        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["market"], "TW")
        self.assertEqual(payload["source"], "twse-isin-listed-securities")
        self.assertEqual(payload["count"], len(assets))
        self.assertEqual(payload["errors"], [])
        self.assertGreaterEqual(payload["count"], 4)


if __name__ == "__main__":
    unittest.main()
