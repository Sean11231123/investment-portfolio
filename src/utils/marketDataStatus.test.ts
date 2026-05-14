import { describe, expect, it } from "vitest";
import type {
  AssetMetadata,
  FxRates,
  HoldingValue,
  PriceQuote,
} from "../types/portfolio";
import {
  getCryptoStatus,
  getFxStatus,
  getMarketDataStatuses,
  getTaiwanStatus,
  getUsStatus,
} from "./marketDataStatus";

const now = new Date("2026-05-14T12:00:00.000Z");

function metadata(overrides: Partial<AssetMetadata>): AssetMetadata {
  return {
    symbol: "2330",
    name: "Test",
    type: "taiwan_stock",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    ...overrides,
  };
}

function quote(overrides: Partial<PriceQuote>): PriceQuote {
  return {
    symbol: "2330",
    price: 800,
    currency: "TWD",
    source: "static-tw-market-json",
    status: "ok",
    ...overrides,
  };
}

function row(
  market: AssetMetadata["market"],
  quoteOverrides: Partial<PriceQuote>,
): HoldingValue {
  const symbol =
    market === "CRYPTO" ? "BTC" : market === "US" ? "AAPL" : "2330";
  const type =
    market === "CRYPTO"
      ? "crypto"
      : market === "US"
        ? "us_stock"
        : "taiwan_stock";

  return {
    holding: { id: symbol, type, symbol, quantity: 1 },
    metadata: metadata({
      symbol,
      type,
      market,
      currency: market === "TW" ? "TWD" : "USD",
      priceSource:
        market === "CRYPTO"
          ? "coingecko"
          : market === "US"
            ? "us_static"
            : "yahoo",
    }),
    quote: quote({ symbol, ...quoteOverrides }),
    marketValueTWD: quoteOverrides.price === null ? null : 1000,
    costBasisTWD: null,
    pnlTWD: null,
    pnlPercent: null,
  };
}

function fx(overrides: Partial<FxRates>): FxRates {
  return {
    usdToTwd: 32,
    usdtToTwd: 32,
    source: "Frankfurter",
    status: "ok",
    lastUpdated: "2026-05-14T10:00:00.000Z",
    ...overrides,
  };
}

describe("market data freshness", () => {
  it("includes separate Taiwan, US, crypto, and FX statuses", () => {
    const statuses = getMarketDataStatuses([], fx({}), now);

    expect(statuses.map((status) => status.category)).toEqual([
      "tw",
      "us",
      "crypto",
      "fx",
    ]);
  });

  it("marks recent Taiwan static quotes as fresh", () => {
    const status = getTaiwanStatus(
      [
        row("TW", {
          tradeDate: "2026-05-13",
          generatedAt: "2026-05-14T08:30:00.000Z",
        }),
      ],
      now,
    );

    expect(status.status).toBe("fresh");
    expect(status.label).toBe("台股 / ETF 靜態市場資料");
    expect(status.tradeDate).toBe("2026-05-13");
    expect(status.generatedAt).toBe("2026-05-14T08:30:00.000Z");
  });

  it("marks old Taiwan trade dates as stale", () => {
    const status = getTaiwanStatus(
      [row("TW", { tradeDate: "2026-05-01" })],
      now,
    );

    expect(status.status).toBe("stale");
  });

  it("marks Taiwan holdings as partial when one held quote is unavailable", () => {
    const status = getTaiwanStatus(
      [
        row("TW", { symbol: "2330", price: 800, status: "ok" }),
        row("TW", { symbol: "0050", price: null, status: "unavailable" }),
      ],
      now,
    );

    expect(status.status).toBe("partial");
  });

  it("uses a friendly Taiwan no-holdings status", () => {
    const status = getTaiwanStatus([], now);

    expect(status.status).toBe("fresh");
    expect(status.message).toContain("目前沒有台股");
  });

  it("keeps US static status separate from Taiwan status", () => {
    const status = getUsStatus(
      [
        row("US", {
          symbol: "AAPL",
          source: "static-us-market-json",
          price: null,
          status: "unavailable",
        }),
      ],
      now,
    );

    expect(status.status).toBe("unavailable");
    expect(status.label).toBe("美股 / 美股 ETF 靜態市場資料");
    expect(status.message).toContain("美股");
    expect(status.message).not.toContain("台股");
  });

  it("marks crypto cached quotes as cached", () => {
    const status = getCryptoStatus(
      [
        row("CRYPTO", {
          source: "CoinGecko",
          status: "cached",
          lastUpdated: "2026-05-14T10:00:00.000Z",
        }),
      ],
      now,
    );

    expect(status.status).toBe("cached");
  });

  it("marks crypto as unavailable when all held crypto quotes are unavailable", () => {
    const status = getCryptoStatus(
      [
        row("CRYPTO", {
          source: "CoinGecko",
          price: null,
          status: "unavailable",
        }),
      ],
      now,
    );

    expect(status.status).toBe("unavailable");
  });

  it("marks recent cached FX as cached and old cached FX as stale", () => {
    expect(
      getFxStatus(fx({ status: "cached", lastUpdated: "2026-05-14T10:00:00.000Z" }), now)
        .status,
    ).toBe("cached");
    expect(
      getFxStatus(fx({ status: "cached", lastUpdated: "2026-05-01T10:00:00.000Z" }), now)
        .status,
    ).toBe("stale");
  });

  it("marks fallback FX as unavailable and error FX as error", () => {
    expect(getFxStatus(fx({ status: "fallback" }), now).status).toBe(
      "unavailable",
    );
    expect(getFxStatus(fx({ status: "error" }), now).status).toBe("error");
  });
});
