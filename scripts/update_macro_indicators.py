#!/usr/bin/env python3
"""Update static US macro indicators from the public no-key BLS API."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_PATH = ROOT / "public" / "data" / "macro" / "macro-indicators.json"
BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
HISTORY_LIMIT = 24


@dataclass(frozen=True)
class IndicatorDefinition:
    indicator_id: str
    series_id: str
    country: str
    category: str
    name: str
    unit: str
    change_unit: str
    frequency: str
    calculation: str
    note: str


INDICATORS: tuple[IndicatorDefinition, ...] = (
    IndicatorDefinition(
        indicator_id="US_CPI",
        series_id="CUSR0000SA0",
        country="US",
        category="inflation",
        name="US CPI",
        unit="index",
        change_unit="decimal_return",
        frequency="monthly",
        calculation="index_change",
        note="Seasonally adjusted CPI-U all items index.",
    ),
    IndicatorDefinition(
        indicator_id="US_CORE_CPI",
        series_id="CUSR0000SA0L1E",
        country="US",
        category="inflation",
        name="US Core CPI",
        unit="index",
        change_unit="decimal_return",
        frequency="monthly",
        calculation="index_change",
        note="Seasonally adjusted CPI-U all items less food and energy index.",
    ),
    IndicatorDefinition(
        indicator_id="US_PPI_FINAL_DEMAND",
        series_id="WPSFD4",
        country="US",
        category="inflation",
        name="US PPI Final Demand",
        unit="index",
        change_unit="decimal_return",
        frequency="monthly",
        calculation="index_change",
        note="Seasonally adjusted Producer Price Index for final demand.",
    ),
    IndicatorDefinition(
        indicator_id="US_UNEMPLOYMENT_RATE",
        series_id="LNS14000000",
        country="US",
        category="labor",
        name="US Unemployment Rate",
        unit="percent_rate",
        change_unit="percentage_point",
        frequency="monthly",
        calculation="percentage_point_change",
        note="Seasonally adjusted civilian unemployment rate.",
    ),
)


def main() -> int:
    args = parse_args()
    generated_at = utc_now_iso()
    start_year = args.start_year or datetime.now(timezone.utc).year - 4
    end_year = args.end_year or datetime.now(timezone.utc).year
    output_path = args.output

    try:
        response = fetch_bls_series([item.series_id for item in INDICATORS], start_year, end_year)
        payload = build_macro_payload(response, generated_at)
        validate_payload_for_write(payload)
    except Exception as exc:  # noqa: BLE001 - fail clearly and preserve any previous output.
        print(f"US macro indicator update failed: {exc}", file=sys.stderr)
        if output_path.exists():
            print(f"Existing output preserved: {output_path}", file=sys.stderr)
        return 1

    print("US macro indicator update report")
    print(f"source: BLS Public Data API")
    print(f"endpoint: {BLS_API_URL}")
    print(f"series requested: {len(INDICATORS)}")
    print(
        "series usable: "
        f"{sum(1 for item in payload['indicators'].values() if item['status'] in {'ok', 'partial'})}"
    )
    for indicator_id, indicator in payload["indicators"].items():
        print(
            f"- {indicator_id}: {indicator['sourceSeriesId']} "
            f"period={indicator['period']} level={indicator['level']}"
        )
    if payload["errors"]:
        print("errors:")
        for error in payload["errors"]:
            print(f"- {error}")

    if args.dry_run:
        print("dry run: output not written")
        return 0

    write_json(output_path, payload)
    print(f"output path: {output_path.relative_to(ROOT) if output_path.is_relative_to(ROOT) else output_path}")
    print(f"output file size: {output_path.stat().st_size} bytes")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch US macro indicators from the public no-key BLS API.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Output JSON path. Defaults to public/data/macro/macro-indicators.json.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Fetch and print without writing JSON.")
    parser.add_argument("--start-year", type=int, help="Optional BLS request start year.")
    parser.add_argument("--end-year", type=int, help="Optional BLS request end year.")
    return parser.parse_args()


def fetch_bls_series(series_ids: list[str], start_year: int, end_year: int) -> dict[str, Any]:
    request_body = json.dumps(
        {
            "seriesid": series_ids,
            "startyear": str(start_year),
            "endyear": str(end_year),
        },
    ).encode("utf-8")
    request = urllib.request.Request(
        BLS_API_URL,
        data=request_body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "investment-portfolio-macro-updater/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"BLS API returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"BLS API request failed: {exc.reason}") from exc

    parsed = json.loads(body.decode("utf-8-sig"))
    if not isinstance(parsed, dict):
        raise ValueError("BLS API response was not a JSON object.")
    if parsed.get("status") != "REQUEST_SUCCEEDED":
        messages = parsed.get("message")
        raise ValueError(f"BLS API request did not succeed: {messages!r}")
    return parsed


def build_macro_payload(response: dict[str, Any], generated_at: str) -> dict[str, Any]:
    series = response.get("Results", {}).get("series")
    if not isinstance(series, list):
        raise ValueError("BLS response missing Results.series array.")

    series_by_id = {
        str(item.get("seriesID", "")).strip(): item
        for item in series
        if isinstance(item, dict) and item.get("seriesID")
    }
    indicators: dict[str, dict[str, Any]] = {}
    errors: list[str] = []

    for definition in INDICATORS:
        raw_series = series_by_id.get(definition.series_id)
        if raw_series is None:
            indicators[definition.indicator_id] = unavailable_indicator(definition)
            errors.append(f"{definition.indicator_id}: BLS series not returned.")
            continue

        observations = parse_observations(raw_series.get("data"))
        if not observations:
            indicators[definition.indicator_id] = unavailable_indicator(definition)
            errors.append(f"{definition.indicator_id}: no valid numeric monthly observations.")
            continue

        enriched = enrich_observations(observations, definition.calculation)
        latest = enriched[-1]
        history = enriched[-HISTORY_LIMIT:]
        status = "ok" if latest["level"] is not None else "unavailable"
        if latest["mom"] is None or latest["yoy"] is None:
            status = "partial" if latest["level"] is not None else "unavailable"

        indicators[definition.indicator_id] = {
            "country": definition.country,
            "category": definition.category,
            "name": definition.name,
            "source": "BLS",
            "sourceSeriesId": definition.series_id,
            "period": latest["period"],
            "level": latest["level"],
            "mom": latest["mom"],
            "yoy": latest["yoy"],
            "unit": definition.unit,
            "changeUnit": definition.change_unit,
            "frequency": definition.frequency,
            "calculation": definition.calculation,
            "note": definition.note,
            "status": status,
            "history": history,
        }

    return {
        "version": 1,
        "generatedAt": generated_at,
        "source": "BLS",
        "sourceName": "U.S. Bureau of Labor Statistics Public Data API",
        "sourceUrl": BLS_API_URL,
        "indicatorCount": len(indicators),
        "historyLimit": HISTORY_LIMIT,
        "indicators": indicators,
        "errors": errors,
    }


def parse_observations(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, list):
        return []

    observations: list[dict[str, Any]] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        period = str(row.get("period", "")).strip()
        year = str(row.get("year", "")).strip()
        if not period.startswith("M") or len(period) != 3:
            continue
        month_text = period[1:]
        if not year.isdigit() or not month_text.isdigit():
            continue
        month = int(month_text)
        if month < 1 or month > 12:
            continue
        value = parse_number(row.get("value"))
        if value is None:
            continue
        observations.append(
            {
                "period": f"{int(year):04d}-{month:02d}",
                "level": value,
            },
        )

    observations.sort(key=lambda item: item["period"])
    deduped: dict[str, dict[str, Any]] = {item["period"]: item for item in observations}
    return [deduped[period] for period in sorted(deduped)]


def enrich_observations(observations: list[dict[str, Any]], calculation: str) -> list[dict[str, Any]]:
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

        enriched.append(
            {
                "period": period,
                "level": level,
                "mom": mom,
                "yoy": yoy,
            },
        )

    return enriched


def unavailable_indicator(definition: IndicatorDefinition) -> dict[str, Any]:
    return {
        "country": definition.country,
        "category": definition.category,
        "name": definition.name,
        "source": "BLS",
        "sourceSeriesId": definition.series_id,
        "period": None,
        "level": None,
        "mom": None,
        "yoy": None,
        "unit": definition.unit,
        "changeUnit": definition.change_unit,
        "frequency": definition.frequency,
        "calculation": definition.calculation,
        "note": definition.note,
        "status": "unavailable",
        "history": [],
    }


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


def parse_number(value: Any) -> float | None:
    if value is None:
        return None
    normalized = str(value).replace(",", "").strip()
    if not normalized or normalized in {".", "--", "-", "N/A", "NA", "null"}:
        return None
    try:
        parsed = float(normalized)
    except ValueError:
        return None
    return parsed


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


def validate_payload_for_write(payload: dict[str, Any]) -> None:
    indicators = payload.get("indicators")
    if not isinstance(indicators, dict):
        raise ValueError("macro payload missing indicators object.")
    expected_ids = {item.indicator_id for item in INDICATORS}
    if set(indicators) != expected_ids:
        raise ValueError("macro payload does not contain the expected indicator set.")
    ok_count = sum(
        1
        for indicator in indicators.values()
        if isinstance(indicator, dict) and indicator.get("status") in {"ok", "partial"}
    )
    if ok_count == 0:
        raise ValueError("macro payload has no usable indicators; refusing to overwrite output.")
    for indicator_id, indicator in indicators.items():
        if not isinstance(indicator, dict):
            raise ValueError(f"{indicator_id}: indicator must be an object.")
        history = indicator.get("history")
        if not isinstance(history, list):
            raise ValueError(f"{indicator_id}: history must be an array.")
        if len(history) > HISTORY_LIMIT:
            raise ValueError(f"{indicator_id}: history exceeds {HISTORY_LIMIT} observations.")
        if indicator.get("level") == 0:
            raise ValueError(f"{indicator_id}: refusing suspicious zero level in latest value.")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
