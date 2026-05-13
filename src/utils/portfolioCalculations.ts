import type {
  AllocationRow,
  Holding,
  HoldingValue,
  PortfolioSettings,
} from "../types/portfolio";
import { getFxRateToTWD } from "./currency";

export function getHoldingValueTWD(
  holding: Holding,
  settings: PortfolioSettings,
) {
  return (
    holding.quantity *
    holding.currentPrice *
    getFxRateToTWD(holding.currency, settings)
  );
}

export function getHoldingValues(
  holdings: Holding[],
  settings: PortfolioSettings,
): HoldingValue[] {
  return holdings.map((holding) => ({
    holding,
    valueTWD: getHoldingValueTWD(holding, settings),
  }));
}

export function getTotalValueTWD(
  holdings: Holding[],
  settings: PortfolioSettings,
) {
  return getHoldingValues(holdings, settings).reduce(
    (total, row) => total + row.valueTWD,
    0,
  );
}

export function getTopHoldings(
  holdings: Holding[],
  settings: PortfolioSettings,
  limit = 5,
) {
  return getHoldingValues(holdings, settings)
    .sort((a, b) => b.valueTWD - a.valueTWD)
    .slice(0, limit);
}

export function getAllocationBy(
  holdings: Holding[],
  settings: PortfolioSettings,
  keyGetter: (holding: Holding) => string,
  labelGetter: (key: string) => string = (key) => key,
): AllocationRow[] {
  const total = getTotalValueTWD(holdings, settings);
  const grouped = new Map<string, number>();

  for (const holding of holdings) {
    const key = keyGetter(holding);
    grouped.set(
      key,
      (grouped.get(key) ?? 0) + getHoldingValueTWD(holding, settings),
    );
  }

  return Array.from(grouped.entries())
    .map(([key, valueTWD]) => ({
      key,
      label: labelGetter(key),
      valueTWD,
      percentage: total > 0 ? (valueTWD / total) * 100 : 0,
    }))
    .sort((a, b) => b.valueTWD - a.valueTWD);
}

export const assetTypeLabels: Record<string, string> = {
  taiwan_stock: "台股",
  taiwan_etf: "台灣 ETF",
  crypto: "加密貨幣",
  cash: "現金",
  custom: "自訂",
};

export const marketLabels: Record<string, string> = {
  TW: "台灣",
  CRYPTO: "加密貨幣",
  CASH: "現金",
  CUSTOM: "自訂",
};
