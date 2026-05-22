#!/usr/bin/env python3
"""Update static FOMC event metadata from official Federal Reserve pages."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_PATH = ROOT / "public" / "data" / "macro" / "macro-events.json"
FOMC_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
SOURCE_NAME = "Federal Reserve"
EVENT_TYPE = "FOMC"
MONTHS = {
    "January": 1,
    "February": 2,
    "March": 3,
    "April": 4,
    "May": 5,
    "June": 6,
    "July": 7,
    "August": 8,
    "September": 9,
    "October": 10,
    "November": 11,
    "December": 12,
}
MONTH_ALIASES = {
    "Jan": "January",
    "Feb": "February",
    "Mar": "March",
    "Apr": "April",
    "Jun": "June",
    "Jul": "July",
    "Aug": "August",
    "Sep": "September",
    "Sept": "September",
    "Oct": "October",
    "Nov": "November",
    "Dec": "December",
}


@dataclass(frozen=True)
class Token:
    kind: str
    text: str
    href: str | None = None


class FomcCalendarParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tokens: list[Token] = []
        self._current_href: str | None = None
        self._anchor_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            href = dict(attrs).get("href")
            self._current_href = href or ""
            self._anchor_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._current_href is not None:
            text = normalize_space(" ".join(self._anchor_text))
            if text:
                self.tokens.append(Token("link", text, absolute_url(self._current_href)))
            self._current_href = None
            self._anchor_text = []

    def handle_data(self, data: str) -> None:
        parts = [normalize_space(part) for part in data.splitlines()]
        for text in parts:
            if not text:
                continue
            if self._current_href is not None:
                self._anchor_text.append(text)
                continue
            self.tokens.append(Token("text", text))


def main() -> int:
    args = parse_args()
    generated_at = utc_now_iso()
    output_path = args.output

    try:
        calendar_html = fetch_text(FOMC_CALENDAR_URL)
        events, parse_errors = parse_calendar_html(calendar_html, generated_at, today=date.today())
        rate_errors = attach_rate_decisions(events, fetch_targets=not args.skip_rate_fetch)
        payload = build_payload(events, generated_at, parse_errors + rate_errors)
        validate_payload_for_write(payload)
    except Exception as exc:  # noqa: BLE001 - preserve any previous valid output.
        print(f"FOMC event update failed: {exc}", file=sys.stderr)
        if output_path.exists():
            print(f"Existing output preserved: {output_path}", file=sys.stderr)
        return 1

    print_summary(payload)
    if args.dry_run:
        print("dry run: output not written")
        return 0

    write_json(output_path, payload)
    print(f"output path: {relative_to_root(output_path)}")
    print(f"output file size: {output_path.stat().st_size} bytes")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch FOMC calendar/event metadata from official Federal Reserve pages.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Output JSON path. Defaults to public/data/macro/macro-events.json.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Fetch and print without writing JSON.")
    parser.add_argument(
        "--skip-rate-fetch",
        action="store_true",
        help="Do not fetch implementation-note pages for target range parsing.",
    )
    return parser.parse_args()


def fetch_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "investment-portfolio-fomc-event-updater/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read().decode("utf-8-sig", errors="replace")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Federal Reserve returned HTTP {exc.code}: {url}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Federal Reserve request failed: {exc.reason}") from exc


def parse_calendar_html(
    calendar_html: str,
    generated_at: str,
    today: date,
) -> tuple[list[dict[str, Any]], list[str]]:
    parser = FomcCalendarParser()
    parser.feed(calendar_html)
    tokens = parser.tokens
    events: list[dict[str, Any]] = []
    errors: list[str] = []
    current_year: int | None = None
    current_month_label: str | None = None
    current_event: dict[str, Any] | None = None
    context = ""
    min_year = today.year - 2
    max_year = today.year + 1

    for token in tokens:
        text = normalize_space(token.text)
        year_match = re.fullmatch(r"(\d{4}) FOMC Meetings", text)
        if year_match:
            current_year = int(year_match.group(1))
            current_month_label = None
            current_event = None
            context = ""
            continue

        if current_year is None:
            continue

        month_label = normalize_month_label(text)
        if month_label:
            current_month_label = month_label
            current_event = None
            context = ""
            continue

        if current_month_label:
            event_dates = parse_meeting_dates(current_year, current_month_label, text)
            if event_dates:
                start_date, end_date, has_sep = event_dates
                current_event = new_event(start_date, end_date, has_sep, generated_at)
                if min_year <= int(start_date[:4]) <= max_year:
                    events.append(current_event)
                else:
                    current_event = None
                context = ""
                continue

        if current_event is None:
            continue

        if token.kind == "text":
            lowered = text.lower()
            if lowered.startswith("statement"):
                context = "statement"
            elif lowered.startswith("minutes"):
                context = "minutes"
            elif "projection materials" in lowered:
                context = "sep"
            elif lowered.startswith("(released"):
                current_event["minutesReleaseDate"] = parse_release_date(text)
            elif "press conference" in lowered:
                context = "pressConference"
            continue

        if token.kind == "link":
            assign_event_link(current_event, context, text, token.href)

    events.sort(key=lambda event: str(event["decisionDate"]))
    for event in events:
        event["id"] = f"FOMC_{str(event['decisionDate']).replace('-', '_')}"
        event["status"] = determine_status(event, today)
        event["title"] = "FOMC Meeting"
        event["sourceUrl"] = FOMC_CALENDAR_URL
        ensure_links_shape(event)

    if not events:
        errors.append("No FOMC events parsed from calendar page.")
    return events, errors


def new_event(start_date: str, end_date: str, has_sep: bool, generated_at: str) -> dict[str, Any]:
    return {
        "id": "",
        "country": "US",
        "type": EVENT_TYPE,
        "title": "FOMC Meeting",
        "startDate": start_date,
        "endDate": end_date,
        "decisionDate": end_date,
        "status": "upcoming",
        "hasSep": has_sep,
        "minutesReleaseDate": None,
        "rateDecision": unavailable_rate_decision(),
        "links": {
            "statement": None,
            "implementationNote": None,
            "minutes": None,
            "pressConference": None,
            "sep": None,
        },
        "source": SOURCE_NAME,
        "sourceUrl": FOMC_CALENDAR_URL,
        "lastUpdated": generated_at,
    }


def assign_event_link(event: dict[str, Any], context: str, text: str, href: str | None) -> None:
    if href is None:
        return
    lowered = text.lower()
    if "implementation note" in lowered:
        event["links"]["implementationNote"] = href
    elif "press conference" in lowered:
        event["links"]["pressConference"] = href
    elif "html" in lowered and context == "statement":
        event["links"]["statement"] = href
    elif "html" in lowered and context == "minutes":
        event["links"]["minutes"] = href
    elif "html" in lowered and context == "sep":
        event["links"]["sep"] = href


def attach_rate_decisions(events: list[dict[str, Any]], fetch_targets: bool = True) -> list[str]:
    errors: list[str] = []
    previous_decision: dict[str, Any] | None = None
    for event in events:
        implementation_note_url = event.get("links", {}).get("implementationNote")
        if fetch_targets and implementation_note_url:
            try:
                note_html = fetch_text(str(implementation_note_url))
                parsed = parse_target_range(note_html)
                if parsed:
                    lower, upper = parsed
                    event["rateDecision"] = {
                        "available": True,
                        "targetRangeLower": lower,
                        "targetRangeUpper": upper,
                        "changeBps": None,
                        "unit": "%",
                    }
                else:
                    errors.append(f"{event['id'] or event['decisionDate']}: target range not found.")
            except Exception as exc:  # noqa: BLE001 - keep event metadata even if rate parsing fails.
                errors.append(f"{event['id'] or event['decisionDate']}: target range fetch failed: {exc}")

        if event["rateDecision"]["available"] and previous_decision:
            event["rateDecision"]["changeBps"] = calculate_change_bps(previous_decision, event["rateDecision"])
        if event["rateDecision"]["available"]:
            previous_decision = event["rateDecision"]
    return errors


def build_payload(events: list[dict[str, Any]], generated_at: str, errors: list[str]) -> dict[str, Any]:
    return {
        "version": 1,
        "generatedAt": generated_at,
        "source": SOURCE_NAME,
        "sourceUrl": FOMC_CALENDAR_URL,
        "eventCount": len(events),
        "events": events,
        "errors": errors,
    }


def parse_target_range(page_html: str) -> tuple[float, float] | None:
    text = html.unescape(re.sub(r"<[^>]+>", " ", page_html))
    text = normalize_hyphens(normalize_space(text))
    patterns = [
        r"target range of\s+([0-9][0-9./ -]*?)\s+to\s+([0-9][0-9./ -]*?)\s+percent",
        r"target range for the federal funds rate at\s+([0-9][0-9./ -]*?)\s+to\s+([0-9][0-9./ -]*?)\s+percent",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if not match:
            continue
        lower = parse_rate_value(match.group(1))
        upper = parse_rate_value(match.group(2))
        if lower is not None and upper is not None and upper >= lower:
            return lower, upper
    return None


def parse_rate_value(value: str) -> float | None:
    normalized = normalize_hyphens(normalize_space(value))
    normalized = normalized.strip(" .,%")
    fraction_match = re.fullmatch(r"(\d+)-(\d+)/(\d+)", normalized)
    if fraction_match:
        whole = int(fraction_match.group(1))
        numerator = int(fraction_match.group(2))
        denominator = int(fraction_match.group(3))
        return round(whole + numerator / denominator, 4) if denominator else None
    simple_fraction = re.fullmatch(r"(\d+)/(\d+)", normalized)
    if simple_fraction:
        numerator = int(simple_fraction.group(1))
        denominator = int(simple_fraction.group(2))
        return round(numerator / denominator, 4) if denominator else None
    try:
        return round(float(normalized), 4)
    except ValueError:
        return None


def calculate_change_bps(previous: dict[str, Any], current: dict[str, Any]) -> int | None:
    if not previous.get("available") or not current.get("available"):
        return None
    previous_mid = (float(previous["targetRangeLower"]) + float(previous["targetRangeUpper"])) / 2
    current_mid = (float(current["targetRangeLower"]) + float(current["targetRangeUpper"])) / 2
    return int(round((current_mid - previous_mid) * 100))


def parse_meeting_dates(year: int, month_label: str, text: str) -> tuple[str, str, bool] | None:
    if "notation vote" in text.lower():
        return None
    match = re.fullmatch(r"(\d{1,2})(?:-(\d{1,2}))?(\*)?(?:\s+\(notation vote\))?", text)
    if not match:
        return None
    start_day = int(match.group(1))
    end_day = int(match.group(2) or match.group(1))
    has_sep = bool(match.group(3))
    start_month_label, end_month_label = split_month_label(month_label)
    start_month = MONTHS[start_month_label]
    end_month = MONTHS[end_month_label]
    start_year = year
    end_year = year
    if end_month < start_month:
        end_year += 1
    return (
        f"{start_year:04d}-{start_month:02d}-{start_day:02d}",
        f"{end_year:04d}-{end_month:02d}-{end_day:02d}",
        has_sep,
    )


def parse_release_date(text: str) -> str | None:
    match = re.search(r"Released\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})", text)
    if not match:
        return None
    month = MONTHS.get(match.group(1))
    if not month:
        return None
    return f"{int(match.group(3)):04d}-{month:02d}-{int(match.group(2)):02d}"


def determine_status(event: dict[str, Any], today: date) -> str:
    decision = date.fromisoformat(str(event["decisionDate"]))
    links = event.get("links", {})
    if decision > today and not links.get("statement"):
        return "upcoming"
    if links.get("statement") and links.get("minutes"):
        return "complete"
    if links.get("statement") and not links.get("minutes"):
        return "minutes_pending"
    return "released" if links.get("statement") else "upcoming"


def normalize_month_label(text: str) -> str | None:
    if "/" in text:
        parts = text.split("/")
        if len(parts) == 2:
            left = expand_month(parts[0])
            right = expand_month(parts[1])
            if left and right:
                return f"{left}/{right}"
    return expand_month(text)


def expand_month(value: str) -> str | None:
    stripped = value.strip()
    if stripped in MONTHS:
        return stripped
    return MONTH_ALIASES.get(stripped)


def split_month_label(month_label: str) -> tuple[str, str]:
    if "/" not in month_label:
        return month_label, month_label
    left, right = month_label.split("/", 1)
    return left, right


def unavailable_rate_decision() -> dict[str, Any]:
    return {
        "available": False,
        "targetRangeLower": None,
        "targetRangeUpper": None,
        "changeBps": None,
        "unit": "%",
    }


def ensure_links_shape(event: dict[str, Any]) -> None:
    links = event.setdefault("links", {})
    for key in ["statement", "implementationNote", "minutes", "pressConference", "sep"]:
        links.setdefault(key, None)


def validate_payload_for_write(payload: dict[str, Any]) -> None:
    events = payload.get("events")
    if not isinstance(events, list) or not events:
        raise ValueError("macro events payload has no events; refusing to overwrite output.")
    seen: set[str] = set()
    for event in events:
        if not isinstance(event, dict):
            raise ValueError("macro event must be an object.")
        event_id = str(event.get("id", ""))
        if not event_id or event_id in seen:
            raise ValueError(f"invalid or duplicate event id: {event_id!r}")
        seen.add(event_id)
        if event.get("type") != EVENT_TYPE:
            raise ValueError(f"{event_id}: unexpected event type.")
        rate_decision = event.get("rateDecision")
        if not isinstance(rate_decision, dict):
            raise ValueError(f"{event_id}: missing rateDecision object.")
        if rate_decision.get("targetRangeLower") == 0 or rate_decision.get("targetRangeUpper") == 0:
            raise ValueError(f"{event_id}: refusing suspicious zero rate target.")
        for forbidden in ["summary", "sentiment", "marketPrediction", "recommendation"]:
            if forbidden in event:
                raise ValueError(f"{event_id}: forbidden summary/prediction field {forbidden}.")


def print_summary(payload: dict[str, Any]) -> None:
    events = payload["events"]
    upcoming = sum(1 for event in events if event["status"] == "upcoming")
    released_or_complete = sum(1 for event in events if event["status"] in {"released", "minutes_pending", "complete"})
    statement_count = sum(1 for event in events if event["links"].get("statement"))
    minutes_count = sum(1 for event in events if event["links"].get("minutes"))
    rate_count = sum(1 for event in events if event["rateDecision"].get("available"))

    print("FOMC event update report")
    print(f"source: {SOURCE_NAME}")
    print(f"calendar endpoint: {FOMC_CALENDAR_URL}")
    print(f"events parsed: {len(events)}")
    print(f"upcoming events: {upcoming}")
    print(f"released/complete events: {released_or_complete}")
    print(f"events with statement links: {statement_count}")
    print(f"events with minutes links: {minutes_count}")
    print(f"events with rate decisions: {rate_count}")
    if payload["errors"]:
        print("errors:")
        for error in payload["errors"]:
            print(f"- {error}")
def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


def absolute_url(href: str) -> str:
    return urllib.parse.urljoin(FOMC_CALENDAR_URL, href)


def normalize_space(value: str) -> str:
    return " ".join(html.unescape(value).split())


def normalize_hyphens(value: str) -> str:
    return re.sub(r"[\u2010-\u2015\u2212]", "-", value)


def relative_to_root(path: Path) -> Path | str:
    try:
        return path.relative_to(ROOT)
    except ValueError:
        return path


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
