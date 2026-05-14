import { etfComponents } from "../data/etfComponents";
import { getAssetMetadata } from "../data/assetRegistry";
import type {
  AssetType,
  ETFComponentMap,
  ETFExposureRow,
  Holding,
  HoldingValue,
} from "../types/portfolio";

type ExposureAccumulator = {
  symbol: string;
  name: string;
  directExposureTWD: number;
  indirectExposureTWD: number;
  sourceEtfs: Set<string>;
};

export function calculateETFExposure(
  holdingValues: HoldingValue[],
  componentMap: ETFComponentMap = etfComponents,
): ETFExposureRow[] {
  const rows = new Map<string, ExposureAccumulator>();
  const totalPortfolioValue = getTotalAvailableValue(holdingValues);

  for (const row of holdingValues) {
    if (row.marketValueTWD === null) {
      continue;
    }

    const accumulator = ensureRow(rows, row.metadata.symbol, row.metadata.name);
    accumulator.directExposureTWD += row.marketValueTWD;
  }

  for (const row of holdingValues) {
    if (row.marketValueTWD === null) {
      continue;
    }

    const etfSymbol = normalizeSymbol(row.holding.symbol);
    const etfData = componentMap[etfSymbol];
    if (!etfData) {
      continue;
    }

    for (const component of etfData.components) {
      const componentSymbol = normalizeSymbol(component.symbol);
      const metadata = getAssetMetadata(componentSymbol);
      const accumulator = ensureRow(
        rows,
        componentSymbol,
        metadata?.name ?? component.name,
      );
      accumulator.indirectExposureTWD += row.marketValueTWD * component.weight;
      accumulator.sourceEtfs.add(etfSymbol);
    }
  }

  return exposureRowsFromAccumulator(rows, totalPortfolioValue);
}

export function calculateSingleETFExposure(
  holdings: Holding[],
  holdingValues: HoldingValue[],
  etfSymbol: string,
  componentMap: ETFComponentMap = etfComponents,
): ETFExposureRow[] {
  void holdings;
  const normalized = normalizeSymbol(etfSymbol);
  const etfData = componentMap[normalized];
  if (!etfData) {
    return [];
  }

  const totalPortfolioValue = getTotalAvailableValue(holdingValues);
  const etfValueTWD = holdingValues
    .filter((row) => normalizeSymbol(row.holding.symbol) === normalized)
    .reduce((sum, row) => sum + (row.marketValueTWD ?? 0), 0);

  return etfData.components
    .map((component) => {
      const valueTWD = etfValueTWD * component.weight;
      const metadata = getAssetMetadata(component.symbol);

      return {
        symbol: normalizeSymbol(component.symbol),
        name: metadata?.name ?? component.name,
        directExposureTWD: 0,
        indirectExposureTWD: valueTWD,
        totalExposureTWD: valueTWD,
        portfolioPercentage:
          totalPortfolioValue > 0 ? (valueTWD / totalPortfolioValue) * 100 : 0,
        sourceEtfs: [normalized],
      };
    })
    .filter((row) => row.totalExposureTWD > 0)
    .sort((a, b) => b.totalExposureTWD - a.totalExposureTWD);
}

export function calculateETFOnlyAggregateExposure(
  holdingValues: HoldingValue[],
  componentMap: ETFComponentMap = etfComponents,
): ETFExposureRow[] {
  const rows = new Map<string, ExposureAccumulator>();
  const pricedEtfRows = holdingValues.filter(
    (row) => isETFAssetType(row.metadata.type) && row.marketValueTWD !== null,
  );
  const totalEtfValue = pricedEtfRows.reduce(
    (sum, row) => sum + (row.marketValueTWD ?? 0),
    0,
  );

  if (totalEtfValue <= 0) {
    return [];
  }

  for (const row of pricedEtfRows) {
    const etfValueTWD = row.marketValueTWD ?? 0;
    const etfSymbol = normalizeSymbol(row.holding.symbol);
    const etfData = componentMap[etfSymbol];

    if (!etfData) {
      const accumulator = ensureRow(rows, "UNEXPANDED_ETF", "未展開 ETF");
      accumulator.indirectExposureTWD += etfValueTWD;
      accumulator.sourceEtfs.add(etfSymbol);
      continue;
    }

    const componentTotalWeight = getComponentTotalWeight(etfData.components);

    for (const component of etfData.components) {
      const componentSymbol = normalizeSymbol(component.symbol);
      const metadata = getAssetMetadata(componentSymbol);
      const accumulator = ensureRow(
        rows,
        componentSymbol,
        metadata?.name ?? component.name,
      );
      accumulator.indirectExposureTWD += etfValueTWD * component.weight;
      accumulator.sourceEtfs.add(etfSymbol);
    }

    const otherWeight = Math.max(0, 1 - componentTotalWeight);
    if (otherWeight > 0) {
      const accumulator = ensureRow(rows, "OTHER", "其他");
      accumulator.indirectExposureTWD += etfValueTWD * otherWeight;
      accumulator.sourceEtfs.add(etfSymbol);
    }
  }

  return exposureRowsFromAccumulator(rows, totalEtfValue);
}

export function calculateSingleETFComposition(
  holdings: Holding[],
  holdingValues: HoldingValue[],
  etfSymbol: string,
  componentMap: ETFComponentMap = etfComponents,
): ETFExposureRow[] {
  void holdings;
  const normalized = normalizeSymbol(etfSymbol);
  const etfData = componentMap[normalized];
  if (!etfData) {
    return [];
  }

  const etfValueTWD = holdingValues
    .filter((row) => normalizeSymbol(row.holding.symbol) === normalized)
    .filter((row) => isETFAssetType(row.metadata.type))
    .reduce((sum, row) => sum + (row.marketValueTWD ?? 0), 0);
  const componentTotalWeight = getComponentTotalWeight(etfData.components);

  const rows = etfData.components
    .map((component) => {
      const metadata = getAssetMetadata(component.symbol);
      const valueTWD = etfValueTWD * component.weight;

      return {
        symbol: normalizeSymbol(component.symbol),
        name: metadata?.name ?? component.name,
        directExposureTWD: 0,
        indirectExposureTWD: valueTWD,
        totalExposureTWD: valueTWD,
        portfolioPercentage: component.weight * 100,
        sourceEtfs: [normalized],
      } satisfies ETFExposureRow;
    })
    .filter((row) => row.portfolioPercentage > 0);

  const otherWeight = Math.max(0, 1 - componentTotalWeight);
  if (otherWeight > 0) {
    rows.push({
      symbol: "OTHER",
      name: "其他",
      directExposureTWD: 0,
      indirectExposureTWD: etfValueTWD * otherWeight,
      totalExposureTWD: etfValueTWD * otherWeight,
      portfolioPercentage: otherWeight * 100,
      sourceEtfs: [normalized],
    });
  }

  return rows.sort((a, b) => b.portfolioPercentage - a.portfolioPercentage);
}

export function getHeldEtfsWithComponents(holdingValues: HoldingValue[]) {
  const seen = new Set<string>();
  return holdingValues
    .filter(
      (row) =>
        isETFAssetType(row.metadata.type) &&
        etfComponents[normalizeSymbol(row.holding.symbol)],
    )
    .filter((row) => {
      const symbol = normalizeSymbol(row.holding.symbol);
      if (seen.has(symbol)) {
        return false;
      }
      seen.add(symbol);
      return true;
    })
    .map((row) => ({
      symbol: normalizeSymbol(row.holding.symbol),
      name: row.metadata.name,
      hasValue: row.marketValueTWD !== null,
    }));
}

export function isETFAssetType(type: AssetType | string) {
  return type.endsWith("_etf");
}

export function groupSmallExposures(
  rows: ETFExposureRow[],
  topN = 10,
): ETFExposureRow[] {
  if (rows.length <= topN) {
    return rows;
  }

  const top = rows.slice(0, topN);
  const other = rows.slice(topN).reduce(
    (accumulator, row) => {
      accumulator.totalExposureTWD += row.totalExposureTWD;
      accumulator.portfolioPercentage += row.portfolioPercentage;
      accumulator.directExposureTWD += row.directExposureTWD;
      accumulator.indirectExposureTWD += row.indirectExposureTWD;
      return accumulator;
    },
    {
      symbol: "OTHER",
      name: "其他",
      totalExposureTWD: 0,
      portfolioPercentage: 0,
      directExposureTWD: 0,
      indirectExposureTWD: 0,
      sourceEtfs: [],
    } satisfies ETFExposureRow,
  );

  return other.totalExposureTWD > 0 ? [...top, other] : top;
}

function exposureRowsFromAccumulator(
  rows: Map<string, ExposureAccumulator>,
  denominatorTWD: number,
) {
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
          denominatorTWD > 0 ? (totalExposureTWD / denominatorTWD) * 100 : 0,
        sourceEtfs: Array.from(row.sourceEtfs).sort(),
      };
    })
    .filter((row) => row.totalExposureTWD > 0)
    .sort((a, b) => b.totalExposureTWD - a.totalExposureTWD);
}

function getComponentTotalWeight(
  components: ETFComponentMap[string]["components"],
) {
  return components.reduce((sum, component) => sum + component.weight, 0);
}

function getTotalAvailableValue(holdingValues: HoldingValue[]) {
  return holdingValues.reduce(
    (sum, row) => sum + (row.marketValueTWD ?? 0),
    0,
  );
}

function ensureRow(
  rows: Map<string, ExposureAccumulator>,
  symbol: string,
  name: string,
) {
  const normalized = normalizeSymbol(symbol);
  const existing = rows.get(normalized);
  if (existing) {
    return existing;
  }

  const row: ExposureAccumulator = {
    symbol: normalized,
    name,
    directExposureTWD: 0,
    indirectExposureTWD: 0,
    sourceEtfs: new Set<string>(),
  };
  rows.set(normalized, row);
  return row;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}
