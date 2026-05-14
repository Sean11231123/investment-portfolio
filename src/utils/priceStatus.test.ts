import { describe, expect, it } from "vitest";
import type { AssetMetadata, PriceQuote } from "../types/portfolio";
import { getPriceReason } from "./priceStatus";

const now = new Date("2026-05-14T12:00:00.000Z");

function quote(overrides: Partial<PriceQuote>): PriceQuote {
  return {
    symbol: "TEST",
    price: null,
    currency: "TWD",
    source: "manual",
    status: "unavailable",
    ...overrides,
  };
}

function metadata(overrides: Partial<AssetMetadata>): AssetMetadata {
  return {
    symbol: "TEST",
    name: "Test",
    type: "custom",
    market: "CUSTOM",
    currency: "TWD",
    unitLabel: "單位" as AssetMetadata["unitLabel"],
    priceSource: "manual",
    ...overrides,
  };
}

describe("price reason labels", () => {
  it("labels Taiwan source-missing prices separately", () => {
    const reason = getPriceReason(
      quote({
        source: "twse",
        error: "來源尚無價格：尚未取得台股/ETF 價格。",
      }),
      metadata({ type: "taiwan_stock", market: "TW", priceSource: "twse" }),
      now,
    );

    expect(reason.category).toBe("source_missing");
    expect(reason.label).toBe("來源尚無價格");
  });

  it("labels US untracked prices separately", () => {
    const reason = getPriceReason(
      quote({
        source: "us_static",
        currency: "USD",
        error: "尚未追蹤美股 / 美股 ETF 價格。",
      }),
      metadata({ type: "us_stock", market: "US", currency: "USD", priceSource: "us_static" }),
      now,
    );

    expect(reason.category).toBe("untracked");
    expect(reason.label).toBe("尚未追蹤價格");
  });

  it("labels provider failures distinctly", () => {
    const reason = getPriceReason(
      quote({
        source: "static-us-market-json",
        currency: "USD",
        error: "美股 / 美股 ETF 靜態市場資料暫時無法取得。Static US price file returned 500",
      }),
      metadata({ type: "us_etf", market: "US", currency: "USD", priceSource: "us_static" }),
      now,
    );

    expect(reason.category).toBe("provider_unavailable");
    expect(reason.label).toBe("價格取得失敗");
  });

  it("labels Binance failures without fallback as provider failures", () => {
    const reason = getPriceReason(
      quote({
        source: "manual",
        currency: "USDT",
        error: "Binance 價格取得失敗，且沒有可用備援來源。Binance returned 503",
      }),
      metadata({ type: "crypto", market: "CRYPTO", currency: "USDT", priceSource: "manual" }),
      now,
    );

    expect(reason.category).toBe("provider_unavailable");
    expect(reason.label).toBe("價格取得失敗");
  });

  it("labels manual/custom assets as unsupported", () => {
    const reason = getPriceReason(
      quote({
        error: "此資產目前使用手動資料，尚未設定價格來源。",
      }),
      metadata({}),
      now,
    );

    expect(reason.category).toBe("unsupported");
    expect(reason.label).toBe("尚未支援價格來源");
  });

  it("labels cached and stale quotes", () => {
    expect(
      getPriceReason(
        quote({ price: 10, status: "cached", lastUpdated: "2026-05-14T10:00:00.000Z" }),
        metadata({}),
        now,
      ).label,
    ).toBe("使用快取價格");

    expect(
      getPriceReason(
        quote({ price: 10, status: "ok", tradeDate: "2026-05-01" }),
        metadata({ type: "taiwan_stock", market: "TW", priceSource: "twse" }),
        now,
      ).label,
    ).toBe("價格可能已過期");
  });
});
