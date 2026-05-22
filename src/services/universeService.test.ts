import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAssetUniverse, parseUniverseFile } from "./universeService";

function response(ok: boolean, data: unknown, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

describe("universe service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a valid universe file", () => {
    const parsed = parseUniverseFile({
      version: 1,
      market: "US",
      source: "test",
      generatedAt: "2026-05-14T00:00:00.000Z",
      count: 1,
      assets: [
        {
          symbol: "amd",
          name: "Advanced Micro Devices, Inc.",
          type: "us_stock",
          market: "US",
          currency: "USD",
          unitLabel: "股",
          priceSource: "us_static",
        },
      ],
      errors: [],
    });

    expect(parsed.assets[0].symbol).toBe("AMD");
    expect(parsed.assets[0].priceSource).toBe("us_static");
    expect(parsed.count).toBe(1);
  });

  it("parses a generated Taiwan universe ETF", () => {
    const parsed = parseUniverseFile({
      version: 1,
      market: "TW",
      source: "twse-isin-listed-securities",
      generatedAt: "2026-05-14T00:00:00.000Z",
      count: 1,
      assets: [
        {
          symbol: "00981a",
          name: "主動統一台股增長",
          type: "taiwan_etf",
          market: "TW",
          currency: "TWD",
          unitLabel: "股",
          priceSource: "twse",
          aliases: ["主動統一台股增長"],
          exchange: "TWSE",
          source: "twse-isin",
          sourceSymbol: "00981A",
          isETF: true,
          dataQuality: "generated",
          board: "main",
          securityType: "etf",
          classificationSource: "twse_isin",
          classificationConfidence: "high",
          classificationWarnings: ["fixture warning"],
        },
      ],
      errors: [],
    });

    expect(parsed.assets[0].symbol).toBe("00981A");
    expect(parsed.assets[0].type).toBe("taiwan_etf");
    expect(parsed.assets[0].isETF).toBe(true);
    expect(parsed.assets[0].board).toBe("main");
    expect(parsed.assets[0].securityType).toBe("etf");
    expect(parsed.assets[0].classificationSource).toBe("twse_isin");
    expect(parsed.assets[0].classificationConfidence).toBe("high");
    expect(parsed.assets[0].classificationWarnings).toEqual(["fixture warning"]);
  });

  it("parses a generated TPEx OTC universe asset", () => {
    const parsed = parseUniverseFile({
      version: 1,
      market: "TW",
      source: "twse-isin-listed-and-tpex-otc-securities",
      generatedAt: "2026-05-14T00:00:00.000Z",
      count: 1,
      assets: [
        {
          symbol: "8069",
          name: "E Ink Holdings Inc.",
          type: "taiwan_stock",
          market: "TW",
          currency: "TWD",
          unitLabel: "股",
          priceSource: "tpex_otc",
          aliases: ["E Ink Holdings Inc."],
          exchange: "TPEX",
          marketSegment: "otc",
          source: "tpex-isin",
          sourceSymbol: "8069",
          isETF: false,
          dataQuality: "generated",
          board: "main",
          securityType: "stock",
          classificationSource: "tpex_isin",
          classificationConfidence: "high",
        },
      ],
      errors: [],
    });

    expect(parsed.assets[0].symbol).toBe("8069");
    expect(parsed.assets[0].priceSource).toBe("tpex_otc");
    expect(parsed.assets[0].exchange).toBe("TPEX");
    expect(parsed.assets[0].marketSegment).toBe("otc");
    expect(parsed.assets[0].board).toBe("main");
    expect(parsed.assets[0].securityType).toBe("stock");
    expect(parsed.assets[0].classificationSource).toBe("tpex_isin");
  });

  it("parses a generated TPEx emerging stock universe asset", () => {
    const parsed = parseUniverseFile({
      version: 1,
      market: "TW",
      source: "tpex-esb-latest-statistics",
      generatedAt: "2026-05-22T00:00:00.000Z",
      count: 1,
      assets: [
        {
          symbol: "1260",
          name: "Emerging Stock",
          type: "taiwan_stock",
          market: "TW",
          currency: "TWD",
          unitLabel: "\u80a1",
          priceSource: "manual",
          exchange: "TPEX",
          marketSegment: "emerging",
          board: "emerging",
          securityType: "stock",
          classificationSource: "tpex_openapi",
          classificationConfidence: "high",
          classificationUpdatedAt: "2026-05-22T00:00:00.000Z",
          classificationWarnings: ["suspendTime=123000"],
          source: "tpex-esb-latest-statistics",
          sourceSymbol: "1260",
          dataQuality: "official",
        },
      ],
      errors: [],
    });

    expect(parsed.assets[0].symbol).toBe("1260");
    expect(parsed.assets[0].marketSegment).toBe("emerging");
    expect(parsed.assets[0].board).toBe("emerging");
    expect(parsed.assets[0].priceSource).toBe("manual");
  });

  it("ignores invalid optional classification metadata without crashing", () => {
    const parsed = parseUniverseFile({
      version: 1,
      market: "TW",
      source: "legacy-compatible",
      generatedAt: "2026-05-14T00:00:00.000Z",
      count: 1,
      assets: [
        {
          symbol: "0050",
          name: "TW ETF",
          type: "taiwan_etf",
          market: "TW",
          currency: "TWD",
          unitLabel: "\u80a1",
          priceSource: "twse",
          board: "bad-board",
          securityType: "bad-type",
          classificationSource: "bad-source",
          classificationConfidence: "certain",
          classificationUpdatedAt: "not-a-date",
          classificationWarnings: ["kept", ""],
        },
      ],
      errors: [],
    });

    expect(parsed.assets[0].symbol).toBe("0050");
    expect(parsed.assets[0].board).toBeUndefined();
    expect(parsed.assets[0].securityType).toBeUndefined();
    expect(parsed.assets[0].classificationSource).toBeUndefined();
    expect(parsed.assets[0].classificationConfidence).toBeUndefined();
    expect(parsed.assets[0].classificationUpdatedAt).toBeUndefined();
    expect(parsed.assets[0].classificationWarnings).toEqual(["kept"]);
  });

  it("parses a generated domestic Taiwan fund universe asset", () => {
    const parsed = parseUniverseFile({
      version: 1,
      market: "TW",
      source: "SITCA",
      generatedAt: "2026-05-22T00:00:00.000Z",
      count: 1,
      assets: [
        {
          symbol: "tw_fund_00512527_twd_ah22_00957b",
          name: "Taiwan Domestic Fund",
          type: "taiwan_fund",
          market: "TW",
          currency: "TWD",
          unitLabel: "單位",
          priceSource: "fund_nav_tw",
          exchange: "SITCA",
          marketSegment: "fund",
          source: "sitca-nav",
          sourceSymbol: "DIE02",
          dataQuality: "generated",
          board: "fund",
          securityType: "fund",
          classificationSource: "sitca_nav",
          classificationConfidence: "high",
        },
      ],
      errors: [],
    });

    expect(parsed.assets[0].symbol).toBe("TW_FUND_00512527_TWD_AH22_00957B");
    expect(parsed.assets[0].type).toBe("taiwan_fund");
    expect(parsed.assets[0].priceSource).toBe("fund_nav_tw");
    expect(parsed.assets[0].marketSegment).toBe("fund");
    expect(parsed.assets[0].securityType).toBe("fund");
  });

  it("loads fund universe separately without breaking other datasets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("index.json")) {
          return response(true, {
            version: 1,
            datasets: ["tw-assets.json", "tw-emerging-assets.json", "tw-fund-assets.json"],
          });
        }

        if (url.endsWith("tw-assets.json")) {
          return response(true, {
            version: 1,
            market: "TW",
            source: "twse-isin-listed-and-tpex-otc-securities",
            generatedAt: "2026-05-14T00:00:00.000Z",
            assets: [
              {
                symbol: "0050",
                name: "TW ETF",
                type: "taiwan_etf",
                market: "TW",
                currency: "TWD",
                unitLabel: "股",
                priceSource: "twse",
              },
            ],
          });
        }

        if (url.endsWith("tw-fund-assets.json")) {
          return response(true, {
            version: 1,
            market: "TW",
            source: "SITCA",
            generatedAt: "2026-05-22T00:00:00.000Z",
            assets: [
              {
                symbol: "TW_FUND_00512527_TWD_AH22_00957B",
                name: "Taiwan Domestic Fund",
                type: "taiwan_fund",
                market: "TW",
                currency: "TWD",
                unitLabel: "單位",
                priceSource: "fund_nav_tw",
              },
            ],
          });
        }

        if (url.endsWith("tw-emerging-assets.json")) {
          return response(true, {
            version: 1,
            market: "TW",
            source: "tpex-esb-latest-statistics",
            generatedAt: "2026-05-22T00:00:00.000Z",
            assets: [
              {
                symbol: "1260",
                name: "Emerging Stock",
                type: "taiwan_stock",
                market: "TW",
                currency: "TWD",
                unitLabel: "\u80a1",
                priceSource: "manual",
                exchange: "TPEX",
                marketSegment: "emerging",
                board: "emerging",
                securityType: "stock",
                classificationSource: "tpex_openapi",
                classificationConfidence: "high",
              },
            ],
          });
        }

        return response(false, {}, 404);
      }),
    );

    const result = await loadAssetUniverse();

    expect(result.status).toBe("loaded");
    expect(result.assets.map((asset) => asset.symbol)).toEqual(
      expect.arrayContaining([
        "0050",
        "1260",
        "TW_FUND_00512527_TWD_AH22_00957B",
      ]),
    );
  });

  it("parses a generated US universe stock and ETF", () => {
    const parsed = parseUniverseFile({
      version: 1,
      market: "US",
      source: "nasdaqtrader-symbol-directory",
      generatedAt: "2026-05-14T00:00:00.000Z",
      count: 2,
      assets: [
        {
          symbol: "pltr",
          name: "Palantir Technologies Inc. - Class A Common Stock",
          type: "us_stock",
          market: "US",
          currency: "USD",
          unitLabel: "股",
          priceSource: "us_static",
          aliases: ["Palantir Technologies Inc."],
          exchange: "NASDAQ",
          source: "nasdaqtrader-symbol-directory",
          sourceSymbol: "PLTR",
          stooqSymbol: "pltr.us",
          isETF: false,
          dataQuality: "generated",
        },
        {
          symbol: "schd",
          name: "Schwab U.S. Dividend Equity ETF",
          type: "us_etf",
          market: "US",
          currency: "USD",
          unitLabel: "股",
          priceSource: "us_static",
          aliases: ["Schwab U.S. Dividend Equity ETF"],
          exchange: "NYSEARCA",
          source: "nasdaqtrader-symbol-directory",
          sourceSymbol: "SCHD",
          stooqSymbol: "schd.us",
          isETF: true,
          dataQuality: "generated",
        },
      ],
      errors: [],
    });

    expect(parsed.assets.map((asset) => asset.symbol)).toEqual(["PLTR", "SCHD"]);
    expect(parsed.assets[0].type).toBe("us_stock");
    expect(parsed.assets[1].type).toBe("us_etf");
  });

  it("parses a generated crypto universe asset", () => {
    const parsed = parseUniverseFile({
      version: 1,
      market: "CRYPTO",
      source: "binance-exchangeinfo-coingecko-list",
      generatedAt: "2026-05-14T00:00:00.000Z",
      count: 1,
      assets: [
        {
          symbol: "doge",
          name: "Dogecoin",
          type: "crypto",
          market: "CRYPTO",
          currency: "USDT",
          unitLabel: "顆",
          priceSource: "coingecko",
          aliases: ["Dogecoin"],
          exchange: "BINANCE",
          source: "binance-exchangeinfo",
          sourceSymbol: "DOGEUSDT",
          binanceSymbol: "DOGEUSDT",
          coingeckoId: "dogecoin",
          dataQuality: "generated",
        },
      ],
      errors: [],
    });

    expect(parsed.assets[0].symbol).toBe("DOGE");
    expect(parsed.assets[0].type).toBe("crypto");
    expect(parsed.assets[0].coingeckoId).toBe("dogecoin");
  });

  it("loads universe datasets and reports partial failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("index.json")) {
          return response(true, {
            version: 1,
            datasets: ["us-assets.json", "tw-assets.json"],
          });
        }

        if (url.endsWith("us-assets.json")) {
          return response(true, {
            version: 1,
            market: "US",
            source: "test",
            generatedAt: "2026-05-14T00:00:00.000Z",
            assets: [
              {
                symbol: "AMD",
                name: "Advanced Micro Devices, Inc.",
                type: "us_stock",
                market: "US",
                currency: "USD",
                unitLabel: "股",
                priceSource: "us_static",
              },
            ],
          });
        }

        return response(false, {}, 404);
      }),
    );

    const result = await loadAssetUniverse();

    expect(result.status).toBe("partial");
    expect(result.assets.map((asset) => asset.symbol)).toEqual(["AMD"]);
    expect(result.files).toEqual([
      {
        market: "US",
        source: "test",
        generatedAt: "2026-05-14T00:00:00.000Z",
        count: 1,
      },
    ]);
    expect(result.errors[0]).toContain("tw-assets.json");
  });

  it("falls back without throwing when index and datasets are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(false, {}, 404)));

    const result = await loadAssetUniverse();

    expect(result.status).toBe("unavailable");
    expect(result.assets).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
