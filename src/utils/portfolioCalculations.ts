import {
  assetTypeLabels,
  getFallbackMetadata,
} from "../data/assetRegistry";
import { getResolvedAssetMetadata } from "../data/assetResolver";
import { getFxRateToTWD } from "../services/fxService";
import { getQuoteForHolding } from "../services/priceService";
import type {
  AllocationRow,
  AssetMetadata,
  Holding,
  HoldingValue,
  FxRates,
  PriceQuote,
} from "../types/portfolio";

export type PortfolioValuation = {
  holdingValues: HoldingValue[];
  totalValueTWD: number;
  unavailableCount: number;
  isPartial: boolean;
};

export function getHoldingValue(
  holding: Holding,
  fxRates: FxRates,
  priceCache: Record<string, PriceQuote>,
  universeAssets: AssetMetadata[] = [],
): HoldingValue {
  const metadata =
    getResolvedAssetMetadata(holding.symbol, holding.type, universeAssets) ??
    getFallbackMetadata(holding.symbol, holding.type);
  const quote = getQuoteForHolding(holding, priceCache, universeAssets);
  const marketValueTWD =
    quote.price === null
      ? null
      : holding.quantity * quote.price * getFxRateToTWD(metadata.currency, fxRates);
  const costBasisTWD =
    holding.avgCost === undefined || holding.type === "cash"
      ? null
      : holding.quantity *
        holding.avgCost *
        getFxRateToTWD(metadata.currency, fxRates);
  const pnlTWD =
    marketValueTWD !== null && costBasisTWD !== null
      ? marketValueTWD - costBasisTWD
      : null;

  return {
    holding,
    metadata,
    quote,
    marketValueTWD,
    costBasisTWD,
    pnlTWD,
    pnlPercent:
      pnlTWD !== null && costBasisTWD !== null && costBasisTWD > 0
        ? (pnlTWD / costBasisTWD) * 100
        : null,
  };
}

export function getPortfolioValuation(
  holdings: Holding[],
  fxRates: FxRates,
  priceCache: Record<string, PriceQuote>,
  universeAssets: AssetMetadata[] = [],
): PortfolioValuation {
  const holdingValues = holdings.map((holding) =>
    getHoldingValue(holding, fxRates, priceCache, universeAssets),
  );
  const totalValueTWD = holdingValues.reduce(
    (total, row) => total + (row.marketValueTWD ?? 0),
    0,
  );
  const unavailableCount = holdingValues.filter(
    (row) => row.marketValueTWD === null,
  ).length;

  return {
    holdingValues,
    totalValueTWD,
    unavailableCount,
    isPartial: unavailableCount > 0,
  };
}

export function getTopHoldings(holdingValues: HoldingValue[], limit = 5) {
  return holdingValues
    .filter((row) => row.marketValueTWD !== null)
    .sort((a, b) => (b.marketValueTWD ?? 0) - (a.marketValueTWD ?? 0))
    .slice(0, limit);
}

export function getAllocationBy(
  holdingValues: HoldingValue[],
  keyGetter: (row: HoldingValue) => string,
  labelGetter: (key: string) => string = (key) => key,
): AllocationRow[] {
  const total = holdingValues.reduce(
    (sum, row) => sum + (row.marketValueTWD ?? 0),
    0,
  );
  const grouped = new Map<string, number>();

  for (const row of holdingValues) {
    if (row.marketValueTWD === null) {
      continue;
    }

    const key = keyGetter(row);
    grouped.set(key, (grouped.get(key) ?? 0) + row.marketValueTWD);
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

export function getMetadataForHolding(
  holding: Holding,
  universeAssets: AssetMetadata[] = [],
): AssetMetadata {
  return (
    getResolvedAssetMetadata(holding.symbol, holding.type, universeAssets) ??
    getFallbackMetadata(holding.symbol, holding.type)
  );
}

export { assetTypeLabels };

export const marketLabels: Record<string, string> = {
  TW: "台灣",
  US: "美國",
  CRYPTO: "Crypto",
  CASH: "現金",
  CUSTOM: "自訂",
};
