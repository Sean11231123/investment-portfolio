from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "normalize_etf_components.py"
FIXTURES = ROOT / "scripts" / "fixtures" / "etf-components"


class ETFComponentNormalizerTests(unittest.TestCase):
    def run_normalizer(self, csv_name: str) -> tuple[subprocess.CompletedProcess[str], Path]:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        output_path = Path(temp_dir.name) / "TEST.json"
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--csv",
                str(FIXTURES / csv_name),
                "--meta",
                str(FIXTURES / "valid.meta.json"),
                "--output",
                str(output_path),
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        return result, output_path

    def test_parses_english_headers_and_decimal_weights(self) -> None:
        result, output_path = self.run_normalizer("valid_en.csv")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        data = json.loads(output_path.read_text(encoding="utf-8"))
        self.assertEqual(data["symbol"], "TEST")
        self.assertEqual(data["market"], "TW")
        self.assertEqual(data["componentCount"], 2)
        self.assertEqual(data["totalWeight"], 0.54)
        self.assertEqual(data["components"][0]["weight"], 0.48)

    def test_parses_chinese_headers_and_percent_weights(self) -> None:
        result, output_path = self.run_normalizer("valid_zh.csv")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        data = json.loads(output_path.read_text(encoding="utf-8"))
        self.assertEqual(data["components"][0]["symbol"], "2330")
        self.assertEqual(data["components"][0]["weight"], 0.48)
        self.assertEqual(data["components"][1]["weight"], 0.06)

    def test_rejects_ambiguous_bare_percent_number(self) -> None:
        result, output_path = self.run_normalizer("invalid_ambiguous_weight.csv")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ambiguous", result.stdout)
        self.assertFalse(output_path.exists())

    def test_rejects_duplicate_symbols(self) -> None:
        result, output_path = self.run_normalizer("invalid_duplicate.csv")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("duplicate symbol", result.stdout)
        self.assertFalse(output_path.exists())

    def test_rejects_missing_required_name(self) -> None:
        result, output_path = self.run_normalizer("invalid_missing_name.csv")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("name is required", result.stdout)
        self.assertFalse(output_path.exists())


if __name__ == "__main__":
    unittest.main()
