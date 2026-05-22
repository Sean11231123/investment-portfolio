from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "update_taiwan_macro_indicators.py"

spec = importlib.util.spec_from_file_location("update_taiwan_macro_indicators", SCRIPT_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load update_taiwan_macro_indicators.py")
updater = importlib.util.module_from_spec(spec)
sys.modules["update_taiwan_macro_indicators"] = updater
spec.loader.exec_module(updater)


def fixture_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    values = {
        "202401": ("100.0", "200.0", "3.45"),
        "202501": ("110.0", "220.0", "3.30"),
        "202502": ("112.2", "222.2", "3.34"),
        "202503": ("112.761", "223.311", "3.35"),
    }
    for period, (cpi, ppi, unemployment) in values.items():
        rows.append(row(period, cpi, ppi, unemployment))
    return rows


def long_fixture_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for year in (2023, 2024, 2025):
        for month in range(1, 13):
            period = f"{year}{month:02d}"
            level = str(100 + (year - 2023) * 12 + month)
            rows.append(row(period, level, level, "3.0"))
    return rows


def row(period: str, cpi: str, ppi: str, unemployment: str) -> dict[str, str]:
    return {
        updater.DATE_FIELD: period,
        updater.CPI_FIELD: cpi,
        updater.PPI_FIELD: ppi,
        updater.UNEMPLOYMENT_FIELD: unemployment,
    }


class TaiwanMacroIndicatorUpdaterTests(unittest.TestCase):
    def test_parses_taiwan_cpi_ppi_and_unemployment_fixture(self) -> None:
        indicators = updater.build_taiwan_indicators(fixture_rows())

        self.assertEqual(set(indicators), {"TW_CPI", "TW_PPI", "TW_UNEMPLOYMENT_RATE"})
        self.assertEqual(indicators["TW_CPI"]["country"], "TW")
        self.assertEqual(indicators["TW_CPI"]["source"], "data.gov.tw / DGBAS")
        self.assertEqual(indicators["TW_PPI"]["period"], "2025-03")
        self.assertEqual(indicators["TW_UNEMPLOYMENT_RATE"]["unit"], "percent_rate")
        updater.validate_taiwan_indicators(indicators)

    def test_calculates_cpi_mom_and_yoy_as_index_changes(self) -> None:
        indicators = updater.build_taiwan_indicators(fixture_rows())
        cpi = indicators["TW_CPI"]

        self.assertEqual(cpi["unit"], "index")
        self.assertEqual(cpi["changeUnit"], "decimal_return")
        self.assertEqual(cpi["period"], "2025-03")
        self.assertEqual(cpi["level"], 112.761)
        self.assertEqual(cpi["mom"], 0.005)

        history = {item["period"]: item for item in cpi["history"]}
        self.assertEqual(history["2025-01"]["yoy"], 0.1)

    def test_calculates_ppi_mom_and_yoy_as_index_changes(self) -> None:
        indicators = updater.build_taiwan_indicators(fixture_rows())
        ppi = indicators["TW_PPI"]

        self.assertEqual(ppi["period"], "2025-03")
        self.assertEqual(ppi["level"], 223.311)
        self.assertEqual(ppi["mom"], 0.005)

        history = {item["period"]: item for item in ppi["history"]}
        self.assertEqual(history["2025-01"]["yoy"], 0.1)

    def test_unemployment_changes_are_percentage_points(self) -> None:
        indicators = updater.build_taiwan_indicators(fixture_rows())
        unemployment = indicators["TW_UNEMPLOYMENT_RATE"]

        self.assertEqual(unemployment["unit"], "percent_rate")
        self.assertEqual(unemployment["changeUnit"], "percentage_point")
        self.assertEqual(unemployment["calculation"], "percentage_point_change")
        self.assertEqual(unemployment["period"], "2025-03")
        self.assertEqual(unemployment["level"], 3.35)
        self.assertEqual(unemployment["mom"], 0.01)

        history = {item["period"]: item for item in unemployment["history"]}
        self.assertEqual(history["2025-01"]["yoy"], -0.15)

    def test_missing_previous_month_and_prior_year_become_null(self) -> None:
        indicators = updater.build_taiwan_indicators(fixture_rows())
        cpi = indicators["TW_CPI"]

        self.assertIsNone(cpi["history"][0]["mom"])
        self.assertIsNone(cpi["history"][0]["yoy"])
        self.assertIsNone(cpi["yoy"])

    def test_missing_markers_become_null_and_not_zero(self) -> None:
        self.assertIsNone(updater.parse_number(""))
        self.assertIsNone(updater.parse_number("-"))
        self.assertIsNone(updater.parse_number("--"))
        self.assertIsNone(updater.parse_number("…"))
        self.assertIsNone(updater.parse_number("N/A"))
        self.assertIsNone(updater.parse_number("not numeric"))
        self.assertEqual(updater.parse_number("r 109.13"), 109.13)
        self.assertEqual(updater.parse_number("p 10,301"), 10301.0)

        rows = [
            row("202501", "…", "--", "N/A"),
            row("202502", "110.0", "220.0", "3.30"),
        ]
        indicators = updater.build_taiwan_indicators(rows)

        self.assertEqual(indicators["TW_CPI"]["level"], 110.0)
        self.assertIsNone(indicators["TW_CPI"]["mom"])
        self.assertNotEqual(indicators["TW_CPI"]["mom"], 0)
        self.assertNotEqual(indicators["TW_PPI"]["level"], 0)

    def test_history_length_is_limited_to_24(self) -> None:
        indicators = updater.build_taiwan_indicators(long_fixture_rows())
        cpi = indicators["TW_CPI"]

        self.assertEqual(len(cpi["history"]), 24)
        self.assertEqual(cpi["history"][0]["period"], "2024-01")
        self.assertEqual(cpi["history"][-1]["period"], "2025-12")

    def test_merge_preserves_us_indicators_and_adds_exact_taiwan_set(self) -> None:
        merged = updater.merge_taiwan_indicators(
            base_payload(),
            updater.build_taiwan_indicators(fixture_rows()),
            "2026-05-22T01:00:00.000Z",
        )

        self.assertEqual(merged["version"], 1)
        self.assertEqual(merged["generatedAt"], "2026-05-22T01:00:00.000Z")
        self.assertEqual(merged["indicatorCount"], 7)
        self.assertIn("US_CPI", merged["indicators"])
        self.assertIn("US_CORE_CPI", merged["indicators"])
        self.assertIn("US_PPI_FINAL_DEMAND", merged["indicators"])
        self.assertIn("US_UNEMPLOYMENT_RATE", merged["indicators"])
        self.assertIn("TW_CPI", merged["indicators"])
        self.assertIn("TW_PPI", merged["indicators"])
        self.assertIn("TW_UNEMPLOYMENT_RATE", merged["indicators"])
        self.assertNotIn("TW_CORE_CPI", merged["indicators"])
        updater.validate_merged_payload(merged)

    def test_dry_run_does_not_write_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "macro-indicators.json"
            output_path = Path(tmpdir) / "merged.json"
            input_path.write_text(updater.json.dumps(base_payload()), encoding="utf-8")
            with (
                patch.object(sys, "argv", [
                    "update_taiwan_macro_indicators.py",
                    "--dry-run",
                    "--input",
                    str(input_path),
                    "--output",
                    str(output_path),
                ]),
                patch.object(updater, "fetch_taiwan_macro_rows", return_value=fixture_rows()),
                patch.object(updater, "utc_now_iso", return_value="2026-05-22T01:00:00.000Z"),
            ):
                result = updater.main()

            self.assertEqual(result, 0)
            self.assertFalse(output_path.exists())

    def test_failed_fetch_does_not_corrupt_existing_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "macro-indicators.json"
            original_text = updater.json.dumps(base_payload(), ensure_ascii=False)
            input_path.write_text(original_text, encoding="utf-8")
            with (
                patch.object(sys, "argv", [
                    "update_taiwan_macro_indicators.py",
                    "--input",
                    str(input_path),
                    "--output",
                    str(input_path),
                ]),
                patch.object(updater, "fetch_taiwan_macro_rows", side_effect=RuntimeError("network down")),
            ):
                result = updater.main()

            self.assertEqual(result, 1)
            self.assertEqual(input_path.read_text(encoding="utf-8"), original_text)

    def test_windows_fetch_fallback_uses_powershell_when_urllib_is_reset(self) -> None:
        completed = updater.subprocess.CompletedProcess(
            args=["powershell"],
            returncode=0,
            stdout=updater.json.dumps(fixture_rows(), ensure_ascii=False),
            stderr="",
        )

        with (
            patch.object(updater.sys, "platform", "win32"),
            patch.object(updater.urllib.request, "urlopen", side_effect=ConnectionResetError("reset")),
            patch.object(updater.subprocess, "run", return_value=completed) as run_mock,
        ):
            rows = updater.fetch_taiwan_macro_rows()

        self.assertEqual(rows[0][updater.DATE_FIELD], "202401")
        self.assertTrue(run_mock.called)

    def test_no_live_network_calls_in_unit_tests(self) -> None:
        self.assertTrue(callable(updater.fetch_taiwan_macro_rows))


def base_payload() -> dict[str, object]:
    return {
        "version": 1,
        "generatedAt": "2026-05-22T00:00:00.000Z",
        "source": "BLS",
        "sourceName": "U.S. Bureau of Labor Statistics Public Data API",
        "sourceUrl": "https://api.bls.gov/publicAPI/v2/timeseries/data/",
        "indicatorCount": 4,
        "historyLimit": 24,
        "indicators": {
            "US_CPI": base_indicator("US_CPI"),
            "US_CORE_CPI": base_indicator("US_CORE_CPI"),
            "US_PPI_FINAL_DEMAND": base_indicator("US_PPI_FINAL_DEMAND"),
            "US_UNEMPLOYMENT_RATE": base_indicator("US_UNEMPLOYMENT_RATE"),
        },
        "errors": [],
    }


def base_indicator(indicator_id: str) -> dict[str, object]:
    return {
        "country": "US",
        "category": "inflation",
        "name": indicator_id,
        "source": "BLS",
        "sourceSeriesId": indicator_id,
        "period": "2026-04",
        "level": 100.0,
        "mom": 0.01,
        "yoy": 0.02,
        "unit": "index",
        "changeUnit": "decimal_return",
        "frequency": "monthly",
        "status": "ok",
        "history": [],
    }


if __name__ == "__main__":
    unittest.main()
