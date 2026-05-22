import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import update_tw_fund_nav as fund_nav


def csv_text(rows: list[list[str]]) -> str:
    header = [
        fund_nav.DATE_FIELD,
        fund_nav.MEMBER_CODE_FIELD,
        fund_nav.COMPANY_NAME_FIELD,
        fund_nav.FUND_TAX_ID_FIELD,
        fund_nav.FUND_CODE_FIELD,
        fund_nav.FUND_NAME_FIELD,
        fund_nav.NAV_FIELD,
        fund_nav.CHANGE_FIELD,
        fund_nav.CHANGE_PERCENT_FIELD,
        fund_nav.TYPE_CODE_FIELD,
        fund_nav.CURRENCY_FIELD,
        fund_nav.BENEFICIARY_CERTIFICATE_CODE_FIELD,
    ]
    return "\ufeff" + "\n".join([",".join(header), *[",".join(row) for row in rows]])


def csv_text_without_bom(rows: list[list[str]]) -> str:
    return csv_text(rows).lstrip("\ufeff")


VALID_CSV = csv_text(
    [
        [
            "20260520",
            "001",
            "Yuanta",
            "12345678",
            "1001",
            "Yuanta Taiwan Fund",
            "12.3456",
            "0.01",
            "0.08",
            "A",
            "TWD",
            "BEN001",
        ],
        [
            "20260520",
            "002",
            "Capital",
            "23456789",
            "1002",
            "Capital Taiwan Fund",
            "23.5",
            "-0.02",
            "-0.09",
            "B",
            "\u65b0\u53f0\u5e63",
            "BEN002",
        ],
        [
            "20260520",
            "003",
            "Cathay",
            "34567890",
            "1003",
            "Cathay USD Fund",
            "10.25",
            "0.00",
            "0.00",
            "C",
            "USD",
            "BEN003",
        ],
    ],
)


def build_payloads(rows: list[fund_nav.FundNavRow]):
    audit = fund_nav.audit_identity(rows)
    universe_payload, nav_payload, excluded = fund_nav.build_output_payloads(
        rows, audit, "2026-05-22T00:00:00Z"
    )
    return universe_payload, nav_payload, excluded


class TaiwanFundNavTests(unittest.TestCase):
    def test_parse_valid_sitca_csv_fixture(self):
        rows = fund_nav.parse_nav_csv(VALID_CSV.encode("utf-8"))

        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0].nav_date, "2026-05-20")
        self.assertEqual(rows[0].fund_code, "1001")
        self.assertEqual(rows[0].fund_name, "Yuanta Taiwan Fund")
        self.assertEqual(rows[0].nav, 12.3456)
        self.assertEqual(rows[1].currency, "TWD")
        self.assertEqual(rows[2].currency, "USD")

    def test_parse_cp950_encoded_csv(self):
        fixture = csv_text_without_bom(
            [
                [
                    "1150520",
                    "001",
                    "Yuanta",
                    "12345678",
                    "1001",
                    "Yuanta Taiwan Fund",
                    "12.3456",
                    "",
                    "",
                    "A",
                    "TWD",
                    "BEN001",
                ],
            ],
        )

        rows = fund_nav.parse_nav_csv(fixture.encode("cp950"))

        self.assertEqual(rows[0].nav_date, "2026-05-20")
        self.assertEqual(rows[0].nav, 12.3456)

    def test_missing_nav_is_null_and_never_zero(self):
        fixture = csv_text(
            [
                ["20260520", "001", "Yuanta", "12345678", "1001", "Yuanta Fund", "--", "", "", "A", "TWD", "BEN001"],
                ["20260520", "002", "Capital", "23456789", "1002", "Capital Fund", "", "", "", "B", "TWD", "BEN002"],
            ],
        )

        rows = fund_nav.parse_nav_csv(fixture.encode("utf-8"))
        universe_payload, nav_payload, _ = build_payloads(rows)

        self.assertIsNone(rows[0].nav)
        self.assertIsNone(nav_payload["quotes"]["TW_FUND_1001"]["price"])
        self.assertEqual(nav_payload["quotes"]["TW_FUND_1001"]["status"], "unavailable")
        self.assertNotEqual(nav_payload["quotes"]["TW_FUND_1001"]["price"], 0)
        self.assertEqual(len(universe_payload["assets"]), 2)

    def test_duplicate_fund_names_are_allowed(self):
        fixture = csv_text(
            [
                ["20260520", "001", "Yuanta", "12345678", "1001", "Same Fund", "12.3", "", "", "A", "TWD", "BEN001"],
                ["20260520", "002", "Capital", "23456789", "1002", "Same Fund", "22.3", "", "", "B", "TWD", "BEN002"],
            ],
        )
        rows = fund_nav.parse_nav_csv(fixture.encode("utf-8"))
        audit = fund_nav.audit_identity(rows)

        self.assertEqual(audit.duplicate_fund_name_count, 1)
        self.assertTrue(audit.stable)
        self.assertEqual(audit.chosen_strategy, "fundCode")

    def test_fund_code_uniqueness_audit(self):
        rows = fund_nav.parse_nav_csv(VALID_CSV.encode("utf-8"))

        audit = fund_nav.audit_identity(rows)

        self.assertEqual(audit.total_rows, 3)
        self.assertEqual(audit.rows_with_fund_code, 3)
        self.assertEqual(audit.duplicate_fund_code_count, 0)
        self.assertEqual(audit.chosen_strategy, "fundCode")
        self.assertTrue(audit.stable)

    def test_fallback_symbol_strategy_when_fund_code_duplicates(self):
        fixture = csv_text(
            [
                ["20260520", "001", "Yuanta", "12345678", "1001", "Yuanta A Fund", "12.3", "", "", "A", "TWD", "BEN001"],
                ["20260520", "002", "Yuanta", "12345678", "1001", "Yuanta B Fund", "13.3", "", "", "B", "TWD", "BEN002"],
            ],
        )
        rows = fund_nav.parse_nav_csv(fixture.encode("utf-8"))

        audit = fund_nav.audit_identity(rows)
        universe_payload, nav_payload, _ = build_payloads(rows)

        self.assertEqual(audit.duplicate_fund_code_count, 1)
        self.assertEqual(audit.chosen_strategy, "fallback")
        self.assertTrue(audit.stable)
        self.assertIn("TW_FUND_12345678_TWD_A_BEN001", nav_payload["quotes"])
        self.assertEqual(len(universe_payload["assets"]), 2)

    def test_currency_distribution_and_twd_only_output(self):
        rows = fund_nav.parse_nav_csv(VALID_CSV.encode("utf-8"))

        distribution = fund_nav.count_currencies(rows)
        universe_payload, nav_payload, excluded = build_payloads(rows)

        self.assertEqual(distribution["TWD"], 2)
        self.assertEqual(distribution["USD"], 1)
        self.assertEqual(len(universe_payload["assets"]), 2)
        self.assertEqual(len(nav_payload["quotes"]), 2)
        self.assertNotIn("TW_FUND_1003", nav_payload["quotes"])
        self.assertEqual(nav_payload["currencyPolicy"], "TWD_ONLY")
        self.assertEqual(excluded, 1)

    def test_universe_output_schema_valid(self):
        rows = fund_nav.parse_nav_csv(VALID_CSV.encode("utf-8"))
        universe_payload, nav_payload, _ = build_payloads(rows)

        fund_nav.validate_output_payloads(universe_payload, nav_payload)
        asset = universe_payload["assets"][0]

        self.assertEqual(universe_payload["version"], 1)
        self.assertEqual(universe_payload["segment"], "domestic_fund")
        self.assertEqual(asset["type"], "taiwan_fund")
        self.assertEqual(asset["market"], "TW")
        self.assertEqual(asset["currency"], "TWD")
        self.assertEqual(asset["priceSource"], "fund_nav_tw")
        self.assertEqual(asset["unitLabel"], "\u55ae\u4f4d")
        self.assertEqual(asset["exchange"], "SITCA")
        self.assertEqual(asset["dataQuality"], "generated")

    def test_nav_output_schema_valid(self):
        rows = fund_nav.parse_nav_csv(VALID_CSV.encode("utf-8"))
        universe_payload, nav_payload, _ = build_payloads(rows)

        fund_nav.validate_output_payloads(universe_payload, nav_payload)
        quote = nav_payload["quotes"]["TW_FUND_1001"]

        self.assertEqual(nav_payload["version"], 1)
        self.assertEqual(nav_payload["segment"], "domestic_fund")
        self.assertEqual(quote["price"], 12.3456)
        self.assertEqual(quote["currency"], "TWD")
        self.assertEqual(quote["navDate"], "2026-05-20")
        self.assertEqual(quote["tradeDate"], "2026-05-20")
        self.assertEqual(quote["status"], "ok")

    def test_main_dry_run_does_not_write_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            universe_path = Path(temp_dir) / "tw-fund-assets.json"
            nav_path = Path(temp_dir) / "tw-fund-nav.json"

            with patch.object(fund_nav, "fetch_nav_csv", return_value=VALID_CSV.encode("utf-8")):
                exit_code = fund_nav.main(
                    [
                        "--dry-run",
                        "--output-universe",
                        str(universe_path),
                        "--output-nav",
                        str(nav_path),
                    ],
                )

            self.assertEqual(exit_code, 0)
            self.assertFalse(universe_path.exists())
            self.assertFalse(nav_path.exists())

    def test_main_writes_outputs_json_by_default(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            universe_path = Path(temp_dir) / "tw-fund-assets.json"
            nav_path = Path(temp_dir) / "tw-fund-nav.json"

            with patch.object(fund_nav, "fetch_nav_csv", return_value=VALID_CSV.encode("utf-8")):
                exit_code = fund_nav.main(
                    [
                        "--output-universe",
                        str(universe_path),
                        "--output-nav",
                        str(nav_path),
                    ],
                )

            self.assertEqual(exit_code, 0)
            self.assertTrue(universe_path.exists())
            self.assertTrue(nav_path.exists())
            nav_payload = json.loads(nav_path.read_text(encoding="utf-8"))
            self.assertEqual(nav_payload["quoteCount"], 2)


if __name__ == "__main__":
    unittest.main()
