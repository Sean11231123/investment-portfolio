import { getResolvedAssetMetadata } from "../data/assetResolver";
import type {
  AssetMetadata,
  Currency,
  Holding,
  PriceQuote,
} from "../types/portfolio";

export const PRICE_CACHE_KEY =
  "modular-investment-portfolio:v2:price-cache";

type PriceCache = Record<string, PriceQuote>;

type StaticTwQuote = {
  symbol: string;
  name?: string;
  price: number | null;
  currency: Currency;
  source: string;
  tradeDate?: string | null;
  lastUpdated?: string;
  status: "ok" | "unavailable" | "error";
  error?: string;
};

type StaticTwPriceFile = {
  version: number;
  market: "TW";
  source: string;
  generatedAt: string;
  tradeDate?: string | null;
  currency: "TWD";
  quotes: Record<string, StaticTwQuote>;
  errors?: string[];
};

type StaticUsQuote = {
  symbol: string;
  name?: string;
  price: number | null;
  currency: Currency;
  source: string;
  tradeDate?: string | null;
  lastUpdated?: string;
  status: "ok" | "unavailable" | "error";
  error?: string;
  stooqSymbol?: string;
};

type StaticUsPriceFile = {
  version: number;
  market: "US";
  source: string;
  generatedAt: string;
  tradeDate?: string | null;
  currency: "USD";
  quotes: Record<string, StaticUsQuote>;
  errors?: string[];
};

export function loadCachedPrices(): PriceCache {
  const raw = localStorage.getItem(PRICE_CACHE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return Object.fromEntries(
        Object.entries(parsed as PriceCache).map(([symbol, quote]) => [
          symbol,
          quote.status === "ok" ? { ...quote, status: "cached" } : quote,
        ]),
      );
    }
  } catch {
    return {};
  }

  return {};
}

export function savePriceCache(cache: PriceCache) {
  localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
}

export async function refreshPrices(
  holdings: Holding[],
  universeAssets: AssetMetadata[] = [],
): Promise<PriceCache> {
  const cached = loadCachedPrices();
  const next: PriceCache = { ...cached };
  const metadataBySymbol = dedupeMetadata(
    holdings
      .map((holding) =>
        getResolvedAssetMetadata(
          holding.symbol,
          holding.type,
          universeAssets,
        ),
      )
      .filter((metadata): metadata is AssetMetadata => Boolean(metadata)),
  );

  for (const metadata of metadataBySymbol.filter(
    (asset) => asset.priceSource === "cash",
  )) {
    next[metadata.symbol] = {
      symbol: metadata.symbol,
      price: 1,
      currency: metadata.currency,
      source: "cash",
      lastUpdated: new Date().toISOString(),
      status: "ok",
    };
  }

  await Promise.all([
    refreshCryptoPrices(metadataBySymbol, next),
    refreshStaticTaiwanPrices(metadataBySymbol, next),
    refreshStaticUsPrices(metadataBySymbol, next),
  ]);

  savePriceCache(next);
  return next;
}

export function getQuoteForHolding(
  holding: Holding,
  priceCache: PriceCache,
  universeAssets: AssetMetadata[] = [],
): PriceQuote {
  const metadata = getResolvedAssetMetadata(
    holding.symbol,
    holding.type,
    universeAssets,
  );
  if (!metadata) {
    return unavailableQuote(holding.symbol, "manual", "尚未支援價格來源。");
  }

  if (metadata.priceSource === "cash") {
    return {
      symbol: metadata.symbol,
      price: 1,
      currency: metadata.currency,
      source: "cash",
      status: "ok",
      lastUpdated: new Date().toISOString(),
    };
  }

  return (
    priceCache[metadata.symbol] ??
    unavailableQuote(
      metadata.symbol,
      metadata.priceSource,
      getUnavailablePriceMessage(metadata),
      metadata.currency,
    )
  );
}

async function refreshCryptoPrices(
  metadata: AssetMetadata[],
  next: PriceCache,
) {
  const cryptoAssets = metadata.filter((asset) => asset.type === "crypto");
  if (cryptoAssets.length === 0) {
    return;
  }

  const binanceAssets = cryptoAssets.filter((asset) => asset.binanceSymbol);
  const coingeckoAssets = cryptoAssets.filter(
    (asset) => !asset.binanceSymbol && asset.priceSource === "coingecko" && asset.coingeckoId,
  );

  const binanceFallbackAssets = await refreshBinanceCryptoPrices(
    binanceAssets,
    next,
  );

  await refreshCoinGeckoPrices(
    dedupeMetadata([...coingeckoAssets, ...binanceFallbackAssets]),
    next,
  );
}

async function refreshBinanceCryptoPrices(
  assets: AssetMetadata[],
  next: PriceCache,
) {
  if (assets.length === 0) {
    return [];
  }

  const failedAssets = new Set<AssetMetadata>(assets);
  const symbols = assets.map((asset) => asset.binanceSymbol!);

  try {
    const params = new URLSearchParams({
      symbols: JSON.stringify(symbols),
    });
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?${params.toString()}`,
    );
    if (!response.ok) {
      throw new Error(`Binance returned ${response.status}`);
    }

    const data = await response.json();
    const rows = Array.isArray(data) ? data : [data];
    const bySymbol = new Map(
      rows
        .filter((row): row is { symbol: string; price: unknown } =>
          Boolean(row && typeof row === "object" && "symbol" in row),
        )
        .map((row) => [String(row.symbol).toUpperCase(), row]),
    );
    const now = new Date().toISOString();

    for (const asset of assets) {
      const row = bySymbol.get(asset.binanceSymbol!.toUpperCase());
      const price = parsePositiveNumber(row?.price);
      if (price === null) {
        continue;
      }

      next[asset.symbol] = {
        symbol: asset.symbol,
        price,
        currency: asset.currency,
        source: "Binance",
        lastUpdated: now,
        status: "ok",
      };
      failedAssets.delete(asset);
    }
  } catch (error) {
    for (const asset of assets.filter((item) => !item.coingeckoId)) {
      next[asset.symbol] = fallbackQuote(
        asset,
        next,
        `Binance 價格取得失敗，且沒有可用備援來源。${getErrorMessage(error)}`,
      );
    }
    return assets.filter((asset) => asset.coingeckoId);
  }

  const fallbackAssets = Array.from(failedAssets);
  for (const asset of fallbackAssets.filter((item) => !item.coingeckoId)) {
    next[asset.symbol] = fallbackQuote(
      asset,
      next,
      `來源尚無價格：Binance 未回傳 ${asset.binanceSymbol} 價格。`,
    );
  }

  return fallbackAssets.filter((asset) => asset.coingeckoId);
}

async function refreshCoinGeckoPrices(
  cryptoAssets: AssetMetadata[],
  next: PriceCache,
) {
  const coingeckoAssets = cryptoAssets.filter((asset) => asset.coingeckoId);
  if (coingeckoAssets.length === 0) {
    return;
  }

  const ids = coingeckoAssets.map((asset) => asset.coingeckoId).join(",");

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_last_updated_at=true`,
    );
    if (!response.ok) {
      throw new Error(`CoinGecko returned ${response.status}`);
    }

    const data = await response.json();
    const now = new Date().toISOString();

    for (const asset of coingeckoAssets) {
      const id = asset.coingeckoId!;
      const price = Number(data[id]?.usd);
      const lastUpdatedAt = Number(data[id]?.last_updated_at);

      if (Number.isFinite(price) && price > 0) {
        next[asset.symbol] = {
          symbol: asset.symbol,
          price,
          currency: "USD",
          source: "CoinGecko",
          lastUpdated: Number.isFinite(lastUpdatedAt)
            ? new Date(lastUpdatedAt * 1000).toISOString()
            : now,
          status: "ok",
        };
      } else {
        next[asset.symbol] = fallbackQuote(
          asset,
          next,
          "CoinGecko price missing.",
        );
      }
    }
  } catch (error) {
    for (const asset of coingeckoAssets) {
      next[asset.symbol] = fallbackQuote(asset, next, getErrorMessage(error));
    }
  }
}

async function refreshStaticTaiwanPrices(
  metadata: AssetMetadata[],
  next: PriceCache,
) {
  const twAssets = metadata.filter(
    (item) => item.priceSource === "yahoo" || item.priceSource === "twse",
  );
  if (twAssets.length === 0) {
    return;
  }

  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}data/market/tw-prices.json`,
      { cache: "no-cache" },
    );
    if (!response.ok) {
      throw new Error(`Static Taiwan price file returned ${response.status}`);
    }

    const data = (await response.json()) as StaticTwPriceFile;
    if (!isStaticTwPriceFile(data)) {
      throw new Error("Static Taiwan price file has an invalid format.");
    }

    for (const asset of twAssets) {
      const quote = data.quotes[asset.symbol];
      if (quote && Number.isFinite(quote.price) && Number(quote.price) > 0) {
        next[asset.symbol] = {
          symbol: asset.symbol,
          price: Number(quote.price),
          currency: "TWD",
          source: "static-tw-market-json",
          tradeDate: quote.tradeDate ?? data.tradeDate ?? undefined,
          generatedAt: data.generatedAt,
          lastUpdated: quote.lastUpdated ?? data.generatedAt,
          status: "ok",
        };
        continue;
      }

      next[asset.symbol] = fallbackQuote(
        asset,
        next,
        getStaticTaiwanError(quote, data),
      );
    }
  } catch (error) {
    for (const asset of twAssets) {
      next[asset.symbol] = fallbackQuote(
        asset,
        next,
        `台股/ETF 靜態市場資料暫時無法取得。${getErrorMessage(error)}`,
      );
    }
  }
}

async function refreshStaticUsPrices(
  metadata: AssetMetadata[],
  next: PriceCache,
) {
  const usAssets = metadata.filter((item) => item.priceSource === "us_static");
  if (usAssets.length === 0) {
    return;
  }

  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}data/market/us-prices.json`,
      { cache: "no-cache" },
    );
    if (!response.ok) {
      throw new Error(`Static US price file returned ${response.status}`);
    }

    const data = (await response.json()) as StaticUsPriceFile;
    if (!isStaticUsPriceFile(data)) {
      throw new Error("Static US price file has an invalid format.");
    }

    for (const asset of usAssets) {
      const quote = data.quotes[asset.symbol];
      if (quote && Number.isFinite(quote.price) && Number(quote.price) > 0) {
        next[asset.symbol] = {
          symbol: asset.symbol,
          price: Number(quote.price),
          currency: "USD",
          source: "static-us-market-json",
          tradeDate: quote.tradeDate ?? data.tradeDate ?? undefined,
          generatedAt: data.generatedAt,
          lastUpdated: quote.lastUpdated ?? data.generatedAt,
          status: "ok",
        };
        continue;
      }

      next[asset.symbol] = fallbackQuote(
        asset,
        next,
        getStaticUsError(quote, data),
      );
    }
  } catch (error) {
    for (const asset of usAssets) {
      next[asset.symbol] = fallbackQuote(
        asset,
        next,
        `美股 / 美股 ETF 靜態市場資料暫時無法取得。${getErrorMessage(error)}`,
      );
    }
  }
}

function fallbackQuote(asset: AssetMetadata, cache: PriceCache, error: string) {
  const cached = cache[asset.symbol];
  if (cached?.price) {
    return {
      ...cached,
      status: "cached" as const,
      error,
    };
  }

  return unavailableQuote(asset.symbol, asset.priceSource, error, asset.currency);
}

function parsePositiveNumber(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function getUnavailablePriceMessage(metadata: AssetMetadata) {
  if (metadata.priceSource === "coingecko") {
    return "尚未取得 CoinGecko 價格。";
  }

  if (metadata.priceSource === "manual") {
    return "此資產目前使用手動資料，尚未設定價格來源。";
  }

  if (metadata.priceSource === "us_static") {
    return "尚未追蹤美股 / 美股 ETF 價格。";
  }

  if (metadata.priceSource === "tpex_otc") {
    return "尚未追蹤上櫃股票/ETF 價格。";
  }

  if (metadata.priceSource === "twse" || metadata.priceSource === "yahoo") {
    return "尚未取得台股/ETF 價格。";
  }

  return "尚未支援價格來源。";
}

function getStaticTaiwanError(
  quote: StaticTwQuote | undefined,
  data: StaticTwPriceFile,
) {
  if (quote?.error) {
    return quote.error;
  }

  if (data.errors && data.errors.length > 0) {
    return data.errors.join("; ");
  }

  if (quote?.status === "unavailable") {
    return "來源尚無價格：尚未取得台股/ETF 價格。";
  }

  return "尚未取得台股/ETF 價格。";
}

function getStaticUsError(
  quote: StaticUsQuote | undefined,
  data: StaticUsPriceFile,
) {
  if (quote?.error) {
    return quote.error;
  }

  if (data.errors && data.errors.length > 0) {
    return data.errors.join("; ");
  }

  if (quote?.status === "unavailable") {
    return "來源尚無價格：尚未取得美股 / 美股 ETF 價格。";
  }

  return "尚未追蹤美股 / 美股 ETF 價格。";
}

function unavailableQuote(
  symbol: string,
  source: string,
  error: string,
  currency: Currency = "TWD",
): PriceQuote {
  return {
    symbol,
    price: null,
    currency,
    source,
    status: "unavailable",
    error,
  };
}

function isStaticTwPriceFile(value: unknown): value is StaticTwPriceFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as StaticTwPriceFile;
  return (
    candidate.version === 1 &&
    candidate.market === "TW" &&
    candidate.currency === "TWD" &&
    candidate.quotes !== null &&
    typeof candidate.generatedAt === "string" &&
    typeof candidate.quotes === "object"
  );
}

function isStaticUsPriceFile(value: unknown): value is StaticUsPriceFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as StaticUsPriceFile;
  return (
    candidate.version === 1 &&
    candidate.market === "US" &&
    candidate.currency === "USD" &&
    candidate.quotes !== null &&
    typeof candidate.generatedAt === "string" &&
    typeof candidate.quotes === "object"
  );
}

function dedupeMetadata(metadata: AssetMetadata[]) {
  const byKey = new Map<string, AssetMetadata>();
  for (const asset of metadata) {
    byKey.set(`${asset.market}:${asset.type}:${asset.symbol}`, asset);
  }
  return Array.from(byKey.values());
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "價格取得失敗。";
}
