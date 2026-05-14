import { assetRegistry, getAssetMetadata } from "../data/assetRegistry";
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

export async function refreshPrices(holdings: Holding[]): Promise<PriceCache> {
  const cached = loadCachedPrices();
  const next: PriceCache = { ...cached };
  const symbols = Array.from(new Set(holdings.map((holding) => holding.symbol)));
  const metadataBySymbol = symbols
    .map((symbol) => getAssetMetadata(symbol))
    .filter((metadata): metadata is AssetMetadata => Boolean(metadata));

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
  ]);

  savePriceCache(next);
  return next;
}

export function getQuoteForHolding(
  holding: Holding,
  priceCache: PriceCache,
): PriceQuote {
  const metadata = getAssetMetadata(holding.symbol, holding.type);
  if (!metadata) {
    return unavailableQuote(
      holding.symbol,
      "manual",
      "找不到資產 metadata，無法估值。",
    );
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
      metadata.priceSource === "coingecko"
        ? "尚未取得 CoinGecko 價格。"
        : "台股/ETF 靜態市場資料尚未取得，且未使用 CORS proxy 或爬蟲。",
    )
  );
}

async function refreshCryptoPrices(
  metadata: AssetMetadata[],
  next: PriceCache,
) {
  const cryptoAssets = metadata.filter(
    (asset) => asset.priceSource === "coingecko" && asset.coingeckoId,
  );
  if (cryptoAssets.length === 0) {
    return;
  }

  const ids = cryptoAssets.map((asset) => asset.coingeckoId).join(",");

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_last_updated_at=true`,
    );
    if (!response.ok) {
      throw new Error(`CoinGecko returned ${response.status}`);
    }

    const data = await response.json();
    const now = new Date().toISOString();

    for (const asset of cryptoAssets) {
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
    for (const asset of cryptoAssets) {
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
        `靜態台股/ETF 市場資料暫時無法取得：${getErrorMessage(error)}`,
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

  return unavailableQuote(asset.symbol, asset.priceSource, error);
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

  return "靜態台股/ETF 市場資料沒有這個代號或價格。";
}

function unavailableQuote(symbol: string, source: string, error: string): PriceQuote {
  const metadata = assetRegistry.find((asset) => asset.symbol === symbol);
  return {
    symbol,
    price: null,
    currency: metadata?.currency ?? "TWD",
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
    typeof candidate.generatedAt === "string" &&
    candidate.quotes !== null &&
    typeof candidate.quotes === "object"
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "價格取得失敗。";
}
