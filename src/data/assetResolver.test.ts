import { describe, expect, it } from "vitest";
import type { AssetMetadata } from "../types/portfolio";
import {
  getResolvedAssetMetadata,
  searchResolvedAssets,
} from "./assetResolver";

const unit = "股" as AssetMetadata["unitLabel"];

const universeAssets: AssetMetadata[] = [
  {
    symbol: "0052",
    name: "富邦科技",
    type: "taiwan_etf",
    market: "TW",
    currency: "TWD",
    unitLabel: unit,
    priceSource: "yahoo",
    aliases: ["富邦科技 ETF"],
  },
  {
    symbol: "AMD",
    name: "Advanced Micro Devices, Inc.",
    type: "us_stock",
    market: "US",
    currency: "USD",
    unitLabel: unit,
    priceSource: "us_static",
    aliases: ["Advanced Micro Devices"],
  },
  {
    symbol: "00981A",
    name: "主動統一台股增長",
    type: "taiwan_etf",
    market: "TW",
    currency: "TWD",
    unitLabel: unit,
    priceSource: "twse",
    aliases: ["主動統一台股增長"],
  },
  {
    symbol: "SCHD",
    name: "Schwab U.S. Dividend Equity ETF",
    type: "us_etf",
    market: "US",
    currency: "USD",
    unitLabel: unit,
    priceSource: "us_static",
  },
  {
    symbol: "SUI",
    name: "Universe Duplicate Sui",
    type: "crypto",
    market: "CRYPTO",
    currency: "USD",
    unitLabel: "顆" as AssetMetadata["unitLabel"],
    priceSource: "manual",
  },
];

describe("asset resolver", () => {
  it("finds universe-only assets through search", () => {
    expect(
      searchResolvedAssets("0052", { universeAssets }).map((asset) => asset.symbol),
    ).toContain("0052");
    expect(
      searchResolvedAssets("AMD", { universeAssets }).map((asset) => asset.symbol),
    ).toContain("AMD");
    expect(
      searchResolvedAssets("SCHD", { universeAssets }).map((asset) => asset.symbol),
    ).toContain("SCHD");
    expect(
      searchResolvedAssets("00981A", { universeAssets }).map((asset) => asset.symbol),
    ).toContain("00981A");
    expect(
      searchResolvedAssets("SUI", { universeAssets }).map((asset) => asset.symbol),
    ).toContain("SUI");
  });

  it("returns built-in assets when the universe is empty or unavailable", () => {
    const results = searchResolvedAssets("AAPL", { universeAssets: [] });

    expect(results[0]?.symbol).toBe("AAPL");
    expect(results[0]?.type).toBe("us_stock");
  });

  it("lets built-in registry metadata win over universe duplicates", () => {
    const resolved = getResolvedAssetMetadata("SUI", "crypto", universeAssets);

    expect(resolved?.name).toBe("Sui");
    expect(resolved?.priceSource).toBe("coingecko");
  });

  it("dedupes by market, type, and symbol", () => {
    const results = searchResolvedAssets("SUI", { universeAssets });
    const suiMatches = results.filter(
      (asset) => asset.symbol === "SUI" && asset.type === "crypto",
    );

    expect(suiMatches).toHaveLength(1);
  });
});
