import { describe, expect, it } from "vitest";
import type {
  AssetMetadata,
  ETFComponentMap,
  HoldingValue,
  PriceQuote,
} from "../types/portfolio";
import {
  calculateETFExposure,
  calculateSingleETFExposure,
} from "./etfLookthrough";

const componentMap: ETFComponentMap = {
  "0050": {
    name: "Mock 0050",
    sourceNote: "test",
    lastUpdated: "2026-05-14",
    components: [
      { symbol: "2330", name: "台積電", weight: 0.5 },
      { symbol: "2317", name: "鴻海", weight: 0.5 },
    ],
  },
  "0052": {
    name: "Mock 0052",
    sourceNote: "test",
    lastUpdated: "2026-05-14",
    components: [
      { symbol: "2330", name: "台積電", weight: 0.25 },
      { symbol: "2454", name: "聯發科", weight: 0.75 },
    ],
  },
};

function metadata(overrides: Partial<AssetMetadata>): AssetMetadata {
  return {
    symbol: "TWD",
    name: "Test",
    type: "cash",
    market: "CASH",
    currency: "TWD",
    unitLabel: "金額",
    priceSource: "cash",
    ...overrides,
  };
}

function quote(symbol: string, price: number | null): PriceQuote {
  return {
    symbol,
    price,
    currency: "TWD",
    source: "test",
    status: price === null ? "unavailable" : "ok",
  };
}

function row(
  symbol: string,
  valueTWD: number | null,
  type: AssetMetadata["type"] = "taiwan_stock",
): HoldingValue {
  return {
    holding: {
      id: symbol,
      type,
      symbol,
      quantity: 1,
    },
    metadata: metadata({
      symbol,
      name: symbol,
      type,
      market: type === "cash" ? "CASH" : "TW",
      priceSource: type === "cash" ? "cash" : "yahoo",
    }),
    quote: quote(symbol, valueTWD),
    marketValueTWD: valueTWD,
    costBasisTWD: null,
    pnlTWD: null,
    pnlPercent: null,
  };
}

describe("ETF lookthrough", () => {
  it("calculates single ETF indirect exposure as portfolio percentage", () => {
    const rows = [row("0050", 20000, "taiwan_etf"), row("TWD", 80000, "cash")];
    const exposure = calculateETFExposure(rows, componentMap).find(
      (item) => item.symbol === "2330",
    );

    expect(exposure?.indirectExposureTWD).toBe(10000);
    expect(exposure?.portfolioPercentage).toBeCloseTo(10);
  });

  it("aggregates the same component across multiple ETFs", () => {
    const rows = [
      row("0050", 20000, "taiwan_etf"),
      row("0052", 40000, "taiwan_etf"),
      row("TWD", 40000, "cash"),
    ];
    const exposure = calculateETFExposure(rows, componentMap).find(
      (item) => item.symbol === "2330",
    );

    expect(exposure?.indirectExposureTWD).toBe(20000);
    expect(exposure?.sourceEtfs).toEqual(["0050", "0052"]);
  });

  it("merges direct and indirect exposure for matching symbols", () => {
    const rows = [
      row("2330", 8000),
      row("0050", 20000, "taiwan_etf"),
      row("TWD", 72000, "cash"),
    ];
    const exposure = calculateETFExposure(rows, componentMap).find(
      (item) => item.symbol === "2330",
    );

    expect(exposure?.directExposureTWD).toBe(8000);
    expect(exposure?.indirectExposureTWD).toBe(10000);
    expect(exposure?.totalExposureTWD).toBe(18000);
  });

  it("skips ETFs without component data", () => {
    const rows = [row("00999", 20000, "taiwan_etf"), row("TWD", 80000, "cash")];

    expect(() => calculateETFExposure(rows, componentMap)).not.toThrow();
    expect(
      calculateETFExposure(rows, componentMap).some(
        (item) => item.sourceEtfs.includes("00999"),
      ),
    ).toBe(false);
  });

  it("does not expand ETFs with unavailable market value", () => {
    const rows = [row("0050", null, "taiwan_etf"), row("TWD", 80000, "cash")];
    const exposure = calculateETFExposure(rows, componentMap).find(
      (item) => item.symbol === "2330",
    );

    expect(exposure).toBeUndefined();
  });

  it("calculates selected ETF exposure relative to the whole portfolio", () => {
    const rows = [row("0050", 20000, "taiwan_etf"), row("TWD", 80000, "cash")];
    const exposure = calculateSingleETFExposure(
      rows.map((item) => item.holding),
      rows,
      "0050",
      componentMap,
    ).find((item) => item.symbol === "2330");

    expect(exposure?.totalExposureTWD).toBe(10000);
    expect(exposure?.portfolioPercentage).toBeCloseTo(10);
  });
});
