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

const otcTaiwanStockMetadata: AssetMetadata = {
  symbol: "8069",
  name: "E Ink Holdings Inc.",
  type: "taiwan_stock",
  market: "TW",
  currency: "TWD",
  unitLabel: unit,
  priceSource: "tpex_otc",
  exchange: "TPEX",
  marketSegment: "otc",
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

const dogeMetadata: AssetMetadata = {
  symbol: "DOGE",
  name: "Dogecoin",
  type: "crypto",
  market: "CRYPTO",
  currency: "USDT",
  unitLabel: unit,
  priceSource: "manual",
  binanceSymbol: "DOGEUSDT",
};

const arbMetadata: AssetMetadata = {
  symbol: "ARB",
  name: "Arbitrum",
  type: "crypto",
  market: "CRYPTO",
  currency: "USDT",
  unitLabel: unit,
  priceSource: "coingecko",
  coingeckoId: "arbitrum",
  binanceSymbol: "ARBUSDT",
};

const linkMetadata: AssetMetadata = {
  symbol: "LINK",
  name: "Chainlink",
  type: "crypto",
  market: "CRYPTO",
  currency: "USD",
  unitLabel: unit,
  priceSource: "coingecko",
  coingeckoId: "chainlink",
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

function mockFetchByUrl(handler: (url: string) => { ok?: boolean; data: unknown; status?: number }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const result = handler(url);
      return {
        ok: result.ok ?? true,
        status: result.status ?? 200,
        json: async () => result.data,
      };
    }),
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
    expect(getAssetMetadata("BTC", "crypto")?.binanceSymbol).toBe("BTCUSDT");
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

  it("reads a broad Taiwan static quote for a universe-only active ETF", async () => {
    mockFetchJson({
      version: 1,
      market: "TW",
      source: "twse-openapi-STOCK_DAY_AVG_ALL",
      generatedAt: "2026-05-14T22:30:00.000Z",
      tradeDate: "2026-05-13",
      currency: "TWD",
      quotes: {
        "00981A": {
          symbol: "00981A",
          name: "主動統一台股增長",
          price: 12.34,
          currency: "TWD",
          source: "twse",
          tradeDate: "2026-05-13",
          lastUpdated: "2026-05-14T22:30:00.000Z",
          status: "ok",
        },
      },
      errors: [],
    });

    const prices = await refreshPrices(
      [holding("00981A", "taiwan_etf")],
      [activeTaiwanEtfMetadata],
    );

    expect(prices["00981A"].price).toBe(12.34);
    expect(prices["00981A"].currency).toBe("TWD");
    expect(prices["00981A"].source).toBe("static-tw-market-json");
    expect(prices["00981A"].status).toBe("ok");
  });

  it("keeps TPEx OTC assets unavailable until an OTC price adapter exists", async () => {
    const prices = await refreshPrices(
      [holding("8069", "taiwan_stock")],
      [otcTaiwanStockMetadata],
    );
    const quote = getQuoteForHolding(
      holding("8069", "taiwan_stock"),
      prices,
      [otcTaiwanStockMetadata],
    );

    expect(quote.price).toBeNull();
    expect(quote.currency).toBe("TWD");
    expect(quote.status).toBe("unavailable");
    expect(quote.source).toBe("tpex_otc");
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

  it("uses Binance for crypto assets with a binance symbol", async () => {
    mockFetchByUrl((url) => {
      expect(url).toContain("api.binance.com");
      return {
        data: [{ symbol: "DOGEUSDT", price: "0.1234" }],
      };
    });

    const prices = await refreshPrices(
      [holding("DOGE", "crypto")],
      [dogeMetadata],
    );

    expect(prices.DOGE.price).toBe(0.1234);
    expect(prices.DOGE.currency).toBe("USDT");
    expect(prices.DOGE.source).toBe("Binance");
    expect(prices.DOGE.status).toBe("ok");
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toContain("coingecko");
  });

  it("uses Binance for built-in crypto while preserving existing USD currency convention", async () => {
    mockFetchByUrl((url) => {
      expect(url).toContain("api.binance.com");
      return {
        data: [{ symbol: "BTCUSDT", price: "95000" }],
      };
    });

    const prices = await refreshPrices([holding("BTC", "crypto")]);

    expect(prices.BTC.price).toBe(95000);
    expect(prices.BTC.currency).toBe("USD");
    expect(prices.BTC.source).toBe("Binance");
  });

  it("falls back to CoinGecko when Binance fails and a CoinGecko ID exists", async () => {
    mockFetchByUrl((url) => {
      if (url.includes("api.binance.com")) {
        return { ok: false, status: 503, data: {} };
      }

      expect(url).toContain("coingecko");
      return {
        data: {
          arbitrum: {
            usd: 1.25,
            last_updated_at: 1770000000,
          },
        },
      };
    });

    const prices = await refreshPrices(
      [holding("ARB", "crypto")],
      [arbMetadata],
    );

    expect(prices.ARB.price).toBe(1.25);
    expect(prices.ARB.currency).toBe("USD");
    expect(prices.ARB.source).toBe("CoinGecko");
    expect(prices.ARB.status).toBe("ok");
    expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
  });

  it("keeps Binance failures without CoinGecko fallback unavailable instead of zero", async () => {
    mockFetchByUrl((url) => {
      expect(url).toContain("api.binance.com");
      return { ok: false, status: 503, data: {} };
    });

    const prices = await refreshPrices(
      [holding("DOGE", "crypto")],
      [dogeMetadata],
    );

    expect(prices.DOGE.price).toBeNull();
    expect(prices.DOGE.currency).toBe("USDT");
    expect(prices.DOGE.status).toBe("unavailable");
    expect(prices.DOGE.source).toBe("manual");
    expect(prices.DOGE.error).toContain("Binance 價格取得失敗");
  });

  it("keeps CoinGecko-only crypto behavior for assets without a Binance symbol", async () => {
    mockFetchByUrl((url) => {
      expect(url).toContain("coingecko");
      return {
        data: {
          chainlink: {
            usd: 18.5,
            last_updated_at: 1770000000,
          },
        },
      };
    });

    const prices = await refreshPrices(
      [holding("LINK", "crypto")],
      [linkMetadata],
    );

    expect(prices.LINK.price).toBe(18.5);
    expect(prices.LINK.currency).toBe("USD");
    expect(prices.LINK.source).toBe("CoinGecko");
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
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
