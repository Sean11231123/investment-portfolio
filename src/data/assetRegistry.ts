import type { AssetMetadata, AssetType } from "../types/portfolio";

export const assetRegistry: AssetMetadata[] = [
  {
    symbol: "2330",
    name: "台積電",
    type: "taiwan_stock",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    aliases: ["TSMC", "台灣積體電路"],
  },
  {
    symbol: "2317",
    name: "鴻海",
    type: "taiwan_stock",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    aliases: ["Hon Hai", "Foxconn"],
  },
  {
    symbol: "2454",
    name: "聯發科",
    type: "taiwan_stock",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    aliases: ["MediaTek"],
  },
  {
    symbol: "2308",
    name: "台達電",
    type: "taiwan_stock",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    aliases: ["Delta"],
  },
  {
    symbol: "0050",
    name: "元大台灣50",
    type: "taiwan_etf",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    aliases: ["元大台灣五十", "台灣50"],
  },
  {
    symbol: "006208",
    name: "富邦台50",
    type: "taiwan_etf",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    aliases: ["富邦台灣50"],
  },
  {
    symbol: "00646",
    name: "元大S&P500",
    type: "taiwan_etf",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    aliases: ["S&P500", "標普500"],
  },
  {
    symbol: "0056",
    name: "元大高股息",
    type: "taiwan_etf",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    aliases: ["高股息"],
  },
  {
    symbol: "00878",
    name: "國泰永續高股息",
    type: "taiwan_etf",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    aliases: ["永續高股息"],
  },
  {
    symbol: "00919",
    name: "群益台灣精選高息",
    type: "taiwan_etf",
    market: "TW",
    currency: "TWD",
    unitLabel: "股",
    priceSource: "yahoo",
    aliases: ["精選高息"],
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    type: "crypto",
    market: "CRYPTO",
    currency: "USD",
    unitLabel: "顆",
    priceSource: "coingecko",
    aliases: ["比特幣"],
    coingeckoId: "bitcoin",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    type: "crypto",
    market: "CRYPTO",
    currency: "USD",
    unitLabel: "顆",
    priceSource: "coingecko",
    aliases: ["以太幣"],
    coingeckoId: "ethereum",
  },
  {
    symbol: "SOL",
    name: "Solana",
    type: "crypto",
    market: "CRYPTO",
    currency: "USD",
    unitLabel: "顆",
    priceSource: "coingecko",
    coingeckoId: "solana",
  },
  {
    symbol: "SUI",
    name: "Sui",
    type: "crypto",
    market: "CRYPTO",
    currency: "USD",
    unitLabel: "顆",
    priceSource: "coingecko",
    coingeckoId: "sui",
  },
  {
    symbol: "USDT",
    name: "Tether",
    type: "crypto",
    market: "CRYPTO",
    currency: "USDT",
    unitLabel: "顆",
    priceSource: "coingecko",
    aliases: ["Tether USDt"],
    coingeckoId: "tether",
  },
  {
    symbol: "TWD",
    name: "台幣現金",
    type: "cash",
    market: "CASH",
    currency: "TWD",
    unitLabel: "金額",
    priceSource: "cash",
  },
  {
    symbol: "USD",
    name: "美元現金",
    type: "cash",
    market: "CASH",
    currency: "USD",
    unitLabel: "金額",
    priceSource: "cash",
  },
  {
    symbol: "USDT-CASH",
    name: "USDT 現金",
    type: "cash",
    market: "CASH",
    currency: "USDT",
    unitLabel: "金額",
    priceSource: "cash",
    aliases: ["USDT 現金"],
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    type: "us_stock",
    market: "US",
    currency: "USD",
    unitLabel: "股",
    priceSource: "manual",
    aliases: ["蘋果", "Apple"],
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    type: "us_stock",
    market: "US",
    currency: "USD",
    unitLabel: "股",
    priceSource: "manual",
    aliases: ["微軟", "Microsoft"],
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    type: "us_stock",
    market: "US",
    currency: "USD",
    unitLabel: "股",
    priceSource: "manual",
    aliases: ["輝達", "NVIDIA", "Nvidia"],
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    type: "us_stock",
    market: "US",
    currency: "USD",
    unitLabel: "股",
    priceSource: "manual",
    aliases: ["特斯拉", "Tesla"],
  },
  {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    type: "us_etf",
    market: "US",
    currency: "USD",
    unitLabel: "股",
    priceSource: "manual",
    aliases: ["S&P 500", "標普500", "標普 500"],
  },
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    type: "us_etf",
    market: "US",
    currency: "USD",
    unitLabel: "股",
    priceSource: "manual",
    aliases: ["S&P 500", "標普500", "標普 500"],
  },
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    type: "us_etf",
    market: "US",
    currency: "USD",
    unitLabel: "股",
    priceSource: "manual",
    aliases: ["Nasdaq 100", "NASDAQ 100", "那斯達克100"],
  },
  {
    symbol: "VT",
    name: "Vanguard Total World Stock ETF",
    type: "us_etf",
    market: "US",
    currency: "USD",
    unitLabel: "股",
    priceSource: "manual",
    aliases: ["全球股票", "全球股市"],
  },
  {
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    type: "us_etf",
    market: "US",
    currency: "USD",
    unitLabel: "股",
    priceSource: "manual",
    aliases: ["美股大盤", "美國全市場"],
  },
];

export function getAssetMetadata(symbol: string, type?: AssetType) {
  const normalized = normalizeSymbol(symbol);
  return assetRegistry.find(
    (asset) =>
      asset.symbol === normalized && (type === undefined || asset.type === type),
  );
}

export function searchAssets(query: string, type?: AssetType) {
  const normalized = query.trim().toLowerCase();
  const candidates = type
    ? assetRegistry.filter((asset) => asset.type === type)
    : assetRegistry;

  if (!normalized) {
    return candidates.slice(0, 8);
  }

  return candidates
    .filter((asset) => {
      const searchable = [
        asset.symbol,
        asset.name,
        ...(asset.aliases ?? []),
      ].map((item) => item.toLowerCase());
      return searchable.some((item) => item.includes(normalized));
    })
    .slice(0, 12);
}

export function getFallbackMetadata(symbol: string, type: AssetType): AssetMetadata {
  const normalized = normalizeSymbol(symbol);

  return {
    symbol: normalized,
    name: `${normalized} 自訂資產`,
    type: "custom",
    market: "CUSTOM",
    currency: "TWD",
    unitLabel: "單位",
    priceSource: "manual",
  };
}

export function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export const assetTypeLabels: Record<AssetType, string> = {
  taiwan_stock: "台股",
  taiwan_etf: "台股 ETF",
  us_stock: "美股",
  us_etf: "美股 ETF",
  crypto: "Crypto",
  cash: "現金",
  custom: "自訂",
};
