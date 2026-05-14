import { describe, expect, it } from "vitest";
import type { FxRates, Holding, PriceQuote } from "../types/portfolio";
import {
  getAllocationBy,
  getHoldingValue,
  getPortfolioValuation,
} from "./portfolioCalculations";

const fxRates: FxRates = {
  usdToTwd: 32,
  usdtToTwd: 32,
  source: "test",
  lastUpdated: "2026-05-14T00:00:00.000Z",
  status: "ok",
};

function quote(
  symbol: string,
  price: number | null,
  currency: PriceQuote["currency"] = "TWD",
  status: PriceQuote["status"] = price === null ? "unavailable" : "ok",
): PriceQuote {
  return {
    symbol,
    price,
    currency,
    source: "test",
    lastUpdated: "2026-05-14T00:00:00.000Z",
    status,
  };
}

function holding(
  overrides: Partial<Holding> & Pick<Holding, "id" | "type" | "symbol" | "quantity">,
): Holding {
  return overrides;
}

describe("portfolio valuation", () => {
  it("calculates basic TWD valuation", () => {
    const row = getHoldingValue(
      holding({ id: "tw", type: "taiwan_stock", symbol: "2330", quantity: 10 }),
      fxRates,
      { "2330": quote("2330", 800) },
    );

    expect(row.marketValueTWD).toBe(8000);
  });

  it("converts USD crypto valuation to TWD", () => {
    const row = getHoldingValue(
      holding({ id: "btc", type: "crypto", symbol: "BTC", quantity: 0.01 }),
      fxRates,
      { BTC: quote("BTC", 100000, "USD") },
    );

    expect(row.marketValueTWD).toBe(32000);
  });

  it("values cash as quantity times native cash price", () => {
    const row = getHoldingValue(
      holding({ id: "cash", type: "cash", symbol: "TWD", quantity: 10000 }),
      fxRates,
      {},
    );

    expect(row.marketValueTWD).toBe(10000);
  });

  it("keeps unavailable prices as null and marks portfolio partial", () => {
    const valuation = getPortfolioValuation(
      [holding({ id: "tw", type: "taiwan_stock", symbol: "2330", quantity: 10 })],
      fxRates,
      { "2330": quote("2330", null) },
    );

    expect(valuation.holdingValues[0].marketValueTWD).toBeNull();
    expect(valuation.totalValueTWD).toBe(0);
    expect(valuation.unavailableCount).toBe(1);
    expect(valuation.isPartial).toBe(true);
  });

  it("uses only available holdings as allocation denominator", () => {
    const valuation = getPortfolioValuation(
      [
        holding({ id: "tw", type: "taiwan_stock", symbol: "2330", quantity: 10 }),
        holding({ id: "cash", type: "cash", symbol: "TWD", quantity: 10000 }),
        holding({ id: "btc", type: "crypto", symbol: "BTC", quantity: 1 }),
      ],
      fxRates,
      {
        "2330": quote("2330", 800),
        BTC: quote("BTC", null, "USD"),
      },
    );

    const allocation = getAllocationBy(
      valuation.holdingValues,
      (row) => row.metadata.symbol,
    );

    expect(valuation.totalValueTWD).toBe(18000);
    expect(valuation.isPartial).toBe(true);
    expect(allocation.find((row) => row.key === "2330")?.percentage).toBeCloseTo(
      44.4444,
      4,
    );
    expect(allocation.find((row) => row.key === "TWD")?.percentage).toBeCloseTo(
      55.5556,
      4,
    );
  });

  it("calculates PnL only when avgCost exists", () => {
    const withCost = getHoldingValue(
      holding({
        id: "with-cost",
        type: "taiwan_stock",
        symbol: "2330",
        quantity: 10,
        avgCost: 700,
      }),
      fxRates,
      { "2330": quote("2330", 800) },
    );
    const withoutCost = getHoldingValue(
      holding({
        id: "without-cost",
        type: "taiwan_stock",
        symbol: "2330",
        quantity: 10,
      }),
      fxRates,
      { "2330": quote("2330", 800) },
    );

    expect(withCost.costBasisTWD).toBe(7000);
    expect(withCost.pnlTWD).toBe(1000);
    expect(withCost.pnlPercent).toBeCloseTo(14.2857, 4);
    expect(withoutCost.costBasisTWD).toBeNull();
    expect(withoutCost.pnlTWD).toBeNull();
    expect(withoutCost.pnlPercent).toBeNull();
  });
});
