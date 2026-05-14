import type {
  AssetMetadata,
  AssetType,
  Currency,
  Market,
  PriceSource,
} from "../types/portfolio";
import type {
  AssetUniverseLoadResult,
  UniverseAsset,
  UniverseAssetFile,
  UniverseIndexFile,
} from "../types/universe";
import { normalizeSymbol } from "../data/assetRegistry";

const DEFAULT_DATASETS = [
  "tw-assets.json",
  "us-assets.json",
  "crypto-assets.json",
];

const ASSET_TYPES = new Set<AssetType>([
  "taiwan_stock",
  "taiwan_etf",
  "us_stock",
  "us_etf",
  "crypto",
  "cash",
  "custom",
]);

const MARKETS = new Set<Market>(["TW", "US", "CRYPTO", "CASH", "CUSTOM"]);
const CURRENCIES = new Set<Currency>(["TWD", "USD", "USDT"]);
const PRICE_SOURCES = new Set<PriceSource>([
  "twse",
  "yahoo",
  "coingecko",
  "manual",
  "us_static",
  "cash",
]);

export async function loadAssetUniverse(): Promise<AssetUniverseLoadResult> {
  const errors: string[] = [];
  const basePath = getUniverseBasePath();
  const datasets = await loadUniverseIndex(basePath, errors);
  const assets: AssetMetadata[] = [];

  await Promise.all(
    datasets.map(async (dataset) => {
      try {
        const response = await fetch(`${basePath}${dataset}`, {
          cache: "no-cache",
        });
        if (!response.ok) {
          throw new Error(`${dataset} returned ${response.status}`);
        }

        const parsed = parseUniverseFile(await response.json());
        assets.push(...parsed.assets);
      } catch (error) {
        errors.push(`${dataset}: ${getErrorMessage(error)}`);
      }
    }),
  );

  if (assets.length === 0) {
    return {
      assets: [],
      status: errors.length > 0 ? "unavailable" : "loaded",
      errors,
    };
  }

  return {
    assets,
    status: errors.length > 0 ? "partial" : "loaded",
    errors,
  };
}

export async function loadUniverseIndex(
  basePath = getUniverseBasePath(),
  errors: string[] = [],
): Promise<string[]> {
  try {
    const response = await fetch(`${basePath}index.json`, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`index.json returned ${response.status}`);
    }

    const value = (await response.json()) as UniverseIndexFile;
    if (
      value?.version === 1 &&
      Array.isArray(value.datasets) &&
      value.datasets.every((item) => typeof item === "string" && item.trim())
    ) {
      return value.datasets;
    }

    throw new Error("index.json has an invalid format");
  } catch (error) {
    errors.push(`index.json: ${getErrorMessage(error)}`);
    return DEFAULT_DATASETS;
  }
}

export function parseUniverseFile(value: unknown): UniverseAssetFile {
  if (!value || typeof value !== "object") {
    throw new Error("Universe file must be an object.");
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) {
    throw new Error("Universe file version must be 1.");
  }

  if (!isMarket(candidate.market)) {
    throw new Error("Universe file market is invalid.");
  }

  if (typeof candidate.source !== "string" || !candidate.source.trim()) {
    throw new Error("Universe file source is required.");
  }

  if (
    typeof candidate.generatedAt !== "string" ||
    Number.isNaN(Date.parse(candidate.generatedAt))
  ) {
    throw new Error("Universe file generatedAt is invalid.");
  }

  if (!Array.isArray(candidate.assets)) {
    throw new Error("Universe file assets must be an array.");
  }

  return {
    version: 1,
    market: candidate.market,
    source: candidate.source,
    generatedAt: candidate.generatedAt,
    count: typeof candidate.count === "number" ? candidate.count : undefined,
    assets: candidate.assets.map(parseUniverseAsset),
    errors: Array.isArray(candidate.errors)
      ? candidate.errors.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

function parseUniverseAsset(value: unknown): UniverseAsset {
  if (!value || typeof value !== "object") {
    throw new Error("Universe asset must be an object.");
  }

  const asset = value as Record<string, unknown>;
  if (!isNonEmptyString(asset.symbol)) {
    throw new Error("Universe asset symbol is required.");
  }

  if (!isNonEmptyString(asset.name)) {
    throw new Error(`${asset.symbol}: universe asset name is required.`);
  }

  if (!isAssetType(asset.type)) {
    throw new Error(`${asset.symbol}: universe asset type is invalid.`);
  }

  if (!isMarket(asset.market)) {
    throw new Error(`${asset.symbol}: universe asset market is invalid.`);
  }

  if (!isCurrency(asset.currency)) {
    throw new Error(`${asset.symbol}: universe asset currency is invalid.`);
  }

  if (!isNonEmptyString(asset.unitLabel)) {
    throw new Error(`${asset.symbol}: universe asset unitLabel is required.`);
  }

  if (!isPriceSource(asset.priceSource)) {
    throw new Error(`${asset.symbol}: universe asset priceSource is invalid.`);
  }

  return {
    symbol: normalizeSymbol(asset.symbol),
    name: asset.name.trim(),
    type: asset.type,
    market: asset.market,
    currency: asset.currency,
    unitLabel: asset.unitLabel.trim() as AssetMetadata["unitLabel"],
    priceSource: asset.priceSource,
    aliases: parseStringArray(asset.aliases),
    coingeckoId: optionalString(asset.coingeckoId),
    exchange: optionalString(asset.exchange),
    source: optionalString(asset.source),
    sourceSymbol: optionalString(asset.sourceSymbol),
    stooqSymbol: optionalString(asset.stooqSymbol),
    binanceSymbol: optionalString(asset.binanceSymbol),
    isETF: typeof asset.isETF === "boolean" ? asset.isETF : undefined,
    dataQuality: optionalString(asset.dataQuality) as UniverseAsset["dataQuality"],
  };
}

function getUniverseBasePath() {
  return `${import.meta.env.BASE_URL}data/universe/`;
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  return values.length > 0 ? values : undefined;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAssetType(value: unknown): value is AssetType {
  return ASSET_TYPES.has(value as AssetType);
}

function isMarket(value: unknown): value is Market {
  return MARKETS.has(value as Market);
}

function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.has(value as Currency);
}

function isPriceSource(value: unknown): value is PriceSource {
  return PRICE_SOURCES.has(value as PriceSource);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown universe load error.";
}
