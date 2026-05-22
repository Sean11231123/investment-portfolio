from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "update_macro_indicators.py"

spec = importlib.util.spec_from_file_location("update_macro_indicators", SCRIPT_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load update_macro_indicators.py")
updater = importlib.util.module_from_spec(spec)
sys.modules["update_macro_indicators"] = updater
spec.loader.exec_module(updater)


def fixture_response() -> dict[str, object]:
    return {
        "status": "REQUEST_SUCCEEDED",
        "Results": {
            "series": [
                {
                    "seriesID": "CUSR0000SA0",
                    "data": build_monthly_rows(
                        "CUSR0000SA0",
                        {
                            "2024-01": "100.0",
                            "2025-01": "110.0",
                            "2025-02": "112.2",
                        },
                    ),
                },
                {
                    "seriesID": "CUSR0000SA0L1E",
                    "data": build_monthly_rows(
                        "CUSR0000SA0L1E",
                        {
                            "2025-02": "200.0",
                            "2025-03": "201.0",
                            "2026-03": "207.03",
                        },
                    ),
                },
                {
                    "seriesID": "WPSFD4",
                    "data": build_monthly_rows(
                        "WPSFD4",
                        {
                            "2025-04": ".",
                            "2026-04": "130.0",
                        },
                    ),
                },
                {
                    "seriesID": "LNS14000000",
                    "data": build_monthly_rows(
                        "LNS14000000",
                        {
                            "2024-01": "4.2",
                            "2025-01": "4.0",
                            "2025-02": "3.9",
                        },
                    ),
                },
            ],
        },
    }


def build_monthly_rows(series_id: str, values: dict[str, str]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for period, value in values.items():
        year, month = period.split("-")
        rows.append(
            {
                "seriesID": series_id,
                "year": year,
                "period": f"M{int(month):02d}",
                "periodName": period,
                "value": value,
            },
        )
    return list(reversed(rows))


class MacroIndicatorUpdaterTests(unittest.TestCase):
    def test_parse_valid_bls_fixture_and_schema(self) -> None:
        payload = updater.build_macro_payload(fixture_response(), "2026-05-22T00:00:00.000Z")

        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["source"], "BLS")
        self.assertEqual(payload["generatedAt"], "2026-05-22T00:00:00.000Z")
        self.assertIn("US_CPI", payload["indicators"])
        self.assertIn("errors", payload)

    def test_calculates_cpi_mom_and_yoy_as_index_changes(self) -> None:
        payload = updater.build_macro_payload(fixture_response(), "2026-05-22T00:00:00.000Z")
        cpi = payload["indicators"]["US_CPI"]

        self.assertEqual(cpi["period"], "2025-02")
        self.assertEqual(cpi["level"], 112.2)
        self.assertEqual(cpi["mom"], 0.02)
        self.assertEqual(cpi["yoy"], None)

        history = {item["period"]: item for item in cpi["history"]}
        self.assertEqual(history["2025-01"]["yoy"], 0.1)

    def test_missing_previous_month_and_prior_year_become_null(self) -> None:
        payload = updater.build_macro_payload(fixture_response(), "2026-05-22T00:00:00.000Z")
        core = payload["indicators"]["US_CORE_CPI"]

        self.assertEqual(core["period"], "2026-03")
        self.assertIsNone(core["mom"])
        self.assertEqual(core["yoy"], 0.030)

    def test_non_numeric_values_are_unavailable_not_zero(self) -> None:
        payload = updater.build_macro_payload(fixture_response(), "2026-05-22T00:00:00.000Z")
        ppi = payload["indicators"]["US_PPI_FINAL_DEMAND"]

        self.assertEqual(ppi["period"], "2026-04")
        self.assertEqual(ppi["level"], 130.0)
        self.assertIsNone(ppi["mom"])
        self.assertIsNone(ppi["yoy"])
        self.assertNotEqual(ppi["level"], 0)

    def test_unemployment_changes_are_percentage_points(self) -> None:
        payload = updater.build_macro_payload(fixture_response(), "2026-05-22T00:00:00.000Z")
        unemployment = payload["indicators"]["US_UNEMPLOYMENT_RATE"]

        self.assertEqual(unemployment["unit"], "percent")
        self.assertEqual(unemployment["calculation"], "percentage_point_change")
        self.assertEqual(unemployment["period"], "2025-02")
        self.assertEqual(unemployment["level"], 3.9)
        self.assertEqual(unemployment["mom"], -0.1)
        self.assertIsNone(unemployment["yoy"])

        history = {item["period"]: item for item in unemployment["history"]}
        self.assertEqual(history["2025-01"]["yoy"], -0.2)

    def test_missing_series_has_null_values_and_error(self) -> None:
        response = fixture_response()
        response["Results"]["series"] = [
            item for item in response["Results"]["series"] if item["seriesID"] != "WPSFD4"
        ]

        payload = updater.build_macro_payload(response, "2026-05-22T00:00:00.000Z")
        ppi = payload["indicators"]["US_PPI_FINAL_DEMAND"]

        self.assertEqual(ppi["status"], "unavailable")
        self.assertIsNone(ppi["level"])
        self.assertIsNone(ppi["mom"])
        self.assertIsNone(ppi["yoy"])
        self.assertTrue(any("US_PPI_FINAL_DEMAND" in error for error in payload["errors"]))


if __name__ == "__main__":
    unittest.main()
