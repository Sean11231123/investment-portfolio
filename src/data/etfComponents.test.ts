import { describe, expect, it } from "vitest";
import { etfComponentDatasets, etfComponents } from "./etfComponents";
import type { HoldingValue, PriceQuote } from "../types/portfolio";
import { calculateETFExposure } from "../utils/etfLookthrough";

function quote(symbol: string, price: number): PriceQuote {
  return {
    symbol,
    price,
    currency: "TWD",
    source: "test",
    status: "ok",
  };
}

function etfRow(symbol: string, valueTWD: number): HoldingValue {
  return {
    holding: {
      id: symbol,
      type: "taiwan_etf",
      symbol,
      quantity: 1,
    },
    metadata: {
      symbol,
      name: etfComponents[symbol].name,
      type: "taiwan_etf",
      market: "TW",
      currency: "TWD",
      unitLabel: "股",
      priceSource: "yahoo",
    },
    quote: quote(symbol, valueTWD),
    marketValueTWD: valueTWD,
    costBasisTWD: null,
    pnlTWD: null,
    pnlPercent: null,
  };
}

describe("JSON-backed ETF component adapter", () => {
  it("loads the expected ETF datasets", () => {
    expect(Object.keys(etfComponents).sort()).toEqual([
      "0050",
      "006208",
      "00878",
    ]);
    expect(etfComponentDatasets).toHaveLength(3);
  });

  it("preserves metadata from the canonical JSON files", () => {
    for (const symbol of ["0050", "006208", "00878"]) {
      const data = etfComponents[symbol];

      expect(data.name).toBeTruthy();
      expect(data.sourceNote).toBeTruthy();
      expect(data.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(data.dataQuality).toBeTruthy();
      expect(data.componentCount).toBe(data.components.length);
      expect(data.totalWeight).toBeGreaterThan(0);
    }
  });

  it("loads non-empty positive component weights", () => {
    for (const data of Object.values(etfComponents)) {
      expect(data.components.length).toBeGreaterThan(0);
      for (const component of data.components) {
        expect(component.symbol).toBeTruthy();
        expect(component.name).toBeTruthy();
        expect(component.weight).toBeGreaterThan(0);
        expect(component.weight).toBeLessThanOrEqual(1);
      }
    }
  });

  it("remains compatible with ETF lookthrough calculations", () => {
    const rows = [etfRow("0050", 20000)];
    const exposure = calculateETFExposure(rows, etfComponents).find(
      (row) => row.symbol === "2330",
    );

    expect(exposure?.indirectExposureTWD).toBe(9600);
    expect(exposure?.sourceEtfs).toEqual(["0050"]);
  });
});
