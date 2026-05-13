import type {
  ETFComponentMap,
  ETFExposureRow,
  Holding,
  PortfolioSettings,
} from "../types/portfolio";
import { getHoldingValueTWD, getTotalValueTWD } from "./portfolioCalculations";

type ExposureAccumulator = {
  symbol: string;
  name: string;
  directExposureTWD: number;
  indirectExposureTWD: number;
  sourceEtfs: Set<string>;
};

export function calculateETFExposure(
  holdings: Holding[],
  settings: PortfolioSettings,
  componentMap: ETFComponentMap,
): ETFExposureRow[] {
  const rows = new Map<string, ExposureAccumulator>();
  const totalPortfolioValue = getTotalValueTWD(holdings, settings);

  for (const holding of holdings) {
    const symbol = normalizeSymbol(holding.symbol);
    const valueTWD = getHoldingValueTWD(holding, settings);
    const row = ensureRow(rows, symbol, holding.name);
    row.directExposureTWD += valueTWD;
  }

  for (const holding of holdings) {
    const etfSymbol = normalizeSymbol(holding.symbol);
    const etfData = componentMap[etfSymbol];

    if (!etfData) {
      continue;
    }

    const etfMarketValueTWD = getHoldingValueTWD(holding, settings);

    for (const component of etfData.components) {
      const componentSymbol = normalizeSymbol(component.symbol);
      const row = ensureRow(rows, componentSymbol, component.name);
      row.indirectExposureTWD += etfMarketValueTWD * component.weight;
      row.sourceEtfs.add(etfSymbol);
    }
  }

  return Array.from(rows.values())
    .map((row) => {
      const totalExposureTWD =
        row.directExposureTWD + row.indirectExposureTWD;

      return {
        symbol: row.symbol,
        name: row.name,
        directExposureTWD: row.directExposureTWD,
        indirectExposureTWD: row.indirectExposureTWD,
        totalExposureTWD,
        portfolioPercentage:
          totalPortfolioValue > 0
            ? (totalExposureTWD / totalPortfolioValue) * 100
            : 0,
        sourceEtfs: Array.from(row.sourceEtfs).sort(),
      };
    })
    .filter(
      (row) => row.directExposureTWD > 0 || row.indirectExposureTWD > 0,
    )
    .sort((a, b) => b.totalExposureTWD - a.totalExposureTWD);
}

function ensureRow(
  rows: Map<string, ExposureAccumulator>,
  symbol: string,
  name: string,
) {
  const existing = rows.get(symbol);
  if (existing) {
    if (!existing.name && name) {
      existing.name = name;
    }
    return existing;
  }

  const row: ExposureAccumulator = {
    symbol,
    name,
    directExposureTWD: 0,
    indirectExposureTWD: 0,
    sourceEtfs: new Set<string>(),
  };
  rows.set(symbol, row);
  return row;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}
