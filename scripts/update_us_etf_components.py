from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import UTC, date, datetime
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "scripts" / "market_etfs_us.json"
DATA_DIR = ROOT / "public" / "data" / "etf-components"
INDEX_PATH = DATA_DIR / "index.json"
USER_AGENT = "investment-portfolio-market-data-updater/1.0"
ALLOWED_DATA_QUALITY = {"sample", "manual", "verified", "stale", "official", "partial"}


@dataclass
class Component:
    symbol: str
    name: str
    weight: float


@dataclass
class FetchResult:
    symbol: str
    name: str
    source_url: str
    source_type: str
    data_quality: str
    as_of_date: str | None
    components: list[Component]


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    updated: list[FetchResult] = []
    skipped: list[str] = []

    config = load_config(CONFIG_PATH)
    for etf in config:
        symbol = require_string(etf, "symbol").upper()
        source_type = require_string(etf, "sourceType")

        if source_type == "manual_static":
            skipped.append(f"{symbol}: manual/static fallback kept ({etf.get('reason', 'no automated source configured')})")
            continue

        try:
            if source_type == "ssga_xlsx":
                result = fetch_ssga_xlsx(etf)
            else:
                raise ValueError(f"unsupported sourceType {source_type!r}")

            validate_fetch_result(result)
            write_dataset(result)
            updated.append(result)
        except Exception as exc:  # noqa: BLE001 - CLI should preserve existing JSON on any source error.
            message = f"{symbol}: {exc}"
            warnings.append(message)
            errors.append(message)

    regenerate_index()

    print("US ETF component update report")
    print(f"Automated ETFs updated: {len(updated)}")
    for result in updated:
        total_weight = sum(component.weight for component in result.components)
        print(
            f"- {result.symbol}: source={result.source_type}, asOfDate={result.as_of_date or 'unknown'}, "
            f"components={len(result.components)}, totalWeight={total_weight:.6f}",
        )

    if skipped:
        print("Manual/static ETFs kept:")
        for item in skipped:
            print(f"- {item}")

    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"- {warning}")

    if not updated:
        print("Final: FAIL")
        return 1

    print("Final: PASS")
    return 0


def load_config(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("version") != 1:
        raise ValueError("market_etfs_us.json version must be 1")
    etfs = data.get("etfs")
    if not isinstance(etfs, list) or not etfs:
        raise ValueError("market_etfs_us.json etfs must be a non-empty array")
    return [item for item in etfs if isinstance(item, dict)]


def fetch_ssga_xlsx(etf: dict[str, Any]) -> FetchResult:
    symbol = require_string(etf, "symbol").upper()
    name = require_string(etf, "name")
    source_url = require_string(etf, "sourceUrl")
    data = fetch_bytes(source_url)
    rows = read_xlsx_rows(data)
    as_of_date = find_as_of_date(rows)
    components = parse_holding_rows(rows, numeric_weight_is_percent=True)

    return FetchResult(
        symbol=symbol,
        name=name,
        source_url=source_url,
        source_type="ssga_xlsx",
        data_quality=require_string(etf, "dataQualityOnSuccess") or "official",
        as_of_date=as_of_date,
        components=components,
    )


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except urllib.error.URLError as exc:
        raise RuntimeError(f"failed to fetch {url}: {exc}") from exc


def read_xlsx_rows(data: bytes) -> list[list[str]]:
    with zipfile.ZipFile(BytesIO(data)) as workbook:
        shared_strings = read_shared_strings(workbook)
        sheet_name = first_sheet_path(workbook)
        root = ElementTree.fromstring(workbook.read(sheet_name))

    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rows: list[list[str]] = []
    for row in root.findall(".//main:sheetData/main:row", namespace):
        values: list[str] = []
        for cell in row.findall("main:c", namespace):
            reference = cell.attrib.get("r", "")
            column_index = column_to_index(reference)
            while len(values) < column_index:
                values.append("")
            values.append(cell_value(cell, shared_strings, namespace))
        rows.append(values)
    return rows


def read_shared_strings(workbook: zipfile.ZipFile) -> list[str]:
    try:
        root = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
    except KeyError:
        return []

    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    strings: list[str] = []
    for item in root.findall("main:si", namespace):
        parts = [text.text or "" for text in item.findall(".//main:t", namespace)]
        strings.append("".join(parts))
    return strings


def first_sheet_path(workbook: zipfile.ZipFile) -> str:
    sheet_paths = sorted(
        name
        for name in workbook.namelist()
        if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
    )
    if not sheet_paths:
        raise ValueError("xlsx workbook has no worksheets")
    return sheet_paths[0]


def cell_value(cell: ElementTree.Element, shared_strings: list[str], namespace: dict[str, str]) -> str:
    cell_type = cell.attrib.get("t")
    value = cell.find("main:v", namespace)
    if value is None or value.text is None:
        inline = cell.find("main:is/main:t", namespace)
        return (inline.text or "").strip() if inline is not None else ""

    raw = value.text.strip()
    if cell_type == "s":
        return shared_strings[int(raw)].strip()
    return raw


def column_to_index(reference: str) -> int:
    letters = "".join(char for char in reference if char.isalpha())
    if not letters:
        return 0
    index = 0
    for char in letters:
        index = index * 26 + (ord(char.upper()) - ord("A") + 1)
    return index - 1


def find_as_of_date(rows: list[list[str]]) -> str | None:
    date_pattern = re.compile(r"\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b")
    day_month_pattern = re.compile(
        r"\b(\d{1,2})[- ]([A-Za-z]{3,9})[- ](20\d{2})\b",
        re.IGNORECASE,
    )
    months = {
        "jan": 1,
        "january": 1,
        "feb": 2,
        "february": 2,
        "mar": 3,
        "march": 3,
        "apr": 4,
        "april": 4,
        "may": 5,
        "jun": 6,
        "june": 6,
        "jul": 7,
        "july": 7,
        "aug": 8,
        "august": 8,
        "sep": 9,
        "sept": 9,
        "september": 9,
        "oct": 10,
        "october": 10,
        "nov": 11,
        "november": 11,
        "dec": 12,
        "december": 12,
    }
    for row in rows[:30]:
        text = " ".join(cell for cell in row if cell)
        match = date_pattern.search(text)
        if match:
            year, month, day = match.groups()
            return date(int(year), int(month), int(day)).isoformat()
        match = day_month_pattern.search(text)
        if match:
            day, month_name, year = match.groups()
            month = months.get(month_name.lower())
            if month is not None:
                return date(int(year), month, int(day)).isoformat()
    return None


def parse_holding_rows(
    rows: list[list[str]],
    numeric_weight_is_percent: bool = False,
) -> list[Component]:
    header_index, columns = find_header(rows)
    components: list[Component] = []
    seen: set[str] = set()

    for row in rows[header_index + 1 :]:
        symbol = get_row_value(row, columns["symbol"]).upper()
        name = get_row_value(row, columns["name"])
        weight_text = get_row_value(row, columns["weight"])

        if not symbol and not name and not weight_text:
            continue
        if not symbol or not name or not weight_text:
            continue
        if symbol.upper() in {"CASH_USD", "CASH", "USD", "-"}:
            continue

        weight = parse_weight(weight_text, numeric_weight_is_percent=numeric_weight_is_percent)
        if weight <= 0:
            continue
        if symbol in seen:
            continue

        seen.add(symbol)
        components.append(Component(symbol=symbol, name=name, weight=round(weight, 8)))

    if not components:
        raise ValueError("no valid holding rows found in workbook")
    return components


def find_header(rows: list[list[str]]) -> tuple[int, dict[str, int]]:
    for index, row in enumerate(rows):
        normalized = [normalize_header(cell) for cell in row]
        symbol_index = find_column(normalized, {"ticker", "ticker symbol", "symbol"})
        name_index = find_column(normalized, {"name", "security name", "holding name", "description"})
        weight_index = find_column(normalized, {"weight", "weight (%)", "weight %", "market value weight"})
        if symbol_index is not None and name_index is not None and weight_index is not None:
            return index, {"symbol": symbol_index, "name": name_index, "weight": weight_index}
    raise ValueError("could not find symbol/name/weight header row")


def normalize_header(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def find_column(headers: list[str], accepted: set[str]) -> int | None:
    for index, header in enumerate(headers):
        if header in accepted:
            return index
    return None


def get_row_value(row: list[str], index: int) -> str:
    return row[index].strip() if index < len(row) else ""


def parse_weight(value: str, numeric_weight_is_percent: bool = False) -> float:
    text = value.strip().replace(",", "")
    if text.endswith("%"):
        return float(text[:-1].strip()) / 100
    numeric = float(text)
    if numeric_weight_is_percent:
        return numeric / 100
    return numeric / 100 if numeric > 1 else numeric


def validate_fetch_result(result: FetchResult) -> None:
    if result.data_quality not in ALLOWED_DATA_QUALITY:
        raise ValueError(f"{result.symbol}: unsupported dataQuality {result.data_quality}")
    if not result.components:
        raise ValueError(f"{result.symbol}: no components parsed")

    total_weight = sum(component.weight for component in result.components)
    if total_weight <= 0:
        raise ValueError(f"{result.symbol}: total weight must be positive")
    if total_weight > 1.01:
        raise ValueError(f"{result.symbol}: total weight {total_weight:.6f} exceeds 1.01")

    seen: set[str] = set()
    for component in result.components:
        if not component.symbol or not component.name:
            raise ValueError(f"{result.symbol}: component symbol/name is required")
        if component.symbol in seen:
            raise ValueError(f"{result.symbol}: duplicate component {component.symbol}")
        if component.weight <= 0 or component.weight > 1:
            raise ValueError(f"{result.symbol}: invalid weight for {component.symbol}")
        seen.add(component.symbol)


def write_dataset(result: FetchResult) -> None:
    now = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    total_weight = round(sum(component.weight for component in result.components), 8)
    payload = {
        "version": 1,
        "symbol": result.symbol,
        "name": result.name,
        "market": "US",
        "source": "automated-us-etf-components",
        "sourceType": result.source_type,
        "sourceNote": "Automated US ETF component data generated from issuer downloadable holdings. If update fails, the previous valid JSON remains.",
        "sourceUrl": result.source_url,
        "asOfDate": result.as_of_date,
        "lastUpdated": now,
        "dataQuality": result.data_quality,
        "componentCount": len(result.components),
        "totalWeight": total_weight,
        "components": [
            {
                "symbol": component.symbol,
                "name": component.name,
                "weight": component.weight,
            }
            for component in result.components
        ],
    }
    output_path = DATA_DIR / f"{result.symbol}.json"
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def regenerate_index() -> None:
    current = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    datasets = current.get("datasets", [])
    known = {item for item in datasets if isinstance(item, str)}
    for path in sorted(DATA_DIR.glob("*.json")):
        if path.name != "index.json":
            known.add(path.name)

    preferred = ["0050.json", "006208.json", "00878.json", "VOO.json", "SPY.json", "QQQ.json"]
    ordered = [name for name in preferred if name in known]
    ordered.extend(sorted(name for name in known if name not in set(ordered)))
    INDEX_PATH.write_text(
        json.dumps({"version": 1, "datasets": ordered}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def require_string(data: dict[str, Any], key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} is required")
    return value.strip()


if __name__ == "__main__":
    sys.exit(main())
