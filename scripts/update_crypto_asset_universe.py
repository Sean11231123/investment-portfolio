from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "public" / "data" / "universe" / "crypto-assets.json"
ASSET_REGISTRY_PATH = ROOT / "src" / "data" / "assetRegistry.ts"
SOURCE_NAME = "binance-exchangeinfo-coingecko-list"
BINANCE_EXCHANGE_INFO_URLS = [
    "https://api.binance.com/api/v3/exchangeInfo",
    "https://data-api.binance.vision/api/v3/exchangeInfo",
]
COINGECKO_COINS_LIST_URL = "https://api.coingecko.com/api/v3/coins/list"

LEVERAGED_SUFFIXES = ("DOWN", "BULL", "BEAR")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the crypto searchable asset universe from Binance and CoinGecko.",
    )
    parser.add_argument("--binance", type=Path, help="Fixture Binance exchangeInfo JSON path.")
    parser.add_argument("--coingecko", type=Path, help="Fixture CoinGecko coins/list JSON path.")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    try:
        binance_data = (
            json.loads(args.binance.read_text(encoding="utf-8"))
            if args.binance
            else fetch_first_json(BINANCE_EXCHANGE_INFO_URLS)
        )
        coingecko_data = (
            json.loads(args.coingecko.read_text(encoding="utf-8"))
            if args.coingecko
            else fetch_json(COINGECKO_COINS_LIST_URL)
        )
        known_ids = load_builtin_coingecko_ids()
        assets, stats = build_crypto_assets(binance_data, coingecko_data, known_ids)
    except Exception as exc:  # noqa: BLE001 - preserve the last good universe file.
        return report_failure(args.output, [f"Crypto universe fetch/parse failed: {exc}"])

    if not assets:
        return report_failure(args.output, ["Crypto universe parse produced no target assets."])

    payload = build_payload(
        assets=assets,
        generated_at=generated_at,
        stats=stats,
        errors=[],
        existing_path=args.output,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"source: {SOURCE_NAME}")
    print(f"assets generated: {len(assets)}")
    print(f"binance USDT pairs: {stats['binanceCount']}")
    print(f"coingecko matched: {stats['coingeckoMatchedCount']}")
    print(f"ambiguous symbols: {stats['ambiguousCount']}")
    print(f"skipped: {stats['skippedCount']}")
    print(f"output path: {args.output}")
    return 0


def fetch_first_json(urls: list[str]) -> Any:
    errors: list[str] = []
    for url in urls:
        try:
            return fetch_json(url)
        except RuntimeError as exc:
            errors.append(str(exc))
    raise RuntimeError("; ".join(errors))


def fetch_json(url: str) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "investment-portfolio-crypto-universe-updater/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8-sig"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"{url} returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{url}: {exc.reason}") from exc


def build_crypto_assets(
    binance_exchange_info: Any,
    coingecko_coins: Any,
    known_coingecko_ids: dict[str, str] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    known_ids = known_coingecko_ids or {}
    coin_candidates = build_coingecko_candidates(coingecko_coins)
    symbols = binance_exchange_info.get("symbols") if isinstance(binance_exchange_info, dict) else None
    if not isinstance(symbols, list):
        raise ValueError("Binance exchangeInfo must contain a symbols array.")

    assets: list[dict[str, Any]] = []
    seen_base_assets: set[str] = set()
    skipped_count = 0
    matched_count = 0
    ambiguous_count = 0

    for row in symbols:
        if not isinstance(row, dict):
            skipped_count += 1
            continue

        parsed = parse_binance_symbol(row)
        if parsed is None:
            skipped_count += 1
            continue

        base_asset, pair_symbol = parsed
        if base_asset in seen_base_assets:
            skipped_count += 1
            continue
        seen_base_assets.add(base_asset)

        match = resolve_coingecko_match(base_asset, coin_candidates, known_ids)
        if match["ambiguous"]:
            ambiguous_count += 1
        if match["id"]:
            matched_count += 1

        name = match["name"] or base_asset
        assets.append(
            {
                "symbol": base_asset,
                "name": name,
                "type": "crypto",
                "market": "CRYPTO",
                "currency": "USDT",
                "unitLabel": "顆",
                "priceSource": "coingecko" if match["id"] else "manual",
                "aliases": [name],
                "exchange": "BINANCE",
                "source": "binance-exchangeinfo",
                "sourceSymbol": pair_symbol,
                "binanceSymbol": pair_symbol,
                **({"coingeckoId": match["id"]} if match["id"] else {}),
                "dataQuality": "generated",
            },
        )

    stats = {
        "binanceCount": len(assets),
        "coingeckoMatchedCount": matched_count,
        "ambiguousCount": ambiguous_count,
        "skippedCount": skipped_count,
    }
    return sorted(assets, key=lambda asset: asset["symbol"]), stats


def parse_binance_symbol(row: dict[str, Any]) -> tuple[str, str] | None:
    if str(row.get("status", "")).upper() != "TRADING":
        return None
    if str(row.get("quoteAsset", "")).upper() != "USDT":
        return None
    if row.get("isSpotTradingAllowed") is False:
        return None

    base_asset = normalize_symbol(row.get("baseAsset"))
    pair_symbol = normalize_symbol(row.get("symbol"))
    if not base_asset or not pair_symbol:
        return None
    if not re.fullmatch(r"[A-Z0-9]{2,20}", base_asset):
        return None
    if pair_symbol != f"{base_asset}USDT":
        return None
    if is_leveraged_token(base_asset):
        return None
    return base_asset, pair_symbol


def build_coingecko_candidates(coingecko_coins: Any) -> dict[str, list[dict[str, str]]]:
    if not isinstance(coingecko_coins, list):
        raise ValueError("CoinGecko coins list must be an array.")

    candidates: dict[str, list[dict[str, str]]] = {}
    for item in coingecko_coins:
        if not isinstance(item, dict):
            continue
        symbol = str(item.get("symbol", "")).strip().lower()
        coin_id = str(item.get("id", "")).strip()
        name = str(item.get("name", "")).strip()
        if not symbol or not coin_id or not name:
            continue
        candidates.setdefault(symbol, []).append({"id": coin_id, "name": name})
    return candidates


def resolve_coingecko_match(
    symbol: str,
    candidates_by_symbol: dict[str, list[dict[str, str]]],
    known_ids: dict[str, str],
) -> dict[str, str | bool | None]:
    candidates = candidates_by_symbol.get(symbol.lower(), [])
    if len(candidates) == 1:
        return {"id": candidates[0]["id"], "name": candidates[0]["name"], "ambiguous": False}

    if len(candidates) > 1:
        known_id = known_ids.get(symbol)
        if known_id:
            match = next((item for item in candidates if item["id"] == known_id), None)
            if match:
                return {"id": match["id"], "name": match["name"], "ambiguous": False}
        return {"id": None, "name": None, "ambiguous": True}

    return {"id": None, "name": None, "ambiguous": False}


def load_builtin_coingecko_ids(path: Path = ASSET_REGISTRY_PATH) -> dict[str, str]:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return {}

    mappings: dict[str, str] = {}
    for block in re.findall(r"\{[^{}]*coingeckoId:\s*\"[^\"]+\"[^{}]*\}", text, flags=re.S):
        symbol_match = re.search(r"symbol:\s*\"([^\"]+)\"", block)
        id_match = re.search(r"coingeckoId:\s*\"([^\"]+)\"", block)
        if symbol_match and id_match:
            mappings[normalize_symbol(symbol_match.group(1))] = id_match.group(1)
    return mappings


def build_payload(
    assets: list[dict[str, Any]],
    generated_at: str,
    stats: dict[str, int],
    errors: list[str],
    existing_path: Path = OUTPUT_PATH,
) -> dict[str, Any]:
    payload = {
        "version": 1,
        "market": "CRYPTO",
        "source": SOURCE_NAME,
        "generatedAt": generated_at,
        "count": len(assets),
        "binanceCount": stats["binanceCount"],
        "coingeckoMatchedCount": stats["coingeckoMatchedCount"],
        "ambiguousCount": stats["ambiguousCount"],
        "skippedCount": stats["skippedCount"],
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


def normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def is_leveraged_token(base_asset: str) -> bool:
    if base_asset.endswith("UP") and len(base_asset) > 4:
        return True
    return any(base_asset.endswith(suffix) for suffix in LEVERAGED_SUFFIXES)


def report_failure(output_path: Path, errors: list[str]) -> int:
    print(f"source: {SOURCE_NAME}")
    print("assets generated: 0")
    print("binance USDT pairs: 0")
    print("coingecko matched: 0")
    print("ambiguous symbols: 0")
    print("skipped: 0")
    print(f"output path preserved: {output_path}")
    print("errors:")
    for error in errors:
        print(f"- {error}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
