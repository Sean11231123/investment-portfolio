from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from update_tw_emerging_universe import (
    audit_assets,
    build_payload,
    exclude_conflicting_assets,
    load_existing_symbols,
    parse_emerging_assets,
)


FIXTURE_ROWS = [
    {
        "Date": "1150522",
        "Time": "163004",
        "SecuritiesCompanyCode": "1260",
        "CompanyName": "富味鄉",
        "PreviousAveragePrice": "24.21",
        "BuyingPrice": "24",
        "SellingPrice": "25.05",
        "Average": "24.84",
        "LatestPrice": "24.8",
        "SuspendTime": "000000",
        "TransactionVolume": "94188",
        "ApplyingDate": "",
        "ApplyingStatus": "",
    },
    {
        "Date": "1150522",
        "Time": "163004",
        "SecuritiesCompanyCode": "1269",
        "CompanyName": "乾杯",
        "PreviousAveragePrice": "70.71",
        "BuyingPrice": "67.5",
        "SellingPrice": "70.8",
        "Average": "70.77",
        "LatestPrice": "70.8",
        "SuspendTime": "123000",
        "TransactionVolume": "120",
        "ApplyingDate": "",
        "ApplyingStatus": "申請上市",
    },
    {
        "Date": "1150522",
        "Time": "163004",
        "SecuritiesCompanyCode": "1269",
        "CompanyName": "乾杯 duplicate",
        "SuspendTime": "000000",
    },
    {
        "Date": "1150522",
        "Time": "163004",
        "SecuritiesCompanyCode": "",
        "CompanyName": "missing symbol",
    },
    {
        "Date": "1150522",
        "Time": "163004",
        "SecuritiesCompanyCode": "AB",
        "CompanyName": "bad symbol",
    },
]


class TaiwanEmergingUniverseTests(unittest.TestCase):
    def test_parses_valid_emerging_stock_fixture(self) -> None:
        assets, stats = parse_emerging_assets(FIXTURE_ROWS, "2026-05-22T00:00:00Z")
        by_symbol = {asset["symbol"]: asset for asset in assets}

        self.assertEqual(stats["malformed"], 2)
        self.assertEqual(stats["duplicateSymbols"], 1)
        self.assertEqual(set(by_symbol), {"1260", "1269"})

        asset = by_symbol["1260"]
        self.assertEqual(asset["name"], "富味鄉")
        self.assertEqual(asset["type"], "taiwan_stock")
        self.assertEqual(asset["market"], "TW")
        self.assertEqual(asset["currency"], "TWD")
        self.assertEqual(asset["exchange"], "TPEX")
        self.assertEqual(asset["marketSegment"], "emerging")
        self.assertEqual(asset["board"], "emerging")
        self.assertEqual(asset["securityType"], "stock")
        self.assertEqual(asset["classificationSource"], "tpex_openapi")
        self.assertEqual(asset["classificationConfidence"], "high")
        self.assertEqual(asset["classificationUpdatedAt"], "2026-05-22T00:00:00Z")
        self.assertEqual(asset["priceSource"], "manual")
        self.assertNotIn("price", asset)

    def test_preserves_non_price_classification_warnings(self) -> None:
        assets, _stats = parse_emerging_assets(FIXTURE_ROWS, "2026-05-22T00:00:00Z")
        by_symbol = {asset["symbol"]: asset for asset in assets}

        self.assertEqual(
            by_symbol["1269"]["classificationWarnings"],
            ["suspendTime=123000", "applyingStatus=申請上市"],
        )

    def test_audit_reports_duplicates_and_existing_conflicts(self) -> None:
        assets, _stats = parse_emerging_assets(FIXTURE_ROWS, "2026-05-22T00:00:00Z")
        production_assets, conflicts = exclude_conflicting_assets(assets, {"1260", "8069"})
        audit = audit_assets(FIXTURE_ROWS, assets, production_assets, {"1260", "8069"}, conflicts)

        self.assertEqual(audit["sourceRows"], 5)
        self.assertEqual(audit["rawAssets"], 2)
        self.assertEqual(audit["productionAssets"], 1)
        self.assertEqual(audit["rowsWithSymbol"], 3)
        self.assertEqual(audit["duplicateSymbolCount"], 1)
        self.assertEqual(audit["existingListedOtcConflictCount"], 1)
        self.assertEqual(audit["existingListedOtcConflicts"], ["1260"])

    def test_conflicting_symbols_are_excluded_from_production_output(self) -> None:
        assets, _stats = parse_emerging_assets(FIXTURE_ROWS, "2026-05-22T00:00:00Z")
        production_assets, conflicts = exclude_conflicting_assets(assets, {"1260"})

        self.assertEqual(conflicts, ["1260"])
        self.assertNotIn("1260", {asset["symbol"] for asset in production_assets})
        self.assertIn("1269", {asset["symbol"] for asset in production_assets})

    def test_builds_output_schema_without_price_values(self) -> None:
        assets, _stats = parse_emerging_assets(FIXTURE_ROWS, "2026-05-22T00:00:00Z")
        production_assets, conflicts = exclude_conflicting_assets(assets, {"1260"})
        payload = build_payload(assets, production_assets, conflicts, "2026-05-22T00:00:00Z", [])

        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["market"], "TW")
        self.assertEqual(payload["source"], "tpex-esb-latest-statistics")
        self.assertEqual(payload["segment"], "emerging")
        self.assertEqual(payload["rawCount"], 2)
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["excludedConflictCount"], 1)
        self.assertEqual(payload["excludedConflicts"], ["1260"])
        self.assertEqual(payload["errors"], [])
        self.assertTrue(all("price" not in asset for asset in payload["assets"]))
        self.assertTrue(all(asset["priceSource"] == "manual" for asset in payload["assets"]))

    def test_loads_existing_listed_otc_symbols_for_conflict_audit(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "tw-assets.json"
            path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "assets": [
                            {"symbol": "1260"},
                            {"symbol": "8069"},
                            {"symbol": 1234},
                        ],
                    }
                ),
                encoding="utf-8",
            )

            self.assertEqual(load_existing_symbols(path), {"1260", "8069"})


if __name__ == "__main__":
    unittest.main()
