export type AssetType =
  | "taiwan_stock"
  | "taiwan_etf"
  | "crypto"
  | "cash"
  | "custom";

export type Currency = "TWD" | "USD" | "USDT";

export type Market = "TW" | "CRYPTO" | "CASH" | "CUSTOM";

export type Holding = {
  id: string;
  type: AssetType;
  symbol: string;
  name: string;
  quantity: number;
  avgCost?: number;
  currentPrice: number;
  currency: Currency;
  market: Market;
  note?: string;
};

export type PortfolioSettings = {
  usdToTwd: number;
  usdtToTwd: number;
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
    lastUpdated: string;
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
  valueTWD: number;
};

export type ETFExposureRow = {
  symbol: string;
  name: string;
  directExposureTWD: number;
  indirectExposureTWD: number;
  totalExposureTWD: number;
  portfolioPercentage: number;
  sourceEtfs: string[];
};
