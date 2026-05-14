import { describe, expect, it } from "vitest";
import { etfComponentDatasets, etfComponents } from "./etfComponents";
import type { HoldingValue, PriceQuote } from "../types/portfolio";
import {
  calculateETFExposure,
  calculateETFOnlyAggregateExposure,
  calculateSingleETFComposition,
} from "../utils/etfLookthrough";
import { getPriceReason } from "../utils/priceStatus";

function quote(symbol: string, price: number): PriceQuote {
  return {
    symbol,
    price,
    currency: "TWD",
    source: "test",
    status: "ok",
  };
}

function etfRow(
  symbol: string,
  valueTWD: number,
  type: "taiwan_etf" | "us_etf" = "taiwan_etf",
): HoldingValue {
  return {
    holding: {
      id: symbol,
      type,
      symbol,
      quantity: 1,
    },
    metadata: {
      symbol,
      name: etfComponents[symbol].name,
      type,
      market: type === "us_etf" ? "US" : "TW",
      currency: type === "us_etf" ? "USD" : "TWD",
      unitLabel: "股",
      priceSource: type === "us_etf" ? "us_static" : "yahoo",
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
      "QQQ",
      "SPY",
      "VOO",
    ]);
    expect(etfComponentDatasets).toHaveLength(6);
  });

  it("preserves metadata from the canonical JSON files", () => {
    for (const symbol of ["0050", "006208", "00878", "VOO", "SPY", "QQQ"]) {
      const data = etfComponents[symbol];

      expect(data.name).toBeTruthy();
      expect(data.market).toMatch(/^(TW|US)$/);
      expect(data.sourceNote).toBeTruthy();
      expect(data.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(data.dataQuality).toBeTruthy();
      expect(data.componentCount).toBe(data.components.length);
      expect(data.totalWeight).toBeGreaterThan(0);
    }
  });

  it("loads generated US ETF metadata from the automated component pipeline", () => {
    const expectations = [
      ["SPY", "ssga_xlsx", 100],
      ["VOO", "vanguard_json", 100],
      ["QQQ", "invesco_json", 50],
    ] as const;

    for (const [symbol, sourceType, minimumComponents] of expectations) {
      const data = etfComponents[symbol];

      expect(data.market).toBe("US");
      expect(data.source).toBe("automated-us-etf-components");
      expect(data.sourceType).toBe(sourceType);
      expect(data.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(data.dataQuality).toBe("official");
      expect(data.components.length).toBeGreaterThan(minimumComponents);
      expect(data.totalWeight).toBeGreaterThan(0.9);
      expect(data.totalWeight).toBeLessThanOrEqual(1.01);
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

  it("keeps a priced universe ETF without component JSON unexpanded", () => {
    const rows: HoldingValue[] = [
      {
        holding: {
          id: "00981A",
          type: "taiwan_etf",
          symbol: "00981A",
          quantity: 1,
        },
        metadata: {
          symbol: "00981A",
          name: "主動統一台股增長",
          type: "taiwan_etf",
          market: "TW",
          currency: "TWD",
          unitLabel: "股" as HoldingValue["metadata"]["unitLabel"],
          priceSource: "twse",
        },
        quote: quote("00981A", 100),
        marketValueTWD: 100,
        costBasisTWD: null,
        pnlTWD: null,
        pnlPercent: null,
      },
    ];

    const exposure = calculateETFOnlyAggregateExposure(rows, {});

    expect(exposure).toHaveLength(1);
    expect(exposure[0].symbol).toBe("UNEXPANDED_ETF");
    expect(exposure[0].indirectExposureTWD).toBe(100);
    expect(exposure[0].sourceEtfs).toEqual(["00981A"]);
  });

  it("keeps a priced universe US ETF without component JSON unexpanded", () => {
    const rows: HoldingValue[] = [
      {
        holding: {
          id: "SCHD",
          type: "us_etf",
          symbol: "SCHD",
          quantity: 1,
        },
        metadata: {
          symbol: "SCHD",
          name: "Schwab U.S. Dividend Equity ETF",
          type: "us_etf",
          market: "US",
          currency: "USD",
          unitLabel: "股" as HoldingValue["metadata"]["unitLabel"],
          priceSource: "us_static",
        },
        quote: {
          symbol: "SCHD",
          price: 75,
          currency: "USD",
          source: "test",
          status: "ok",
        },
        marketValueTWD: 2400,
        costBasisTWD: null,
        pnlTWD: null,
        pnlPercent: null,
      },
    ];

    const exposure = calculateETFOnlyAggregateExposure(rows, {});

    expect(exposure).toHaveLength(1);
    expect(exposure[0].symbol).toBe("UNEXPANDED_ETF");
    expect(exposure[0].indirectExposureTWD).toBe(2400);
    expect(exposure[0].sourceEtfs).toEqual(["SCHD"]);
    expect(getPriceReason(rows[0].quote, rows[0].metadata).label).toBe(
      "已取得價格",
    );
  });

  it("remains compatible with ETF lookthrough calculations", () => {
    const rows = [etfRow("0050", 20000)];
    const exposure = calculateETFExposure(rows, etfComponents).find(
      (row) => row.symbol === "2330",
    );

    expect(exposure?.indirectExposureTWD).toBe(9600);
    expect(exposure?.sourceEtfs).toEqual(["0050"]);
  });

  it("expands VOO through the same ETF-only lookthrough path", () => {
    const rows = [etfRow("VOO", 100000, "us_etf")];
    const exposure = calculateETFOnlyAggregateExposure(rows, etfComponents);
    const nvidiaWeight = etfComponents.VOO.components.find(
      (component) => component.symbol === "NVDA",
    )?.weight;
    const nvidia = exposure.find((row) => row.symbol === "NVDA");
    const other = exposure.find((row) => row.symbol === "OTHER");

    expect(nvidiaWeight).toBeGreaterThan(0);
    expect(nvidia?.indirectExposureTWD).toBeCloseTo((nvidiaWeight ?? 0) * 100000);
    expect(nvidia?.portfolioPercentage).toBeCloseTo((nvidiaWeight ?? 0) * 100);
    expect(other?.name).toBe("其他");
    expect(other?.portfolioPercentage).toBeCloseTo(
      Math.max(0, 1 - (etfComponents.VOO.totalWeight ?? 0)) * 100,
    );
  });

  it("shows VOO single ETF composition using component-relative weights", () => {
    const rows = [etfRow("VOO", 100000, "us_etf")];
    const exposure = calculateSingleETFComposition(
      rows.map((row) => row.holding),
      rows,
      "VOO",
      etfComponents,
    );
    const nvidiaWeight = etfComponents.VOO.components.find(
      (component) => component.symbol === "NVDA",
    )?.weight;

    expect(exposure.find((row) => row.symbol === "NVDA")?.portfolioPercentage).toBeCloseTo((nvidiaWeight ?? 0) * 100);
    expect(exposure.find((row) => row.symbol === "OTHER")?.portfolioPercentage).toBeCloseTo(
      Math.max(0, 1 - (etfComponents.VOO.totalWeight ?? 0)) * 100,
    );
  });
});
