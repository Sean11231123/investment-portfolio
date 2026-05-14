export type AssetType =
  | "taiwan_stock"
  | "taiwan_etf"
  | "us_stock"
  | "us_etf"
  | "crypto"
  | "cash"
  | "custom";

export type Currency = "TWD" | "USD" | "USDT";

export type Market = "TW" | "US" | "CRYPTO" | "CASH" | "CUSTOM";

export type PriceSource =
  | "twse"
  | "yahoo"
  | "coingecko"
  | "manual"
  | "cash";

export type Holding = {
  id: string;
  type: AssetType;
  symbol: string;
  quantity: number;
  avgCost?: number;
  note?: string;
};

export type LegacyHolding = Holding & {
  name: string;
  currentPrice: number;
  currency: Currency;
  market: Market;
};

export type AssetMetadata = {
  symbol: string;
  name: string;
  type: AssetType;
  market: Market;
  currency: Currency;
  unitLabel: "股" | "顆" | "金額" | "單位";
  priceSource: PriceSource;
  aliases?: string[];
  coingeckoId?: string;
};

export type PortfolioSettings = {
  displayCurrency: Currency;
  backup?: {
    lastExportedAt?: string;
    lastImportedAt?: string;
    lastImportHoldingCount?: number;
  };
};

export type FxRates = {
  usdToTwd: number;
  usdtToTwd: number;
  source: string;
  lastUpdated?: string;
  status: "ok" | "cached" | "fallback" | "error";
  error?: string;
};

export type PriceQuote = {
  symbol: string;
  price: number | null;
  currency: Currency;
  source: string;
  lastUpdated?: string;
  tradeDate?: string;
  generatedAt?: string;
  status: "ok" | "cached" | "unavailable" | "error";
  error?: string;
};

export type MarketDataFreshness = {
  category: "tw" | "crypto" | "fx";
  label: string;
  status: "fresh" | "stale" | "cached" | "partial" | "unavailable" | "error";
  source?: string;
  tradeDate?: string;
  generatedAt?: string;
  lastUpdated?: string;
  message: string;
};

export type ETFComponent = {
  symbol: string;
  name: string;
  weight: number;
};

export type ETFComponentMap = {
  [etfSymbol: string]: {
    name: string;
    sourceNote: string;
    sourceUrl?: string;
    lastUpdated: string;
    dataQuality?: "sample" | "manual" | "verified" | "stale";
    componentCount?: number;
    totalWeight?: number;
    components: ETFComponent[];
  };
};

export type AllocationRow = {
  key: string;
  label: string;
  valueTWD: number;
  percentage: number;
};

export type HoldingValue = {
  holding: Holding;
  metadata: AssetMetadata;
  quote: PriceQuote;
  marketValueTWD: number | null;
  costBasisTWD: number | null;
  pnlTWD: number | null;
  pnlPercent: number | null;
};

export type ETFExposureRow = {
  symbol: string;
  name: string;
  totalExposureTWD: number;
  portfolioPercentage: number;
  directExposureTWD: number;
  indirectExposureTWD: number;
  sourceEtfs: string[];
};

export type PortfolioExportV2 = {
  version: 2;
  exportedAt: string;
  holdings: Holding[];
  settings?: PortfolioSettings;
};

export type ImportResult =
  | { ok: true; holdings: Holding[]; settings?: PortfolioSettings; migrated: boolean }
  | { ok: false; error: string };
