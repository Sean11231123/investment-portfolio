from __future__ import annotations

import importlib.util
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "update_us_etf_components.py"

spec = importlib.util.spec_from_file_location("update_us_etf_components", SCRIPT_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load update_us_etf_components.py")
updater = importlib.util.module_from_spec(spec)
sys.modules["update_us_etf_components"] = updater
spec.loader.exec_module(updater)


class USETFComponentUpdaterTests(unittest.TestCase):
    def test_parse_weight_accepts_decimal_and_percent_values(self) -> None:
        self.assertAlmostEqual(updater.parse_weight("0.066"), 0.066)
        self.assertAlmostEqual(updater.parse_weight("6.6%"), 0.066)
        self.assertAlmostEqual(updater.parse_weight("6.6"), 0.066)
        self.assertAlmostEqual(
            updater.parse_weight("0.991469", numeric_weight_is_percent=True),
            0.00991469,
        )

    def test_write_dataset_preserves_partial_total_weight(self) -> None:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        data_dir = Path(temp_dir.name)

        result = updater.FetchResult(
            symbol="TEST",
            name="Test ETF",
            source_url="https://example.com/test.xlsx",
            source_type="fixture",
            data_quality="partial",
            as_of_date="2026-05-14",
            components=[
                updater.Component("AAA", "AAA Corp", 0.1),
                updater.Component("BBB", "BBB Corp", 0.2),
            ],
        )

        with patch.object(updater, "DATA_DIR", data_dir):
            updater.write_dataset(result)

        data = json.loads((data_dir / "TEST.json").read_text(encoding="utf-8"))
        self.assertEqual(data["totalWeight"], 0.3)
        self.assertEqual(data["dataQuality"], "partial")
        self.assertEqual(data["componentCount"], 2)

    def test_parses_invesco_json_holdings(self) -> None:
        components = updater.parse_invesco_holdings(
            {
                "holdings": [
                    {
                        "ticker": "QQQ",
                        "issuerName": "Example Inc",
                        "percentageOfTotalNetAssets": 6.5,
                    },
                    {
                        "ticker": "CASH",
                        "issuerName": "Cash",
                        "percentageOfTotalNetAssets": 0,
                    },
                ],
            },
        )

        self.assertEqual(len(components), 1)
        self.assertEqual(components[0].symbol, "QQQ")
        self.assertAlmostEqual(components[0].weight, 0.065)

    def test_parses_vanguard_json_holdings(self) -> None:
        components = updater.parse_vanguard_holdings(
            {
                "fund": {
                    "entity": [
                        {
                            "ticker": "VOO",
                            "longName": "Example Corp.",
                            "percentWeight": "7.58",
                        },
                        {
                            "ticker": "ZERO",
                            "longName": "Zero Weight Corp.",
                            "percentWeight": "0.00",
                        },
                    ],
                },
            },
        )

        self.assertEqual(len(components), 1)
        self.assertEqual(components[0].symbol, "VOO")
        self.assertAlmostEqual(components[0].weight, 0.0758)

    def test_fetch_failure_does_not_overwrite_existing_json(self) -> None:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        root = Path(temp_dir.name)
        data_dir = root / "public" / "data" / "etf-components"
        data_dir.mkdir(parents=True)
        config_path = root / "scripts" / "market_etfs_us.json"
        config_path.parent.mkdir()
        index_path = data_dir / "index.json"
        qqq_path = data_dir / "QQQ.json"

        existing = {"version": 1, "symbol": "QQQ", "name": "Existing QQQ"}
        qqq_path.write_text(json.dumps(existing), encoding="utf-8")
        index_path.write_text(
            json.dumps({"version": 1, "datasets": ["QQQ.json"]}),
            encoding="utf-8",
        )
        config_path.write_text(
            json.dumps(
                {
                    "version": 1,
                    "etfs": [
                        {
                            "symbol": "QQQ",
                            "name": "Invesco QQQ Trust",
                            "sourceType": "invesco_json",
                            "sourceUrl": "https://example.com/qqq.json",
                            "dataQualityOnSuccess": "official",
                        },
                    ],
                },
            ),
            encoding="utf-8",
        )

        with (
            patch.object(updater, "CONFIG_PATH", config_path),
            patch.object(updater, "DATA_DIR", data_dir),
            patch.object(updater, "INDEX_PATH", index_path),
            patch.object(updater, "fetch_bytes", side_effect=RuntimeError("network down")),
        ):
            with redirect_stdout(io.StringIO()):
                exit_code = updater.main()

        self.assertEqual(exit_code, 1)
        self.assertEqual(json.loads(qqq_path.read_text(encoding="utf-8")), existing)


if __name__ == "__main__":
    unittest.main()
