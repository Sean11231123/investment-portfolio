import type { AssetMetadata, Market } from "./portfolio";

export type UniverseAsset = AssetMetadata & {
  exchange?: string;
  marketSegment?: "listed" | "otc" | "emerging" | "innovation" | "fund";
  source?: string;
  sourceSymbol?: string;
  stooqSymbol?: string;
  binanceSymbol?: string;
  isETF?: boolean;
  dataQuality?: "official" | "generated" | "manual" | "sample" | "seed" | "unverified";
};

export type UniverseAssetFile = {
  version: 1;
  market: Market;
  source: string;
  generatedAt: string;
  count?: number;
  assets: UniverseAsset[];
  errors?: string[];
};

export type UniverseIndexFile = {
  version: 1;
  datasets: string[];
};

export type UniverseFileSummary = {
  market: Market;
  source: string;
  generatedAt: string;
  count: number;
};

export type AssetUniverseLoadResult = {
  assets: AssetMetadata[];
  status: "loaded" | "partial" | "unavailable";
  errors: string[];
  files?: UniverseFileSummary[];
};
