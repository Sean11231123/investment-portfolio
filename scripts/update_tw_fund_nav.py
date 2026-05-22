#!/usr/bin/env python3
"""Generate domestic Taiwan fund universe and NAV data from the official SITCA CSV."""

from __future__ import annotations

import argparse
import base64
import csv
import io
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://www.sitca.org.tw/MemberK0000/F/03/nav.csv"
DEFAULT_UNIVERSE_PATH = ROOT / "public" / "data" / "universe" / "tw-fund-assets.json"
DEFAULT_NAV_PATH = ROOT / "public" / "data" / "market" / "tw-fund-nav.json"

DATE_FIELD = "\u65e5\u671f"
MEMBER_CODE_FIELD = "\u6703\u54e1\u4ee3\u865f"
COMPANY_NAME_FIELD = "\u516c\u53f8\u540d\u7a31"
FUND_TAX_ID_FIELD = "\u57fa\u91d1\u7d71\u7de8"
FUND_CODE_FIELD = "\u57fa\u91d1\u4ee3\u865f"
FUND_NAME_FIELD = "\u57fa\u91d1\u540d\u7a31"
NAV_FIELD = "\u57fa\u91d1\u6de8\u503c"
CHANGE_FIELD = "\u6f32\u8dcc"
CHANGE_PERCENT_FIELD = "\u6f32\u8dcc\u5e45"
TYPE_CODE_FIELD = "\u985e\u578b\u4ee3\u865f"
CURRENCY_FIELD = "\u5e63\u5225"
BENEFICIARY_CERTIFICATE_CODE_FIELD = "\u53d7\u76ca\u6191\u8b49\u4ee3\u865f"

MISSING_MARKERS = {"", "-", "--", "\u2026", "...", "N/A", "NA", "null"}
SUPPORTED_OUTPUT_CURRENCIES = {"TWD"}


@dataclass(frozen=True)
class FundNavRow:
    nav_date: str | None
    member_code: str
    company_name: str
    fund_tax_id: str
    fund_code: str
    fund_name: str
    nav: float | None
    change: float | None
    change_percent: float | None
    fund_type_code: str
    currency: str
    beneficiary_certificate_code: str


@dataclass(frozen=True)
class IdentityAudit:
    total_rows: int
    rows_with_fund_code: int
    duplicate_fund_code_count: int
    duplicate_tax_currency_type_count: int
    duplicate_fallback_symbol_count: int
    duplicate_fund_name_count: int
    chosen_strategy: str
    stable: bool


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    generated_at = utc_now_iso()

    try:
        content = fetch_nav_csv()
        rows = parse_nav_csv(content)
        if not rows:
            raise ValueError("SITCA NAV CSV produced no usable rows.")
        audit = audit_identity(rows)
        currency_counts = count_currencies(rows)
        universe_payload, nav_payload, excluded = build_output_payloads(rows, audit, generated_at)
        validate_output_payloads(universe_payload, nav_payload)
    except Exception as exc:  # noqa: BLE001 - prototype should fail clearly.
        print(f"Taiwan fund NAV prototype failed: {exc}", file=sys.stderr)
        return 1

    print("Taiwan domestic fund NAV static pipeline report")
    print(f"source: SITCA CSV via data.gov.tw dataset 11109")
    print(f"endpoint: {SOURCE_URL}")
    print(f"total rows: {audit.total_rows}")
    print(f"rows with fundCode: {audit.rows_with_fund_code}")
    print(f"duplicate fundCode count: {audit.duplicate_fund_code_count}")
    print(f"duplicate fundTaxId/currency/type count: {audit.duplicate_tax_currency_type_count}")
    print(f"duplicate fallback symbol count: {audit.duplicate_fallback_symbol_count}")
    print(f"duplicate fund names count: {audit.duplicate_fund_name_count}")
    print(f"chosen symbol strategy: {audit.chosen_strategy}")
    print(f"identity stable: {audit.stable}")
    print("currency distribution:")
    for currency, count in sorted(currency_counts.items()):
        print(f"- {currency}: {count}")
    print(f"TWD output asset count: {len(universe_payload['assets'])}")
    print(f"TWD output quote count: {len(nav_payload['quotes'])}")
    print(f"excluded non-TWD rows: {excluded}")

    if not audit.stable:
        print("identity audit failed; output not written", file=sys.stderr)
        return 1

    if args.dry_run:
        print("dry run: output not written")
        return 0

    write_json(args.output_universe, universe_payload)
    write_json(args.output_nav, nav_payload)
    print(f"universe output: {relative_path(args.output_universe)} ({args.output_universe.stat().st_size} bytes)")
    print(f"NAV output: {relative_path(args.output_nav)} ({args.output_nav.stat().st_size} bytes)")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate domestic Taiwan fund universe and NAV data from the official SITCA CSV.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the SITCA audit summary without writing JSON outputs.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Deprecated compatibility flag; output is written by default.",
    )
    parser.add_argument(
        "--output-universe",
        type=Path,
        default=DEFAULT_UNIVERSE_PATH,
        help="Fund universe output path.",
    )
    parser.add_argument(
        "--output-nav",
        type=Path,
        default=DEFAULT_NAV_PATH,
        help="Fund NAV output path.",
    )
    return parser.parse_args(argv)


def fetch_nav_csv() -> bytes:
    request = urllib.request.Request(
        SOURCE_URL,
        headers={
            "Accept": "text/csv,*/*",
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0 Safari/537.36"
            ),
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"SITCA NAV CSV returned HTTP {exc.code}") from exc
    except (urllib.error.URLError, ConnectionError) as exc:
        return fetch_nav_csv_with_powershell(exc)


def fetch_nav_csv_with_powershell(error: Exception) -> bytes:
    if sys.platform != "win32":
        raise RuntimeError(f"SITCA NAV CSV request failed: {error}") from error
    command = [
        "powershell",
        "-NoProfile",
        "-Command",
        (
            "$client = New-Object System.Net.WebClient; "
            "$client.Headers.Add('User-Agent', 'Mozilla/5.0'); "
            f"$bytes = $client.DownloadData('{SOURCE_URL}'); "
            "[Convert]::ToBase64String($bytes)"
        ),
    ]
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=30,
        )
    except (subprocess.SubprocessError, OSError) as fallback_error:
        raise RuntimeError(
            f"SITCA NAV CSV request failed: {error}; PowerShell fallback failed: {fallback_error}",
        ) from fallback_error
    return base64.b64decode(result.stdout.strip())


def parse_nav_csv(content: bytes) -> list[FundNavRow]:
    text = decode_csv_bytes(content)
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ValueError("SITCA NAV CSV missing header row.")
    missing_fields = [field for field in required_fields() if field not in reader.fieldnames]
    if missing_fields:
        raise ValueError(f"SITCA NAV CSV missing required columns: {missing_fields}")

    rows: list[FundNavRow] = []
    for raw in reader:
        fund_name = clean_text(raw.get(FUND_NAME_FIELD))
        if not fund_name:
            continue
        rows.append(
            FundNavRow(
                nav_date=parse_date(raw.get(DATE_FIELD)),
                member_code=clean_text(raw.get(MEMBER_CODE_FIELD)),
                company_name=clean_text(raw.get(COMPANY_NAME_FIELD)),
                fund_tax_id=clean_text(raw.get(FUND_TAX_ID_FIELD)),
                fund_code=clean_text(raw.get(FUND_CODE_FIELD)),
                fund_name=fund_name,
                nav=parse_number(raw.get(NAV_FIELD)),
                change=parse_number(raw.get(CHANGE_FIELD)),
                change_percent=parse_number(raw.get(CHANGE_PERCENT_FIELD)),
                fund_type_code=clean_text(raw.get(TYPE_CODE_FIELD)),
                currency=normalize_currency(raw.get(CURRENCY_FIELD)),
                beneficiary_certificate_code=clean_text(raw.get(BENEFICIARY_CERTIFICATE_CODE_FIELD)),
            ),
        )
    return rows


def decode_csv_bytes(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp950", "big5"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", content, 0, 1, "Unable to decode SITCA NAV CSV.")


def required_fields() -> tuple[str, ...]:
    return (
        DATE_FIELD,
        MEMBER_CODE_FIELD,
        COMPANY_NAME_FIELD,
        FUND_TAX_ID_FIELD,
        FUND_CODE_FIELD,
        FUND_NAME_FIELD,
        NAV_FIELD,
        TYPE_CODE_FIELD,
        CURRENCY_FIELD,
        BENEFICIARY_CERTIFICATE_CODE_FIELD,
    )


def audit_identity(rows: list[FundNavRow]) -> IdentityAudit:
    fund_codes = [row.fund_code for row in rows if row.fund_code]
    tax_currency_type_keys = [
        make_tax_currency_type_key(row)
        for row in rows
        if row.fund_tax_id and row.currency and row.fund_type_code
    ]
    fallback_symbols = [build_symbol(row, "fallback") for row in rows if build_symbol(row, "fallback")]
    fund_names = [row.fund_name for row in rows if row.fund_name]

    duplicate_fund_code_count = duplicate_item_count(fund_codes)
    duplicate_tax_currency_type_count = duplicate_item_count(tax_currency_type_keys)
    duplicate_fallback_symbol_count = duplicate_item_count(fallback_symbols)

    if fund_codes and len(fund_codes) == len(rows) and duplicate_fund_code_count == 0:
        strategy = "fundCode"
        stable = True
    elif fallback_symbols and len(fallback_symbols) == len(rows) and duplicate_fallback_symbol_count == 0:
        strategy = "fallback"
        stable = True
    else:
        strategy = "unstable"
        stable = False

    return IdentityAudit(
        total_rows=len(rows),
        rows_with_fund_code=len(fund_codes),
        duplicate_fund_code_count=duplicate_fund_code_count,
        duplicate_tax_currency_type_count=duplicate_tax_currency_type_count,
        duplicate_fallback_symbol_count=duplicate_fallback_symbol_count,
        duplicate_fund_name_count=duplicate_item_count(fund_names),
        chosen_strategy=strategy,
        stable=stable,
    )


def build_output_payloads(
    rows: list[FundNavRow],
    audit: IdentityAudit,
    generated_at: str,
) -> tuple[dict[str, Any], dict[str, Any], int]:
    assets: list[dict[str, Any]] = []
    quotes: dict[str, dict[str, Any]] = {}
    excluded = 0

    for row in rows:
        if row.currency not in SUPPORTED_OUTPUT_CURRENCIES:
            excluded += 1
            continue
        symbol = build_symbol(row, audit.chosen_strategy)
        if not symbol:
            excluded += 1
            continue

        assets.append(build_universe_asset(row, symbol))
        quotes[symbol] = build_nav_quote(row, symbol)

    universe_payload = {
        "version": 1,
        "generatedAt": generated_at,
        "source": "SITCA",
        "sourceUrl": SOURCE_URL,
        "market": "TW",
        "segment": "domestic_fund",
        "count": len(assets),
        "assets": assets,
        "errors": [],
    }
    nav_payload = {
        "version": 1,
        "generatedAt": generated_at,
        "source": "SITCA",
        "sourceUrl": SOURCE_URL,
        "market": "TW",
        "segment": "domestic_fund",
        "currencyPolicy": "TWD_ONLY",
        "quoteCount": len(quotes),
        "pricedCount": sum(1 for quote in quotes.values() if quote["status"] == "ok"),
        "unavailableCount": sum(1 for quote in quotes.values() if quote["status"] != "ok"),
        "quotes": quotes,
        "errors": [],
    }
    return universe_payload, nav_payload, excluded


def build_universe_asset(row: FundNavRow, symbol: str) -> dict[str, Any]:
    return {
        "symbol": symbol,
        "name": row.fund_name,
        "type": "taiwan_fund",
        "market": "TW",
        "currency": row.currency,
        "unitLabel": "\u55ae\u4f4d",
        "priceSource": "fund_nav_tw",
        "exchange": "SITCA",
        "marketSegment": "fund",
        "source": "sitca-nav",
        "sourceSymbol": row.fund_code,
        "fundCode": row.fund_code,
        "fundTaxId": row.fund_tax_id,
        "issuer": row.company_name,
        "fundTypeCode": row.fund_type_code,
        "beneficiaryCertificateCode": row.beneficiary_certificate_code,
        "aliases": [value for value in [row.company_name, row.fund_tax_id] if value],
        "dataQuality": "generated",
    }


def build_nav_quote(row: FundNavRow, symbol: str) -> dict[str, Any]:
    status = "ok" if row.nav is not None and row.nav > 0 and row.nav_date else "unavailable"
    quote = {
        "symbol": symbol,
        "name": row.fund_name,
        "price": row.nav if status == "ok" else None,
        "currency": row.currency,
        "source": "static-tw-fund-nav-json",
        "navDate": row.nav_date,
        "tradeDate": row.nav_date,
        "lastUpdated": utc_now_iso(),
        "status": status,
    }
    if status != "ok":
        quote["error"] = "Domestic fund NAV missing or unavailable."
    return quote


def validate_output_payloads(universe: dict[str, Any], nav: dict[str, Any]) -> None:
    if universe.get("version") != 1 or universe.get("market") != "TW":
        raise ValueError("Universe output has an invalid schema.")
    if nav.get("version") != 1 or nav.get("market") != "TW":
        raise ValueError("NAV output has an invalid schema.")
    assets = universe.get("assets")
    quotes = nav.get("quotes")
    if not isinstance(assets, list) or not isinstance(quotes, dict):
        raise ValueError("Prototype outputs missing assets or quotes.")
    for asset in assets:
        if asset.get("type") != "taiwan_fund":
            raise ValueError("Universe output contains non-fund asset.")
        if asset.get("currency") != "TWD":
            raise ValueError("Universe output contains non-TWD asset.")
        if asset.get("symbol") not in quotes:
            raise ValueError(f"Missing NAV quote for {asset.get('symbol')}.")
    for symbol, quote in quotes.items():
        if quote.get("price") == 0:
            raise ValueError(f"{symbol}: missing fund NAV must not be zero.")
        if quote.get("currency") != "TWD":
            raise ValueError(f"{symbol}: NAV output contains unsupported currency.")
        if not quote.get("navDate") or not quote.get("tradeDate"):
            raise ValueError(f"{symbol}: NAV output missing navDate/tradeDate.")


def count_currencies(rows: list[FundNavRow]) -> dict[str, int]:
    return dict(Counter(row.currency or "UNKNOWN" for row in rows))


def build_symbol(row: FundNavRow, strategy: str) -> str | None:
    if strategy == "fundCode" and row.fund_code:
        return f"TW_FUND_{sanitize_symbol_part(row.fund_code)}"
    if strategy in {"fallback", "fundCode"}:
        parts = [
            sanitize_symbol_part(row.fund_tax_id),
            sanitize_symbol_part(row.currency),
            sanitize_symbol_part(row.fund_type_code),
            sanitize_symbol_part(row.beneficiary_certificate_code),
        ]
        required = parts[:3]
        if all(required):
            suffix = "_".join(part for part in parts if part)
            return f"TW_FUND_{suffix}"
    return None


def make_tax_currency_type_key(row: FundNavRow) -> str:
    return "|".join([row.fund_tax_id, row.currency, row.fund_type_code])


def duplicate_item_count(values: list[str]) -> int:
    counts = Counter(values)
    return sum(count - 1 for count in counts.values() if count > 1)


def sanitize_symbol_part(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "", value.strip().upper())


def parse_date(value: Any) -> str | None:
    text = clean_text(value)
    digits = re.sub(r"\D", "", text)
    if len(digits) == 8:
        year = int(digits[:4])
        month = int(digits[4:6])
        day = int(digits[6:8])
    elif len(digits) == 7:
        year = int(digits[:3]) + 1911
        month = int(digits[3:5])
        day = int(digits[5:7])
    else:
        return None
    if month < 1 or month > 12 or day < 1 or day > 31:
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def parse_number(value: Any) -> float | None:
    text = clean_text(value).replace(",", "")
    if text in MISSING_MARKERS:
        return None
    text = re.sub(r"^[prf]\s+", "", text, flags=re.IGNORECASE).strip()
    if text in MISSING_MARKERS:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def normalize_currency(value: Any) -> str:
    text = sanitize_symbol_part(clean_text(value))
    aliases = {
        "NTD": "TWD",
        "NT": "TWD",
        "TWD": "TWD",
        "USD": "USD",
    }
    raw = clean_text(value)
    chinese_aliases = {
        "\u65b0\u53f0\u5e63": "TWD",
        "\u65b0\u81fa\u5e63": "TWD",
        "\u53f0\u5e63": "TWD",
        "\u81fa\u5e63": "TWD",
        "\u7f8e\u5143": "USD",
        "\u7f8e\u91d1": "USD",
    }
    return aliases.get(text) or chinese_aliases.get(raw, text or "UNKNOWN")


def clean_text(value: Any) -> str:
    return str(value or "").strip()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


def relative_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
