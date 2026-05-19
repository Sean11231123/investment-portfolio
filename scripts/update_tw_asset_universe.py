from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "public" / "data" / "universe" / "tw-assets.json"
TWSE_SOURCE_URL = "https://isin.twse.com.tw/isin/C_public.jsp?strMode=2"
TPEX_SOURCE_URL = "https://isin.twse.com.tw/isin/C_public.jsp?strMode=4"
SOURCE_NAME = "twse-isin-listed-and-tpex-otc-securities"
TWSE_SOURCE_NAME = "twse-isin-listed-securities"
TPEX_SOURCE_NAME = "twse-isin-tpex-listed-securities"

ETF_CATEGORY_KEYWORDS = ("ETF",)
STOCK_CATEGORY_KEYWORDS = ("\u80a1\u7968", "Stocks")
EXCLUDED_CATEGORY_KEYWORDS = (
    "\u6b0a\u8b49",
    "\u8a8d\u8cfc",
    "\u8a8d\u552e",
    "\u725b\u718a",
    "ETN",
    "\u53d7\u76ca\u8b49\u5238",
    "\u8cc7\u7522\u57fa\u790e\u8b49\u5238",
    "\u50b5\u5238",
    "Warrant",
    "Warrants",
    "Callable Bull/Bear",
    "Bond",
)
EXCLUDED_NAME_KEYWORDS = ("\u69d3\u687f", "\u53cd\u5411", "\u671f\u8ca8")
EXCLUDED_ETF_SUFFIXES = ("L", "R", "U")


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._in_td = False
        self._current_cell: list[str] = []
        self._current_row: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "tr":
            self._current_row = []
        elif tag.lower() == "td":
            self._in_td = True
            self._current_cell = []

    def handle_data(self, data: str) -> None:
        if self._in_td:
            self._current_cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        normalized = tag.lower()
        if normalized == "td":
            self._in_td = False
            self._current_row.append(clean_text("".join(self._current_cell)))
        elif normalized == "tr" and self._current_row:
            self.rows.append(self._current_row)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the Taiwan searchable asset universe from TWSE/TPEx ISIN data.",
    )
    parser.add_argument("--input", type=Path, help="Read TWSE fixture HTML instead of fetching TWSE.")
    parser.add_argument("--tpex-input", type=Path, help="Read TPEx fixture HTML instead of fetching TPEx.")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    errors: list[str] = []

    try:
        twse_body = args.input.read_text(encoding="utf-8") if args.input else fetch_source(TWSE_SOURCE_URL)
        tpex_body = (
            args.tpex_input.read_text(encoding="utf-8")
            if args.tpex_input
            else fetch_source(TPEX_SOURCE_URL)
        )
        twse_assets = parse_twse_isin_assets(twse_body)
        tpex_assets = parse_tpex_otc_assets(tpex_body)
        assets, merge_stats = merge_assets(twse_assets, tpex_assets)
    except Exception as exc:  # noqa: BLE001 - avoid clobbering the last good universe.
        errors.append(f"Taiwan universe fetch/parse failed: {exc}")
        return report_failure(args.output, errors)

    payload = build_payload(assets, generated_at, errors, merge_stats, existing_path=args.output)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    stock_count = sum(1 for asset in assets if asset["type"] == "taiwan_stock")
    etf_count = sum(1 for asset in assets if asset["type"] == "taiwan_etf")
    otc_stock_count = sum(
        1
        for asset in assets
        if asset.get("exchange") == "TPEX" and asset["type"] == "taiwan_stock"
    )
    otc_etf_count = sum(
        1
        for asset in assets
        if asset.get("exchange") == "TPEX" and asset["type"] == "taiwan_etf"
    )

    print(f"source: {SOURCE_NAME}")
    print(f"assets generated: {len(assets)}")
    print(f"twse assets: {merge_stats['twse']}")
    print(f"tpex otc assets: {merge_stats['tpex_added']}")
    print(f"stocks: {stock_count}")
    print(f"etfs: {etf_count}")
    print(f"otc stocks: {otc_stock_count}")
    print(f"otc etfs: {otc_etf_count}")
    print(f"duplicates skipped: {merge_stats['duplicates']}")
    print(f"00981A present: {any(asset['symbol'] == '00981A' for asset in assets)}")
    print(f"output path: {args.output}")
    if errors:
        print("errors:")
        for error in errors:
            print(f"- {error}")

    if not assets:
        return report_failure(args.output, ["Taiwan ISIN parse produced no target assets."])

    return 0


def report_failure(output_path: Path, errors: list[str]) -> int:
    print(f"source: {SOURCE_NAME}")
    print("assets generated: 0")
    print("twse assets: 0")
    print("tpex otc assets: 0")
    print("stocks: 0")
    print("etfs: 0")
    print("otc stocks: 0")
    print("otc etfs: 0")
    print("duplicates skipped: 0")
    print("00981A present: False")
    print(f"output path preserved: {output_path}")
    print("errors:")
    for error in errors:
        print(f"- {error}")
    return 1


def fetch_source(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "investment-portfolio-tw-universe-updater/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(str(exc.reason)) from exc

    for encoding in ("utf-8-sig", "cp950", "big5"):
        try:
            return body.decode(encoding)
        except UnicodeDecodeError:
            continue
    return body.decode("cp950", errors="replace")


def parse_twse_isin_assets(source_html: str) -> list[dict[str, Any]]:
    return parse_isin_assets(
        source_html,
        exchange="TWSE",
        market_segment="listed",
        source="twse-isin",
        price_source="twse",
    )


def parse_tpex_otc_assets(source_html: str) -> list[dict[str, Any]]:
    return parse_isin_assets(
        source_html,
        exchange="TPEX",
        market_segment="otc",
        source="tpex-isin",
        price_source="tpex_otc",
    )


def parse_isin_assets(
    source_html: str,
    *,
    exchange: str,
    market_segment: str,
    source: str,
    price_source: str,
) -> list[dict[str, Any]]:
    table = TableParser()
    table.feed(source_html)

    assets: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    current_category = ""

    for row in table.rows:
        cells = [clean_text(cell) for cell in row]
        if not cells:
            continue

        category = get_category(cells)
        if category:
            current_category = category
            continue

        parsed = parse_symbol_name(cells[0])
        if not parsed:
            continue

        symbol, name = parsed
        asset_type = classify_asset(symbol, name, current_category)
        if asset_type is None:
            continue

        key = (symbol, asset_type)
        if key in seen:
            continue
        seen.add(key)

        assets.append(
            {
                "symbol": symbol,
                "name": name,
                "type": asset_type,
                "market": "TW",
                "currency": "TWD",
                "unitLabel": "\u80a1",
                "priceSource": price_source,
                "aliases": [name],
                "exchange": exchange,
                "marketSegment": market_segment,
                "source": source,
                "sourceSymbol": symbol,
                "isETF": asset_type == "taiwan_etf",
                "dataQuality": "generated",
            },
        )

    return sorted(assets, key=lambda asset: asset["symbol"])


def merge_assets(
    twse_assets: list[dict[str, Any]],
    tpex_assets: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    merged = list(twse_assets)
    seen_symbols = {asset["symbol"] for asset in twse_assets}
    duplicates = 0
    tpex_added = 0

    for asset in tpex_assets:
        if asset["symbol"] in seen_symbols:
            duplicates += 1
            continue
        seen_symbols.add(asset["symbol"])
        merged.append(asset)
        tpex_added += 1

    return sorted(merged, key=lambda asset: asset["symbol"]), {
        "twse": len(twse_assets),
        "tpex_source": len(tpex_assets),
        "tpex_added": tpex_added,
        "duplicates": duplicates,
    }


def build_payload(
    assets: list[dict[str, Any]],
    generated_at: str,
    errors: list[str],
    stats: dict[str, int] | None = None,
    existing_path: Path = OUTPUT_PATH,
) -> dict[str, Any]:
    stats = stats or {
        "twse": len([asset for asset in assets if asset.get("exchange") == "TWSE"]),
        "tpex_source": len([asset for asset in assets if asset.get("exchange") == "TPEX"]),
        "tpex_added": len([asset for asset in assets if asset.get("exchange") == "TPEX"]),
        "duplicates": 0,
    }
    payload = {
        "version": 1,
        "market": "TW",
        "source": SOURCE_NAME,
        "generatedAt": generated_at,
        "count": len(assets),
        "twseCount": stats["twse"],
        "tpexOtcCount": stats["tpex_added"],
        "tpexOtcSourceCount": stats["tpex_source"],
        "duplicateCount": stats["duplicates"],
        "assets": assets,
        "errors": errors,
    }

    existing = load_existing_payload(existing_path)
    if existing and payload_without_generated_at(existing) == payload_without_generated_at(payload):
        payload["generatedAt"] = existing["generatedAt"]

    return payload


def load_existing_payload(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) and isinstance(value.get("generatedAt"), str) else None


def payload_without_generated_at(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if key != "generatedAt"}


def get_category(cells: list[str]) -> str | None:
    first = cells[0].strip()
    if not first:
        return None

    if is_excluded_category(first):
        return first

    if any(keyword in first for keyword in ETF_CATEGORY_KEYWORDS):
        return first

    if any(keyword in first for keyword in STOCK_CATEGORY_KEYWORDS):
        return first

    return None


def parse_symbol_name(value: str) -> tuple[str, str] | None:
    normalized = clean_text(value)
    match = re.match(r"^([0-9A-Z]{4,6})\s+(.+)$", normalized)
    if not match:
        return None

    symbol = match.group(1).strip().upper()
    name = match.group(2).strip()
    if not symbol or not name:
        return None

    return symbol, name


def classify_asset(symbol: str, name: str, category: str) -> str | None:
    if is_excluded_category(category):
        return None

    if any(keyword in name for keyword in EXCLUDED_NAME_KEYWORDS):
        return None

    if any(keyword in category for keyword in ETF_CATEGORY_KEYWORDS):
        return "taiwan_etf" if is_taiwan_etf_symbol(symbol) else None

    if any(keyword in category for keyword in STOCK_CATEGORY_KEYWORDS):
        return "taiwan_stock" if re.fullmatch(r"[1-9][0-9]{3}", symbol) else None

    return None


def is_excluded_category(category: str) -> bool:
    return any(keyword in category for keyword in EXCLUDED_CATEGORY_KEYWORDS)


def is_taiwan_etf_symbol(symbol: str) -> bool:
    if not re.fullmatch(r"00[0-9A-Z]{2,4}", symbol):
        return False
    return not symbol.endswith(EXCLUDED_ETF_SUFFIXES)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value).replace("\u3000", " ")).strip()


if __name__ == "__main__":
    sys.exit(main())
