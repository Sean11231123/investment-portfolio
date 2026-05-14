import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAssetMetadata } from "../data/assetRegistry";
import type { AssetMetadata, Holding } from "../types/portfolio";
import { getQuoteForHolding, refreshPrices } from "./priceService";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

function holding(symbol: string, type: Holding["type"]): Holding {
  return {
    id: symbol,
    symbol,
    type,
    quantity: 1,
  };
}

const unit = "股" as AssetMetadata["unitLabel"];

const amdMetadata: AssetMetadata = {
  symbol: "AMD",
  name: "Advanced Micro Devices, Inc.",
  type: "us_stock",
  market: "US",
  currency: "USD",
  unitLabel: unit,
  priceSource: "us_static",
};

const pltrMetadata: AssetMetadata = {
  symbol: "PLTR",
  name: "Palantir Technologies Inc. - Class A Common Stock",
  type: "us_stock",
  market: "US",
  currency: "USD",
  unitLabel: unit,
  priceSource: "us_static",
};

const schdMetadata: AssetMetadata = {
  symbol: "SCHD",
  name: "Schwab U.S. Dividend Equity ETF",
  type: "us_etf",
  market: "US",
  currency: "USD",
  unitLabel: unit,
  priceSource: "us_static",
};

const activeTaiwanEtfMetadata: AssetMetadata = {
  symbol: "00981A",
  name: "主動統一台股增長",
  type: "taiwan_etf",
  market: "TW",
  currency: "TWD",
  unitLabel: unit,
  priceSource: "twse",
};

const avaxMetadata: AssetMetadata = {
  symbol: "AVAX",
  name: "AVAX",
  type: "crypto",
  market: "CRYPTO",
  currency: "USDT",
  unitLabel: unit,
  priceSource: "manual",
};

function mockFetchJson(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => data,
    })),
  );
}

describe("US static price adapter", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("registers US stocks and ETFs with us_static price source", () => {
    expect(getAssetMetadata("AAPL", "us_stock")?.priceSource).toBe("us_static");
    expect(getAssetMetadata("VOO", "us_etf")?.priceSource).toBe("us_static");
  });

  it("uses a positive US static quote as a USD price", async () => {
    mockFetchJson({
      version: 1,
      market: "US",
      source: "stooq",
      generatedAt: "2026-05-14T22:30:00.000Z",
      tradeDate: "2026-05-13",
      currency: "USD",
      quotes: {
        AAPL: {
          symbol: "AAPL",
          name: "Apple Inc.",
          price: 123.45,
          currency: "USD",
          source: "static-us-market-json",
          tradeDate: "2026-05-13",
          lastUpdated: "2026-05-14T22:30:00.000Z",
          status: "ok",
          stooqSymbol: "aapl.us",
        },
      },
      errors: [],
    });

    const prices = await refreshPrices([holding("AAPL", "us_stock")]);

    expect(prices.AAPL.price).toBe(123.45);
    expect(prices.AAPL.currency).toBe("USD");
    expect(prices.AAPL.source).toBe("static-us-market-json");
    expect(prices.AAPL.status).toBe("ok");
  });

  it("keeps a missing US static quote unavailable instead of zero", async () => {
    mockFetchJson({
      version: 1,
      market: "US",
      source: "stooq",
      generatedAt: "2026-05-14T22:30:00.000Z",
      tradeDate: null,
      currency: "USD",
      quotes: {},
      errors: [],
    });

    const prices = await refreshPrices([holding("AAPL", "us_stock")]);

    expect(prices.AAPL.price).toBeNull();
    expect(prices.AAPL.status).toBe("unavailable");
    expect(prices.AAPL.error).toContain("美股");
    expect(prices.AAPL.error).not.toContain("台股");
  });

  it("keeps universe-only assets with missing prices unavailable instead of zero", async () => {
    mockFetchJson({
      version: 1,
      market: "US",
      source: "stooq",
      generatedAt: "2026-05-14T22:30:00.000Z",
      tradeDate: null,
      currency: "USD",
      quotes: {},
      errors: [],
    });

    const prices = await refreshPrices(
      [holding("AMD", "us_stock")],
      [amdMetadata],
    );
    const quote = getQuoteForHolding(
      holding("AMD", "us_stock"),
      prices,
      [amdMetadata],
    );

    expect(quote.price).toBeNull();
    expect(quote.currency).toBe("USD");
    expect(quote.status).toBe("unavailable");
    expect(quote.source).toBe("us_static");
  });

  it("keeps universe-only US stocks and ETFs with missing prices unavailable instead of zero", async () => {
    mockFetchJson({
      version: 1,
      market: "US",
      source: "stooq",
      generatedAt: "2026-05-14T22:30:00.000Z",
      tradeDate: null,
      currency: "USD",
      quotes: {},
      errors: [],
    });

    const prices = await refreshPrices(
      [holding("PLTR", "us_stock"), holding("SCHD", "us_etf")],
      [pltrMetadata, schdMetadata],
    );

    expect(prices.PLTR.price).toBeNull();
    expect(prices.PLTR.status).toBe("unavailable");
    expect(prices.PLTR.source).toBe("us_static");
    expect(prices.SCHD.price).toBeNull();
    expect(prices.SCHD.status).toBe("unavailable");
    expect(prices.SCHD.source).toBe("us_static");
  });

  it("keeps universe-only Taiwan ETFs with missing prices unavailable instead of zero", async () => {
    mockFetchJson({
      version: 1,
      market: "TW",
      source: "twse-openapi-STOCK_DAY_AVG_ALL",
      generatedAt: "2026-05-14T22:30:00.000Z",
      tradeDate: null,
      currency: "TWD",
      quotes: {},
      errors: [],
    });

    const prices = await refreshPrices(
      [holding("00981A", "taiwan_etf")],
      [activeTaiwanEtfMetadata],
    );
    const quote = getQuoteForHolding(
      holding("00981A", "taiwan_etf"),
      prices,
      [activeTaiwanEtfMetadata],
    );

    expect(quote.price).toBeNull();
    expect(quote.currency).toBe("TWD");
    expect(quote.status).toBe("unavailable");
    expect(quote.source).toBe("twse");
  });

  it("keeps universe-only crypto without a safe price source unavailable instead of zero", async () => {
    const prices = await refreshPrices(
      [holding("AVAX", "crypto")],
      [avaxMetadata],
    );
    const quote = getQuoteForHolding(
      holding("AVAX", "crypto"),
      prices,
      [avaxMetadata],
    );

    expect(quote.price).toBeNull();
    expect(quote.currency).toBe("USDT");
    expect(quote.status).toBe("unavailable");
    expect(quote.source).toBe("manual");
  });

  it("keeps Taiwan, crypto, and cash fallback behavior distinct", () => {
    const twQuote = getQuoteForHolding(holding("2330", "taiwan_stock"), {});
    const cryptoQuote = getQuoteForHolding(holding("BTC", "crypto"), {});
    const cashQuote = getQuoteForHolding(holding("TWD", "cash"), {});

    expect(twQuote.price).toBeNull();
    expect(twQuote.error).toContain("台股");
    expect(cryptoQuote.price).toBeNull();
    expect(cryptoQuote.error).toContain("CoinGecko");
    expect(cashQuote.price).toBe(1);
    expect(cashQuote.source).toBe("cash");
  });
});
