#!/usr/bin/env python3
"""Merge Taiwan macro indicators into the static macro indicator JSON file."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MACRO_PATH = ROOT / "public" / "data" / "macro" / "macro-indicators.json"
TAIWAN_MAJOR_ECONOMIC_INDICATORS_URL = (
    "https://apiservice.mol.gov.tw/OdService/download/A17030000J-000016-xC8"
)
HISTORY_LIMIT = 24

DATE_FIELD = "\u65e5\u671f\uff08\u6708\u5225\uff09"
CPI_FIELD = "\u6d88\u8cbb\u8005\u7269\u50f9-\u6307\u6578"
PPI_FIELD = "\u751f\u7522\u8005\u7269\u50f9-\u6307\u6578"
UNEMPLOYMENT_FIELD = "\u5931\u696d\u7387\uff08\u767e\u5206\u6bd4\uff09"
MISSING_MARKERS = {"", "-", "--", "\u2026", "...", "N/A", "NA", "null"}


@dataclass(frozen=True)
class TaiwanIndicatorDefinition:
    indicator_id: str
    source_field: str
    category: str
    name: str
    unit: str
    change_unit: str
    calculation: str
    note: str


TAIWAN_INDICATORS: tuple[TaiwanIndicatorDefinition, ...] = (
    TaiwanIndicatorDefinition(
        indicator_id="TW_CPI",
        source_field=CPI_FIELD,
        category="inflation",
        name="Taiwan CPI",
        unit="index",
        change_unit="decimal_return",
        calculation="index_change",
        note="Taiwan CPI index from the official monthly domestic major economic indicators dataset.",
    ),
    TaiwanIndicatorDefinition(
        indicator_id="TW_PPI",
        source_field=PPI_FIELD,
        category="inflation",
        name="Taiwan PPI",
        unit="index",
        change_unit="decimal_return",
        calculation="index_change",
        note="Taiwan PPI index from the official monthly domestic major economic indicators dataset.",
    ),
    TaiwanIndicatorDefinition(
        indicator_id="TW_UNEMPLOYMENT_RATE",
        source_field=UNEMPLOYMENT_FIELD,
        category="labor",
        name="Taiwan Unemployment Rate",
        unit="percent_rate",
        change_unit="percentage_point",
        calculation="percentage_point_change",
        note="Taiwan unemployment rate from the official monthly domestic major economic indicators dataset.",
    ),
)


def main() -> int:
    args = parse_args()
    generated_at = utc_now_iso()
    output_path = args.output

    try:
        rows = fetch_taiwan_macro_rows()
        taiwan_indicators = build_taiwan_indicators(rows)
        validate_taiwan_indicators(taiwan_indicators)
        base_payload = read_existing_macro_payload(args.input)
        merged = merge_taiwan_indicators(base_payload, taiwan_indicators, generated_at)
        validate_merged_payload(merged)
    except Exception as exc:  # noqa: BLE001 - fail clearly and preserve previous output.
        print(f"Taiwan macro indicator update failed: {exc}", file=sys.stderr)
        if output_path.exists():
            print(f"Existing output preserved: {output_path}", file=sys.stderr)
        return 1

    print("Taiwan macro indicator update report")
    print("source: data.gov.tw monthly domestic major economic indicators")
    print(f"endpoint: {TAIWAN_MAJOR_ECONOMIC_INDICATORS_URL}")
    print(f"rows fetched: {len(rows)}")
    print(f"indicators usable: {sum(1 for item in taiwan_indicators.values() if item['status'] in {'ok', 'partial'})}")
    for indicator_id, indicator in taiwan_indicators.items():
        print(
            f"- {indicator_id}: field={indicator['sourceSeriesId']} "
            f"period={indicator['period']} level={indicator['level']}"
        )

    if args.dry_run:
        print("dry run: output not written")
        return 0

    write_json(output_path, merged)
    print(f"output path: {relative_path(output_path)}")
    print(f"output file size: {output_path.stat().st_size} bytes")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Taiwan CPI/PPI/unemployment and merge them into macro-indicators.json.",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_MACRO_PATH,
        help="Existing macro-indicators.json to merge with.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_MACRO_PATH,
        help="Merged output path. Defaults to public/data/macro/macro-indicators.json.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Fetch and print without writing JSON.")
    return parser.parse_args()


def fetch_taiwan_macro_rows() -> list[dict[str, Any]]:
    request = urllib.request.Request(
        TAIWAN_MAJOR_ECONOMIC_INDICATORS_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "investment-portfolio-taiwan-macro-updater/1.0",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Taiwan macro source returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Taiwan macro source request failed: {exc.reason}") from exc

    parsed = json.loads(body.decode("utf-8-sig"))
    if not isinstance(parsed, list):
        raise ValueError("Taiwan macro source response was not a JSON array.")
    return [row for row in parsed if isinstance(row, dict)]


def read_existing_macro_payload(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Existing macro indicator file not found: {path}")
    parsed = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(parsed, dict):
        raise ValueError("Existing macro indicator file was not a JSON object.")
    return parsed


def build_taiwan_indicators(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    indicators: dict[str, dict[str, Any]] = {}

    for definition in TAIWAN_INDICATORS:
        observations = parse_indicator_observations(rows, definition.source_field)
        enriched = enrich_observations(observations, definition.calculation)
        latest = enriched[-1] if enriched else None
        history = enriched[-HISTORY_LIMIT:]
        status = "unavailable"
        if latest and latest["level"] is not None:
            status = "ok"
            if latest["mom"] is None or latest["yoy"] is None:
                status = "partial"

        indicators[definition.indicator_id] = {
            "country": "TW",
            "category": definition.category,
            "name": definition.name,
            "source": "data.gov.tw / DGBAS",
            "sourceSeriesId": definition.source_field,
            "period": latest["period"] if latest else None,
            "level": latest["level"] if latest else None,
            "mom": latest["mom"] if latest else None,
            "yoy": latest["yoy"] if latest else None,
            "unit": definition.unit,
            "changeUnit": definition.change_unit,
            "frequency": "monthly",
            "calculation": definition.calculation,
            "note": definition.note,
            "status": status,
            "history": history,
        }

    return indicators


def parse_indicator_observations(
    rows: list[dict[str, Any]],
    source_field: str,
) -> list[dict[str, Any]]:
    observations: list[dict[str, Any]] = []
    for row in rows:
        period = parse_period(row.get(DATE_FIELD))
        if not period:
            continue
        level = parse_number(row.get(source_field))
        if level is None:
            continue
        observations.append({"period": period, "level": level})

    deduped = {item["period"]: item for item in observations}
    return [deduped[period] for period in sorted(deduped)]


def parse_period(value: Any) -> str | None:
    text = str(value or "").strip()
    match = re.fullmatch(r"(\d{4})(\d{2})", text)
    if not match:
        return None
    year = int(match.group(1))
    month = int(match.group(2))
    if month < 1 or month > 12:
        return None
    return f"{year:04d}-{month:02d}"


def parse_number(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).replace(",", "").strip()
    if text in MISSING_MARKERS:
        return None

    text = re.sub(r"^[prf]\s+", "", text, flags=re.IGNORECASE).strip()
    if text in MISSING_MARKERS:
        return None

    try:
        parsed = float(text)
    except ValueError:
        return None
    return parsed


def enrich_observations(
    observations: list[dict[str, Any]],
    calculation: str,
) -> list[dict[str, Any]]:
    by_period = {item["period"]: item for item in observations}
    enriched: list[dict[str, Any]] = []

    for item in observations:
        period = item["period"]
        level = item["level"]
        previous = by_period.get(shift_month(period, -1))
        previous_year = by_period.get(shift_month(period, -12))

        if calculation == "index_change":
            mom = ratio_change(level, previous.get("level") if previous else None)
            yoy = ratio_change(level, previous_year.get("level") if previous_year else None)
        elif calculation == "percentage_point_change":
            mom = level_change(level, previous.get("level") if previous else None)
            yoy = level_change(level, previous_year.get("level") if previous_year else None)
        else:
            raise ValueError(f"Unsupported calculation mode: {calculation}")

        enriched.append({"period": period, "level": level, "mom": mom, "yoy": yoy})

    return enriched


def merge_taiwan_indicators(
    base_payload: dict[str, Any],
    taiwan_indicators: dict[str, dict[str, Any]],
    generated_at: str,
) -> dict[str, Any]:
    indicators = base_payload.get("indicators")
    if not isinstance(indicators, dict):
        raise ValueError("Base macro payload missing indicators object.")

    merged_indicators = {
        key: value
        for key, value in indicators.items()
        if not str(key).startswith("TW_")
    }
    merged_indicators.update(taiwan_indicators)

    merged = dict(base_payload)
    merged["generatedAt"] = generated_at
    merged["source"] = "BLS+DGBAS"
    merged["sourceName"] = "BLS and data.gov.tw / DGBAS static macro sources"
    merged["sourceUrl"] = "https://api.bls.gov/publicAPI/v2/timeseries/data/; " + TAIWAN_MAJOR_ECONOMIC_INDICATORS_URL
    merged["indicatorCount"] = len(merged_indicators)
    merged["historyLimit"] = HISTORY_LIMIT
    merged["indicators"] = merged_indicators
    merged["errors"] = list(base_payload.get("errors") or [])
    return merged


def validate_taiwan_indicators(indicators: dict[str, dict[str, Any]]) -> None:
    expected_ids = {definition.indicator_id for definition in TAIWAN_INDICATORS}
    if set(indicators) != expected_ids:
        raise ValueError("Taiwan macro payload does not contain the expected indicators.")
    usable = 0
    for indicator_id, indicator in indicators.items():
        history = indicator.get("history")
        if not isinstance(history, list):
            raise ValueError(f"{indicator_id}: history must be an array.")
        if len(history) > HISTORY_LIMIT:
            raise ValueError(f"{indicator_id}: history exceeds {HISTORY_LIMIT} observations.")
        if indicator.get("level") == 0:
            raise ValueError(f"{indicator_id}: refusing suspicious zero level in latest value.")
        if indicator.get("status") in {"ok", "partial"}:
            usable += 1
    if usable == 0:
        raise ValueError("Taiwan macro payload has no usable indicators.")


def validate_merged_payload(payload: dict[str, Any]) -> None:
    indicators = payload.get("indicators")
    if not isinstance(indicators, dict):
        raise ValueError("Merged macro payload missing indicators object.")
    for indicator_id in ("US_CPI", "US_CORE_CPI", "US_PPI_FINAL_DEMAND", "US_UNEMPLOYMENT_RATE"):
        if indicator_id not in indicators:
            raise ValueError(f"Merged macro payload lost existing indicator {indicator_id}.")
    expected_taiwan_ids = {definition.indicator_id for definition in TAIWAN_INDICATORS}
    for indicator_id in expected_taiwan_ids:
        if indicator_id not in indicators:
            raise ValueError(f"Merged macro payload missing Taiwan indicator {indicator_id}.")
    if "TW_CORE_CPI" in indicators:
        raise ValueError("TW_CORE_CPI is not enabled until an official source code is confirmed.")


def ratio_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous <= 0:
        return None
    return round((current / previous) - 1, 6)


def level_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    return round(current - previous, 6)


def shift_month(period: str, offset: int) -> str:
    year_text, month_text = period.split("-")
    year = int(year_text)
    month = int(month_text) + offset
    while month < 1:
        year -= 1
        month += 12
    while month > 12:
        year += 1
        month -= 12
    return f"{year:04d}-{month:02d}"


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
