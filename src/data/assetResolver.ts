import {
  assetRegistry,
  getAssetMetadata,
  getFallbackMetadata,
  normalizeSymbol,
} from "./assetRegistry";
import type { AssetMetadata, AssetType, Market } from "../types/portfolio";

export type AssetSearchOptions = {
  type?: AssetType;
  limit?: number;
  universeAssets?: AssetMetadata[];
};

export function getResolvedAssetMetadata(
  symbol: string,
  type?: AssetType,
  universeAssets: AssetMetadata[] = [],
) {
  return (
    getAssetMetadata(symbol, type) ??
    findUniverseAsset(symbol, type, universeAssets)
  );
}

export function getResolvedFallbackMetadata(
  symbol: string,
  type: AssetType,
  universeAssets: AssetMetadata[] = [],
) {
  return (
    getResolvedAssetMetadata(symbol, type, universeAssets) ??
    getFallbackMetadata(symbol, type)
  );
}

export function searchResolvedAssets(
  query: string,
  options: AssetSearchOptions = {},
) {
  const { type, limit, universeAssets = [] } = options;
  const normalizedQuery = query.trim().toLowerCase();
  const candidates = getLayeredAssetRegistry(universeAssets).filter((asset) =>
    type ? asset.type === type : true,
  );
  const maxResults = limit ?? (normalizedQuery ? 12 : 8);

  if (!normalizedQuery) {
    return candidates.slice(0, maxResults);
  }

  return candidates
    .filter((asset) => {
      const searchable = [
        asset.symbol,
        asset.name,
        ...(asset.aliases ?? []),
      ].map((item) => item.toLowerCase());
      return searchable.some((item) => item.includes(normalizedQuery));
    })
    .slice(0, maxResults);
}

export function getLayeredAssetRegistry(universeAssets: AssetMetadata[] = []) {
  const byKey = new Map<string, AssetMetadata>();

  for (const asset of assetRegistry) {
    byKey.set(getAssetKey(asset), asset);
  }

  for (const asset of universeAssets) {
    const normalizedAsset = normalizeAsset(asset);
    const key = getAssetKey(normalizedAsset);
    if (!byKey.has(key)) {
      byKey.set(key, normalizedAsset);
    }
  }

  return Array.from(byKey.values());
}

function findUniverseAsset(
  symbol: string,
  type: AssetType | undefined,
  universeAssets: AssetMetadata[],
) {
  const normalized = normalizeSymbol(symbol);
  return universeAssets
    .map(normalizeAsset)
    .find(
      (asset) =>
        asset.symbol === normalized && (type === undefined || asset.type === type),
    );
}

function normalizeAsset(asset: AssetMetadata): AssetMetadata {
  return {
    ...asset,
    symbol: normalizeSymbol(asset.symbol),
  };
}

function getAssetKey(asset: Pick<AssetMetadata, "symbol" | "type" | "market">) {
  return `${asset.market as Market}:${asset.type}:${normalizeSymbol(asset.symbol)}`;
}
