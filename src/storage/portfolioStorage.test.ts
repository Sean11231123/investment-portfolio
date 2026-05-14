import { beforeEach, describe, expect, it } from "vitest";
import type { Holding, LegacyHolding } from "../types/portfolio";
import {
  loadHoldings,
  parseImportedPortfolio,
  PORTFOLIO_STORAGE_KEY,
  PORTFOLIO_STORAGE_KEY_V1,
  saveHoldings,
} from "./portfolioStorage";

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

const validHolding: Holding = {
  id: "tw-1",
  type: "taiwan_stock",
  symbol: "2330",
  quantity: 10,
  avgCost: 700,
  note: "test",
};

describe("portfolio import and migration validation", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
  });

  it("accepts valid v2 imports without legacy market fields", () => {
    const result = parseImportedPortfolio({
      version: 2,
      exportedAt: "2026-05-14T00:00:00.000Z",
      holdings: [validHolding],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.holdings).toEqual([validHolding]);
      expect(result.migrated).toBe(false);
    }
  });

  it("rejects invalid v2 imports", () => {
    const cases = [
      { ...validHolding, id: " " },
      { ...validHolding, symbol: " " },
      { ...validHolding, quantity: -1 },
      { ...validHolding, avgCost: -1 },
    ];

    for (const invalidHolding of cases) {
      const result = parseImportedPortfolio({
        version: 2,
        exportedAt: "2026-05-14T00:00:00.000Z",
        holdings: [invalidHolding],
      });

      expect(result.ok).toBe(false);
    }
  });

  it("migrates v1 holdings to the v2 storage shape", () => {
    const legacy: LegacyHolding = {
      ...validHolding,
      name: "台積電",
      currentPrice: 800,
      currency: "TWD",
      market: "TW",
    };
    const result = parseImportedPortfolio([legacy]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migrated).toBe(true);
      expect(result.holdings[0]).toEqual(validHolding);
      expect(result.holdings[0]).not.toHaveProperty("name");
      expect(result.holdings[0]).not.toHaveProperty("currentPrice");
      expect(result.holdings[0]).not.toHaveProperty("currency");
      expect(result.holdings[0]).not.toHaveProperty("market");
    }
  });

  it("does not overwrite stored holdings when an import is invalid", () => {
    saveHoldings([validHolding]);

    const result = parseImportedPortfolio({
      version: 2,
      exportedAt: "2026-05-14T00:00:00.000Z",
      holdings: [{ ...validHolding, quantity: -1 }],
    });
    const stored = JSON.parse(
      globalThis.localStorage.getItem(PORTFOLIO_STORAGE_KEY) ?? "[]",
    );

    expect(result.ok).toBe(false);
    expect(stored).toEqual([validHolding]);
  });

  it("loads and saves migrated v1 holdings without deleting v1 data", () => {
    const legacy: LegacyHolding = {
      ...validHolding,
      name: "台積電",
      currentPrice: 800,
      currency: "TWD",
      market: "TW",
    };
    globalThis.localStorage.setItem(
      PORTFOLIO_STORAGE_KEY_V1,
      JSON.stringify([legacy]),
    );

    const result = loadHoldings();

    expect(result.migrated).toBe(true);
    expect(result.holdings).toEqual([validHolding]);
    expect(globalThis.localStorage.getItem(PORTFOLIO_STORAGE_KEY_V1)).not.toBeNull();
    expect(globalThis.localStorage.getItem(PORTFOLIO_STORAGE_KEY)).not.toBeNull();
  });
});
