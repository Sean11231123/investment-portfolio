import { describe, expect, it } from "vitest";
import type {
  AssetMetadata,
  ETFComponentMap,
  HoldingValue,
  PriceQuote,
} from "../types/portfolio";
import {
  calculateETFExposure,
  calculateETFOnlyAggregateExposure,
  calculateSingleETFComposition,
  calculateSingleETFExposure,
  isETFAssetType,
} from "./etfLookthrough";

const componentMap: ETFComponentMap = {
  "0050": {
    name: "Mock 0050",
    sourceNote: "test",
    lastUpdated: "2026-05-14",
    components: [
      { symbol: "2330", name: "台積電", weight: 0.5 },
      { symbol: "2317", name: "鴻海", weight: 0.3 },
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
  "00878": {
    name: "Mock 00878",
    sourceNote: "test",
    lastUpdated: "2026-05-14",
    components: [
      { symbol: "2330", name: "台積電", weight: 0.375 },
      { symbol: "2886", name: "兆豐金", weight: 0.2 },
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
  const market =
    type === "cash"
      ? "CASH"
      : type === "crypto"
        ? "CRYPTO"
        : type === "us_stock" || type === "us_etf"
          ? "US"
          : "TW";
  const currency = type === "crypto" || type === "us_stock" || type === "us_etf" ? "USD" : "TWD";
  const priceSource =
    type === "cash"
      ? "cash"
      : type === "crypto"
        ? "coingecko"
        : type === "us_stock" || type === "us_etf"
          ? "us_static"
          : "yahoo";

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
      market,
      currency,
      priceSource,
    }),
    quote: quote(symbol, valueTWD),
    marketValueTWD: valueTWD,
    costBasisTWD: null,
    pnlTWD: null,
    pnlPercent: null,
  };
}

describe("ETF asset type detection", () => {
  it("treats Taiwan ETFs and US ETFs as ETF holdings", () => {
    expect(isETFAssetType("taiwan_etf")).toBe(true);
    expect(isETFAssetType("us_etf")).toBe(true);
    expect(isETFAssetType("taiwan_stock")).toBe(false);
    expect(isETFAssetType("us_stock")).toBe(false);
    expect(isETFAssetType("crypto")).toBe(false);
    expect(isETFAssetType("cash")).toBe(false);
    expect(isETFAssetType("custom")).toBe(false);
  });
});

describe("portfolio-level ETF lookthrough compatibility", () => {
  it("keeps the old whole-portfolio exposure helper available", () => {
    const rows = [row("0050", 20000, "taiwan_etf"), row("TWD", 80000, "cash")];
    const exposure = calculateETFExposure(rows, componentMap).find(
      (item) => item.symbol === "2330",
    );

    expect(exposure?.indirectExposureTWD).toBe(10000);
    expect(exposure?.portfolioPercentage).toBeCloseTo(10);
  });

  it("keeps selected ETF exposure relative to the whole portfolio for compatibility", () => {
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

describe("ETF-only aggregate exposure", () => {
  it("uses priced ETF holdings as the denominator", () => {
    const rows = [
      row("0050", 60000, "taiwan_etf"),
      row("00878", 40000, "taiwan_etf"),
      row("BTC", 100000, "crypto"),
      row("TWD", 50000, "cash"),
    ];
    const exposure = calculateETFOnlyAggregateExposure(rows, componentMap).find(
      (item) => item.symbol === "2330",
    );

    expect(exposure?.indirectExposureTWD).toBe(45000);
    expect(exposure?.portfolioPercentage).toBeCloseTo(45);
  });

  it("includes Taiwan ETFs and US ETFs in the ETF-only denominator", () => {
    const rows = [
      row("0050", 60000, "taiwan_etf"),
      row("VOO", 40000, "us_etf"),
      row("BTC", 100000, "crypto"),
      row("TWD", 50000, "cash"),
    ];
    const exposure = calculateETFOnlyAggregateExposure(rows, componentMap);
    const tsmc = exposure.find((item) => item.symbol === "2330");
    const unexpanded = exposure.find(
      (item) => item.symbol === "UNEXPANDED_ETF",
    );

    expect(tsmc?.indirectExposureTWD).toBe(30000);
    expect(tsmc?.portfolioPercentage).toBeCloseTo(30);
    expect(unexpanded?.name).toBe("未展開 ETF");
    expect(unexpanded?.totalExposureTWD).toBe(40000);
    expect(unexpanded?.portfolioPercentage).toBeCloseTo(40);
    expect(unexpanded?.sourceEtfs).toEqual(["VOO"]);
  });

  it("excludes non-ETF assets from the aggregate rows", () => {
    const rows = [
      row("0050", 60000, "taiwan_etf"),
      row("AAPL", 70000, "us_stock"),
      row("BTC", 100000, "crypto"),
      row("TWD", 50000, "cash"),
      row("CUSTOM", 30000, "custom"),
    ];
    const symbols = calculateETFOnlyAggregateExposure(rows, componentMap).map(
      (item) => item.symbol,
    );

    expect(symbols).not.toContain("AAPL");
    expect(symbols).not.toContain("BTC");
    expect(symbols).not.toContain("TWD");
    expect(symbols).not.toContain("CUSTOM");
  });

  it("does not merge direct stock holdings into ETF-only aggregate exposure", () => {
    const rows = [
      row("2330", 20000, "taiwan_stock"),
      row("0050", 60000, "taiwan_etf"),
    ];
    const exposure = calculateETFOnlyAggregateExposure(rows, componentMap).find(
      (item) => item.symbol === "2330",
    );

    expect(exposure?.directExposureTWD).toBe(0);
    expect(exposure?.indirectExposureTWD).toBe(30000);
    expect(exposure?.totalExposureTWD).toBe(30000);
    expect(exposure?.portfolioPercentage).toBeCloseTo(50);
  });

  it("adds an other bucket when component weights are incomplete", () => {
    const rows = [row("0050", 60000, "taiwan_etf")];
    const exposure = calculateETFOnlyAggregateExposure(rows, componentMap).find(
      (item) => item.symbol === "OTHER",
    );

    expect(exposure?.name).toBe("其他");
    expect(exposure?.totalExposureTWD).toBeCloseTo(12000);
    expect(exposure?.portfolioPercentage).toBeCloseTo(20);
  });

  it("adds an unexpanded ETF bucket when a priced ETF has no component data", () => {
    const rows = [
      row("0050", 60000, "taiwan_etf"),
      row("00999", 40000, "taiwan_etf"),
    ];
    const exposure = calculateETFOnlyAggregateExposure(rows, componentMap).find(
      (item) => item.symbol === "UNEXPANDED_ETF",
    );

    expect(exposure?.name).toBe("未展開 ETF");
    expect(exposure?.totalExposureTWD).toBe(40000);
    expect(exposure?.portfolioPercentage).toBeCloseTo(40);
    expect(exposure?.sourceEtfs).toEqual(["00999"]);
  });

  it("skips ETFs with unavailable prices instead of using zero", () => {
    const rows = [
      row("0050", null, "taiwan_etf"),
      row("VOO", null, "us_etf"),
      row("TWD", 80000, "cash"),
    ];

    expect(calculateETFOnlyAggregateExposure(rows, componentMap)).toEqual([]);
  });
});

describe("single ETF composition", () => {
  it("uses selected ETF component weights as the denominator", () => {
    const rows = [row("0050", 60000, "taiwan_etf"), row("TWD", 80000, "cash")];
    const exposure = calculateSingleETFComposition(
      rows.map((item) => item.holding),
      rows,
      "0050",
      componentMap,
    );

    expect(exposure.find((item) => item.symbol === "2330")?.portfolioPercentage).toBeCloseTo(50);
    expect(exposure.find((item) => item.symbol === "2317")?.portfolioPercentage).toBeCloseTo(30);
  });

  it("adds an other bucket for missing selected ETF component weight", () => {
    const rows = [row("0050", 60000, "taiwan_etf")];
    const exposure = calculateSingleETFComposition(
      rows.map((item) => item.holding),
      rows,
      "0050",
      componentMap,
    ).find((item) => item.symbol === "OTHER");

    expect(exposure?.name).toBe("其他");
    expect(exposure?.portfolioPercentage).toBeCloseTo(20);
    expect(exposure?.totalExposureTWD).toBeCloseTo(12000);
  });

  it("returns an empty composition for a US ETF without component data", () => {
    const rows = [row("VOO", 40000, "us_etf")];
    const exposure = calculateSingleETFComposition(
      rows.map((item) => item.holding),
      rows,
      "VOO",
      componentMap,
    );

    expect(exposure).toEqual([]);
  });
});
