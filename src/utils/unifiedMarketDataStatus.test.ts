import { describe, expect, it } from "vitest";
import type { FxRates, HoldingValue } from "../types/portfolio";
import {
  getUnifiedMarketDataStatus,
  summarizeEtfComponents,
  summarizePriceFile,
  summarizeUniverseFile,
} from "./unifiedMarketDataStatus";

const fxRates: FxRates = {
  usdToTwd: 32,
  usdtToTwd: 32.1,
  source: "Frankfurter",
  status: "ok",
  lastUpdated: "2026-05-14T10:00:00.000Z",
};

function cryptoHolding(symbol: string): HoldingValue {
  return {
    holding: { id: symbol, type: "crypto", symbol, quantity: 1 },
    metadata: {
      symbol,
      name: symbol,
      type: "crypto",
      market: "CRYPTO",
      currency: "USDT",
      unitLabel: "顆" as never,
      priceSource: "coingecko",
      binanceSymbol: `${symbol}USDT`,
    },
    quote: {
      symbol,
      price: 1,
      currency: "USDT",
      source: "Binance",
      status: "ok",
    },
    marketValueTWD: 32,
    costBasisTWD: null,
    pnlTWD: null,
    pnlPercent: null,
  };
}

describe("unified market data status", () => {
  it("summarizes Taiwan universe count from a fixture", () => {
    const row = summarizeUniverseFile(
      "tw-universe",
      "台股資產清單",
      {
        source: "twse-isin-listed-securities",
        generatedAt: "2026-05-14T00:00:00.000Z",
        count: 1262,
        assets: [],
      },
      "TWSE ISIN",
    );

    expect(row.status).toBe("ok");
    expect(row.summary).toBe("1,262 筆");
    expect(row.source).toBe("TWSE ISIN");
  });

  it("marks unavailable universe files without crashing", () => {
    const row = summarizeUniverseFile(
      "us-universe",
      "美股資產清單",
      null,
      "Nasdaq Trader",
    );

    expect(row.status).toBe("unavailable");
    expect(row.summary).toBe("尚未載入資產清單");
  });

  it("calculates Taiwan priced and unavailable quote counts", () => {
    const row = summarizePriceFile({
      id: "tw-prices",
      name: "台股價格",
      sourceLabel: "TWSE",
      file: {
        generatedAt: "2026-05-14T00:00:00.000Z",
        tradeDate: "2026-05-13",
        quotes: {
          "0052": { symbol: "0052", price: 180, status: "ok" },
          "00981A": { symbol: "00981A", price: 10, status: "ok" },
          BAD: { symbol: "BAD", price: null, status: "unavailable" },
        },
      },
    });

    expect(row.status).toBe("partial");
    expect(row.summary).toBe("2 / 3 有價格");
    expect(row.details?.[0]).toBe("1 筆尚未取得價格");
  });

  it("labels US prices as a curated tracked subset", () => {
    const row = summarizePriceFile({
      id: "us-prices",
      name: "美股價格",
      sourceLabel: "Stooq",
      trackedSubset: true,
      detail: "美股價格為精選追蹤清單，非全市場。",
      file: {
        tradeDate: "2026-05-14",
        quotes: {
          AAPL: { symbol: "AAPL", price: 200, status: "ok" },
          SCHD: { symbol: "SCHD", price: 80, status: "ok" },
        },
      },
    });

    expect(row.status).toBe("tracked");
    expect(row.statusLabel).toBe("追蹤清單");
    expect(row.details).toContain("美股價格為精選追蹤清單，非全市場。");
  });

  it("reports static price files as unavailable when missing", () => {
    const row = summarizePriceFile({
      id: "tw-prices",
      name: "台股價格",
      sourceLabel: "TWSE",
      file: undefined,
    });

    expect(row.status).toBe("unavailable");
    expect(row.summary).toBe("靜態市場資料暫時無法取得");
  });

  it("describes crypto prices as runtime/on-demand instead of full static coverage", () => {
    const sections = getUnifiedMarketDataStatus({
      fxRates,
      holdingValues: [cryptoHolding("DOGE")],
      universes: {
        tw: { count: 1 },
        us: { count: 1 },
        crypto: { count: 421 },
      },
      prices: {
        tw: { quotes: {} },
        us: { quotes: {} },
      },
      etfDatasets: [],
    });

    const cryptoRow = sections
      .find((section) => section.id === "prices")
      ?.rows.find((row) => row.id === "crypto-runtime-prices");

    expect(cryptoRow?.status).toBe("runtime");
    expect(cryptoRow?.summary).toBe("1 個持倉資產才查詢");
    expect(cryptoRow?.details).toContain("不會預先載入全部加密貨幣價格。");
  });

  it("reports missing ETF components as unexpanded ETF, not provider failure", () => {
    const row = summarizeEtfComponents([
      {
        symbol: "SPY",
        dataQuality: "official",
        lastUpdated: "2026-05-14T00:00:00.000Z",
      },
      {
        symbol: "0050",
        dataQuality: "sample",
        lastUpdated: "2026-05-13T00:00:00.000Z",
      },
    ]);

    expect(row.status).toBe("partial");
    expect(row.summary).toBe("0050 / SPY 已展開");
    expect(row.details?.join(" ")).toContain("未展開 ETF");
    expect(row.details?.join(" ")).not.toContain("價格取得失敗");
  });
});
