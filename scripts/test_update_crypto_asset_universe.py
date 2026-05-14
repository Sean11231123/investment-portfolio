from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from update_crypto_asset_universe import build_crypto_assets, build_payload


BINANCE_FIXTURE = {
    "symbols": [
        {
            "symbol": "BTCUSDT",
            "status": "TRADING",
            "baseAsset": "BTC",
            "quoteAsset": "USDT",
            "isSpotTradingAllowed": True,
        },
        {
            "symbol": "SUIUSDT",
            "status": "TRADING",
            "baseAsset": "SUI",
            "quoteAsset": "USDT",
            "isSpotTradingAllowed": True,
        },
        {
            "symbol": "DOGEUSDT",
            "status": "TRADING",
            "baseAsset": "DOGE",
            "quoteAsset": "USDT",
            "isSpotTradingAllowed": True,
        },
        {
            "symbol": "AVAXUSDT",
            "status": "TRADING",
            "baseAsset": "AVAX",
            "quoteAsset": "USDT",
            "isSpotTradingAllowed": True,
        },
        {
            "symbol": "ETHBTC",
            "status": "TRADING",
            "baseAsset": "ETH",
            "quoteAsset": "BTC",
            "isSpotTradingAllowed": True,
        },
        {
            "symbol": "OPUSDT",
            "status": "BREAK",
            "baseAsset": "OP",
            "quoteAsset": "USDT",
            "isSpotTradingAllowed": True,
        },
        {
            "symbol": "BTCDOWNUSDT",
            "status": "TRADING",
            "baseAsset": "BTCDOWN",
            "quoteAsset": "USDT",
            "isSpotTradingAllowed": True,
        },
        {
            "symbol": "BAD-USDT",
            "status": "TRADING",
            "baseAsset": "BAD-",
            "quoteAsset": "USDT",
            "isSpotTradingAllowed": True,
        },
    ],
}


COINGECKO_FIXTURE = [
    {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin"},
    {"id": "sui", "symbol": "sui", "name": "Sui"},
    {"id": "dogecoin", "symbol": "doge", "name": "Dogecoin"},
    {"id": "avalanche-2", "symbol": "avax", "name": "Avalanche"},
    {"id": "wrapped-avax", "symbol": "avax", "name": "Wrapped AVAX"},
]


class CryptoAssetUniverseTests(unittest.TestCase):
    def test_parses_binance_usdt_trading_pairs(self) -> None:
        assets, stats = build_crypto_assets(
            BINANCE_FIXTURE,
            COINGECKO_FIXTURE,
            {"SUI": "sui"},
        )
        by_symbol = {asset["symbol"]: asset for asset in assets}

        self.assertEqual(by_symbol["BTC"]["type"], "crypto")
        self.assertEqual(by_symbol["BTC"]["binanceSymbol"], "BTCUSDT")
        self.assertEqual(by_symbol["SUI"]["type"], "crypto")
        self.assertEqual(stats["binanceCount"], 4)

    def test_skips_non_usdt_non_trading_leveraged_and_malformed_rows(self) -> None:
        assets, stats = build_crypto_assets(BINANCE_FIXTURE, COINGECKO_FIXTURE, {})
        symbols = {asset["symbol"] for asset in assets}

        self.assertNotIn("ETH", symbols)
        self.assertNotIn("OP", symbols)
        self.assertNotIn("BTCDOWN", symbols)
        self.assertNotIn("BAD-", symbols)
        self.assertGreaterEqual(stats["skippedCount"], 4)

    def test_maps_unique_coingecko_symbols(self) -> None:
        assets, _ = build_crypto_assets(BINANCE_FIXTURE, COINGECKO_FIXTURE, {})
        by_symbol = {asset["symbol"]: asset for asset in assets}

        self.assertEqual(by_symbol["BTC"]["coingeckoId"], "bitcoin")
        self.assertEqual(by_symbol["DOGE"]["coingeckoId"], "dogecoin")
        self.assertEqual(by_symbol["DOGE"]["name"], "Dogecoin")
        self.assertEqual(by_symbol["DOGE"]["priceSource"], "coingecko")

    def test_does_not_randomly_resolve_ambiguous_symbols(self) -> None:
        assets, stats = build_crypto_assets(BINANCE_FIXTURE, COINGECKO_FIXTURE, {})
        avax = next(asset for asset in assets if asset["symbol"] == "AVAX")

        self.assertNotIn("coingeckoId", avax)
        self.assertEqual(avax["name"], "AVAX")
        self.assertEqual(avax["priceSource"], "manual")
        self.assertEqual(stats["ambiguousCount"], 1)

    def test_builtin_known_coingecko_id_wins_for_ambiguous_symbols(self) -> None:
        assets, stats = build_crypto_assets(
            BINANCE_FIXTURE,
            COINGECKO_FIXTURE,
            {"AVAX": "avalanche-2"},
        )
        avax = next(asset for asset in assets if asset["symbol"] == "AVAX")

        self.assertEqual(avax["coingeckoId"], "avalanche-2")
        self.assertEqual(avax["name"], "Avalanche")
        self.assertEqual(stats["ambiguousCount"], 0)

    def test_builds_schema_payload(self) -> None:
        assets, stats = build_crypto_assets(
            BINANCE_FIXTURE,
            COINGECKO_FIXTURE,
            {"SUI": "sui"},
        )
        payload = build_payload(
            assets,
            "2026-05-14T00:00:00Z",
            stats,
            [],
            existing_path=Path(tempfile.gettempdir()) / "missing-crypto-assets.json",
        )

        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["market"], "CRYPTO")
        self.assertEqual(payload["source"], "binance-exchangeinfo-coingecko-list")
        self.assertEqual(payload["count"], len(assets))
        self.assertEqual(payload["binanceCount"], len(assets))
        self.assertGreater(payload["coingeckoMatchedCount"], 0)
        self.assertEqual(payload["errors"], [])


if __name__ == "__main__":
    unittest.main()
