from __future__ import annotations

import json
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data" / "etf-components"
INDEX_PATH = DATA_DIR / "index.json"
ALLOWED_DATA_QUALITY = {"sample", "manual", "verified", "stale"}
WEIGHT_TOLERANCE = 0.000001
STALE_DAYS = 120


def main() -> int:
    warnings: list[str] = []
    errors: list[str] = []
    checked: list[tuple[str, int, float]] = []

    index = read_json(INDEX_PATH, errors)
    datasets = validate_index(index, errors)

    for dataset_name in datasets:
        path = DATA_DIR / dataset_name
        data = read_json(path, errors)
        if data is None:
            continue

        result = validate_dataset(path, data)
        errors.extend(result.errors)
        warnings.extend(result.warnings)
        if result.symbol:
            checked.append((result.symbol, result.component_count, result.total_weight))

    print("ETF component validation report")
    print(f"ETF files checked: {len(checked)}")
    for symbol, component_count, total_weight in checked:
        print(f"- {symbol}: components={component_count}, totalWeight={total_weight:.6f}")

    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"- {warning}")

    if errors:
        print("Errors:")
        for error in errors:
            print(f"- {error}")
        print("Final: FAIL")
        return 1

    print("Final: PASS")
    return 0


class ValidationResult:
    def __init__(self) -> None:
        self.symbol = ""
        self.component_count = 0
        self.total_weight = 0.0
        self.warnings: list[str] = []
        self.errors: list[str] = []


def read_json(path: Path, errors: list[str]) -> Any | None:
    if not path.exists():
        errors.append(f"missing file: {relative(path)}")
        return None

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"invalid JSON in {relative(path)}: {exc}")
        return None


def validate_index(index: Any | None, errors: list[str]) -> list[str]:
    if index is None:
        return []

    if not isinstance(index, dict):
        errors.append("index.json must be an object")
        return []

    if index.get("version") != 1:
        errors.append("index.json version must be 1")

    datasets = index.get("datasets")
    if not isinstance(datasets, list) or not datasets:
        errors.append("index.json datasets must be a non-empty array")
        return []

    valid_names: list[str] = []
    seen: set[str] = set()
    for item in datasets:
        if not isinstance(item, str) or not item.strip():
            errors.append("index.json datasets entries must be non-empty strings")
            continue
        name = item.strip()
        if name in seen:
            errors.append(f"duplicate dataset in index.json: {name}")
        seen.add(name)
        valid_names.append(name)

    return valid_names


def validate_dataset(path: Path, data: Any) -> ValidationResult:
    result = ValidationResult()
    label = relative(path)

    if not isinstance(data, dict):
        result.errors.append(f"{label}: dataset must be an object")
        return result

    symbol = string_field(data, "symbol")
    name = string_field(data, "name")
    last_updated = string_field(data, "lastUpdated")
    data_quality = string_field(data, "dataQuality")
    components = data.get("components")
    component_count = data.get("componentCount")
    total_weight = data.get("totalWeight")

    result.symbol = symbol or path.stem

    if data.get("version") != 1:
        result.errors.append(f"{label}: version must be 1")
    if not symbol:
        result.errors.append(f"{label}: symbol is required")
    if not name:
        result.errors.append(f"{label}: name is required")
    if data.get("market") != "TW":
        result.errors.append(f"{label}: market must be TW")
    if not is_valid_date(last_updated):
        result.errors.append(f"{label}: lastUpdated must be a valid YYYY-MM-DD date")
    if data_quality not in ALLOWED_DATA_QUALITY:
        result.errors.append(
            f"{label}: dataQuality must be one of {sorted(ALLOWED_DATA_QUALITY)}",
        )
    if data_quality == "sample":
        result.warnings.append(f"{symbol}: dataQuality is sample")
    if is_old(last_updated):
        result.warnings.append(f"{symbol}: lastUpdated may be stale ({last_updated})")

    if not isinstance(components, list) or not components:
        result.errors.append(f"{label}: components must be a non-empty array")
        return result

    if not isinstance(component_count, int):
        result.errors.append(f"{label}: componentCount must be an integer")
    elif component_count != len(components):
        result.errors.append(
            f"{label}: componentCount {component_count} != components.length {len(components)}",
        )

    if not is_number(total_weight):
        result.errors.append(f"{label}: totalWeight must be a number")
        declared_total = 0.0
    else:
        declared_total = float(total_weight)
        result.total_weight = declared_total

    seen_symbols: set[str] = set()
    calculated_total = 0.0
    for index, component in enumerate(components):
        component_label = f"{label}: components[{index}]"
        if not isinstance(component, dict):
            result.errors.append(f"{component_label} must be an object")
            continue

        component_symbol = string_field(component, "symbol")
        component_name = string_field(component, "name")
        weight = component.get("weight")

        if not component_symbol:
            result.errors.append(f"{component_label}.symbol is required")
        elif component_symbol in seen_symbols:
            result.errors.append(f"{label}: duplicate component symbol {component_symbol}")
        seen_symbols.add(component_symbol)

        if not component_name:
            result.errors.append(f"{component_label}.name is required")

        if not is_number(weight):
            result.errors.append(f"{component_label}.weight must be a number")
            continue

        numeric_weight = float(weight)
        if numeric_weight <= 0:
            result.errors.append(f"{component_label}.weight must be > 0")
        if numeric_weight > 1:
            result.errors.append(f"{component_label}.weight must be <= 1")
        calculated_total += numeric_weight

    result.component_count = len(components)
    if abs(declared_total - calculated_total) > WEIGHT_TOLERANCE:
        result.errors.append(
            f"{label}: totalWeight {declared_total:.6f} does not match component sum {calculated_total:.6f}",
        )
    if declared_total > 1.01:
        result.errors.append(f"{label}: totalWeight must not exceed 1.01")
    if declared_total < 0.5:
        result.warnings.append(f"{symbol}: totalWeight is below 0.5; dataset may be partial")

    return result


def string_field(data: dict[str, Any], key: str) -> str:
    value = data.get(key)
    return value.strip() if isinstance(value, str) else ""


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def is_valid_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return bool(value)


def is_old(value: str) -> bool:
    try:
        updated = date.fromisoformat(value)
    except ValueError:
        return False
    return (date.today() - updated).days > STALE_DAYS


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")


if __name__ == "__main__":
    sys.exit(main())
