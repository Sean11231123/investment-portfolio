import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAssetMetadata } from "../data/assetRegistry";
import type { Holding } from "../types/portfolio";
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
