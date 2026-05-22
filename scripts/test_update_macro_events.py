from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch


sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "update_macro_events.py"

spec = importlib.util.spec_from_file_location("update_macro_events", SCRIPT_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load update_macro_events.py")
updater = importlib.util.module_from_spec(spec)
sys.modules["update_macro_events"] = updater
spec.loader.exec_module(updater)


CALENDAR_FIXTURE = """
<html><body>
<h4>2025 FOMC Meetings</h4>
December
9-10*
Statement:
<a href="/newsevents/pressreleases/monetary20251210a.htm">HTML</a>
<a href="/newsevents/pressreleases/monetary20251210a1.htm">Implementation Note</a>
<a href="/monetarypolicy/fomcpresconf20251210.htm">Press Conference</a>
Projection Materials
<a href="/monetarypolicy/fomcprojtabl20251210.htm">HTML</a>
Minutes:
<a href="/monetarypolicy/fomcminutes20251210.htm">HTML</a>
(Released December 30, 2025)
<h4>2026 FOMC Meetings</h4>
January
27-28
Statement:
<a href="/newsevents/pressreleases/monetary20260128a.htm">HTML</a>
<a href="/newsevents/pressreleases/monetary20260128a1.htm">Implementation Note</a>
<a href="/monetarypolicy/fomcpresconf20260128.htm">Press Conference</a>
Minutes:
<a href="/monetarypolicy/fomcminutes20260128.htm">HTML</a>
(Released February 18, 2026)
March
17-18*
Statement:
<a href="/newsevents/pressreleases/monetary20260318a.htm">HTML</a>
<a href="/newsevents/pressreleases/monetary20260318a1.htm">Implementation Note</a>
<a href="/monetarypolicy/fomcpresconf20260318.htm">Press Conference</a>
Projection Materials
<a href="/monetarypolicy/fomcprojtabl20260318.htm">HTML</a>
Minutes:
<a href="/monetarypolicy/fomcminutes20260318.htm">HTML</a>
(Released April 08, 2026)
June
16-17*
<h4>2027 FOMC Meetings</h4>
January
26-27
</body></html>
"""


STATEMENT_WITH_RANGE = """
<html><body>
The Federal Open Market Committee directs the Desk to undertake open market
operations as necessary to maintain the federal funds rate in a target range
of 4-1/4 to 4‑1/2 percent.
</body></html>
"""

STATEMENT_WITH_LOWER_RANGE = """
<html><body>
The Committee directs the Desk to maintain the federal funds rate in a target
range of 4 to 4-1/4 percent.
</body></html>
"""

STATEMENT_WITHOUT_RANGE = "<html><body>No target range appears here.</body></html>"


class MacroEventUpdaterTests(unittest.TestCase):
    def test_parse_fomc_calendar_fixture_and_schema(self) -> None:
        events, errors = updater.parse_calendar_html(
            CALENDAR_FIXTURE,
            "2026-05-22T00:00:00.000Z",
            today=date(2026, 5, 22),
        )
        payload = updater.build_payload(events, "2026-05-22T00:00:00.000Z", errors)

        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["source"], "Federal Reserve")
        self.assertEqual(payload["eventCount"], 5)
        self.assertIn("events", payload)
        self.assertIn("errors", payload)
        updater.validate_payload_for_write(payload)

    def test_links_status_and_stable_event_ids(self) -> None:
        events, _ = updater.parse_calendar_html(
            CALENDAR_FIXTURE,
            "2026-05-22T00:00:00.000Z",
            today=date(2026, 5, 22),
        )
        by_id = {event["id"]: event for event in events}

        self.assertIn("FOMC_2026_03_18", by_id)
        march = by_id["FOMC_2026_03_18"]
        self.assertEqual(march["status"], "complete")
        self.assertTrue(march["links"]["statement"].endswith("monetary20260318a.htm"))
        self.assertTrue(march["links"]["minutes"].endswith("fomcminutes20260318.htm"))
        self.assertTrue(march["links"]["pressConference"].endswith("fomcpresconf20260318.htm"))
        self.assertTrue(march["links"]["sep"].endswith("fomcprojtabl20260318.htm"))
        self.assertEqual(march["minutesReleaseDate"], "2026-04-08")

    def test_missing_links_become_null_for_upcoming_event(self) -> None:
        events, _ = updater.parse_calendar_html(
            CALENDAR_FIXTURE,
            "2026-05-22T00:00:00.000Z",
            today=date(2026, 5, 22),
        )
        june = next(event for event in events if event["id"] == "FOMC_2026_06_17")

        self.assertEqual(june["status"], "upcoming")
        self.assertIsNone(june["links"]["statement"])
        self.assertIsNone(june["links"]["implementationNote"])
        self.assertIsNone(june["links"]["minutes"])
        self.assertIsNone(june["links"]["pressConference"])
        self.assertIsNone(june["links"]["sep"])
        self.assertTrue(june["hasSep"])

    def test_target_range_parse_and_change_bps(self) -> None:
        events, errors = updater.parse_calendar_html(
            CALENDAR_FIXTURE,
            "2026-05-22T00:00:00.000Z",
            today=date(2026, 5, 22),
        )
        page_by_url = {
            "monetary20251210a1.htm": STATEMENT_WITH_LOWER_RANGE,
            "monetary20260128a1.htm": STATEMENT_WITH_RANGE,
            "monetary20260318a1.htm": STATEMENT_WITH_RANGE,
        }

        def fake_fetch(url: str) -> str:
            for key, value in page_by_url.items():
                if url.endswith(key):
                    return value
            return STATEMENT_WITHOUT_RANGE

        with patch.object(updater, "fetch_text", side_effect=fake_fetch):
            rate_errors = updater.attach_rate_decisions(events)

        self.assertEqual(errors, [])
        self.assertEqual(rate_errors, [])
        by_id = {event["id"]: event for event in events}
        december = by_id["FOMC_2025_12_10"]["rateDecision"]
        january = by_id["FOMC_2026_01_28"]["rateDecision"]
        march = by_id["FOMC_2026_03_18"]["rateDecision"]

        self.assertTrue(december["available"])
        self.assertEqual(december["targetRangeLower"], 4.0)
        self.assertEqual(december["targetRangeUpper"], 4.25)
        self.assertIsNone(december["changeBps"])
        self.assertEqual(january["changeBps"], 25)
        self.assertEqual(march["changeBps"], 0)

    def test_target_range_parse_failure_does_not_fail_event(self) -> None:
        events, _ = updater.parse_calendar_html(
            CALENDAR_FIXTURE,
            "2026-05-22T00:00:00.000Z",
            today=date(2026, 5, 22),
        )
        with patch.object(updater, "fetch_text", return_value=STATEMENT_WITHOUT_RANGE):
            rate_errors = updater.attach_rate_decisions(events)

        january = next(event for event in events if event["id"] == "FOMC_2026_01_28")
        self.assertFalse(january["rateDecision"]["available"])
        self.assertIsNone(january["rateDecision"]["targetRangeLower"])
        self.assertIsNone(january["rateDecision"]["targetRangeUpper"])
        self.assertTrue(rate_errors)

    def test_no_unofficial_summary_fields_and_no_missing_zeroes(self) -> None:
        events, _ = updater.parse_calendar_html(
            CALENDAR_FIXTURE,
            "2026-05-22T00:00:00.000Z",
            today=date(2026, 5, 22),
        )

        for event in events:
            self.assertNotIn("summary", event)
            self.assertNotIn("sentiment", event)
            self.assertNotIn("marketPrediction", event)
            self.assertNotIn("recommendation", event)
            decision = event["rateDecision"]
            self.assertNotEqual(decision["targetRangeLower"], 0)
            self.assertNotEqual(decision["targetRangeUpper"], 0)

    def test_parse_rate_values_supports_fractions_and_decimals(self) -> None:
        self.assertEqual(updater.parse_rate_value("4-1/4"), 4.25)
        self.assertEqual(updater.parse_rate_value("1/4"), 0.25)
        self.assertEqual(updater.parse_rate_value("4.50"), 4.5)
        self.assertEqual(updater.parse_target_range(STATEMENT_WITH_RANGE), (4.25, 4.5))

    def test_dry_run_does_not_write_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "macro-events.json"
            with (
                patch.object(
                    sys,
                    "argv",
                    ["update_macro_events.py", "--dry-run", "--skip-rate-fetch", "--output", str(output_path)],
                ),
                patch.object(updater, "fetch_text", return_value=CALENDAR_FIXTURE),
                patch.object(updater, "utc_now_iso", return_value="2026-05-22T00:00:00.000Z"),
            ):
                result = updater.main()

            self.assertEqual(result, 0)
            self.assertFalse(output_path.exists())


if __name__ == "__main__":
    unittest.main()
