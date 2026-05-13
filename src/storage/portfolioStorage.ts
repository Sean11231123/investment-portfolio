import type { Holding } from "../types/portfolio";

export const PORTFOLIO_STORAGE_KEY =
  "modular-investment-portfolio:v1:holdings";

export function loadHoldings(): Holding[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return validateHoldings(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHoldings(holdings: Holding[]) {
  localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(holdings));
}

export function clearHoldingsStorage() {
  localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
}

export function validateHoldings(value: unknown): value is Holding[] {
  return Array.isArray(value) && value.every(isHolding);
}

function isHolding(value: unknown): value is Holding {
  if (!value || typeof value !== "object") {
    return false;
  }

  const holding = value as Record<string, unknown>;
  const validTypes = ["taiwan_stock", "taiwan_etf", "crypto", "cash", "custom"];
  const validCurrencies = ["TWD", "USD", "USDT"];
  const validMarkets = ["TW", "CRYPTO", "CASH", "CUSTOM"];

  return (
    typeof holding.id === "string" &&
    holding.id.trim().length > 0 &&
    validTypes.includes(String(holding.type)) &&
    typeof holding.symbol === "string" &&
    holding.symbol.trim().length > 0 &&
    typeof holding.name === "string" &&
    holding.name.trim().length > 0 &&
    isNonNegativeNumber(holding.quantity) &&
    (holding.avgCost === undefined || isNonNegativeNumber(holding.avgCost)) &&
    isNonNegativeNumber(holding.currentPrice) &&
    validCurrencies.includes(String(holding.currency)) &&
    validMarkets.includes(String(holding.market)) &&
    (holding.note === undefined || typeof holding.note === "string")
  );
}

function isNonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
