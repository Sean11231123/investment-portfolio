import type {
  FxRates,
  HoldingValue,
  MarketDataFreshness,
  PriceQuote,
} from "../types/portfolio";

export function getMarketDataStatuses(
  holdingValues: HoldingValue[],
  fxRates: FxRates,
  now = new Date(),
): MarketDataFreshness[] {
  return [
    getTaiwanStatus(holdingValues, now),
    getCryptoStatus(holdingValues, now),
    getFxStatus(fxRates, now),
  ];
}

export function getTaiwanStatus(
  holdingValues: HoldingValue[],
  now = new Date(),
): MarketDataFreshness {
  const rows = holdingValues.filter((row) => row.metadata.market === "TW");
  if (rows.length === 0) {
    return {
      category: "tw",
      label: "台股 / ETF",
      status: "fresh",
      message: "目前沒有台股 / ETF 持倉。",
    };
  }

  const okRows = rows.filter((row) => row.quote.status === "ok");
  const unavailableRows = rows.filter(
    (row) => row.quote.status === "unavailable" || row.quote.price === null,
  );
  const errorRows = rows.filter((row) => row.quote.status === "error");
  const cachedRows = rows.filter((row) => row.quote.status === "cached");
  const newestQuote = getNewestQuote(rows);
  const tradeDate = newestQuote?.tradeDate;
  const generatedAt = newestQuote?.generatedAt ?? newestQuote?.lastUpdated;

  if (errorRows.length > 0 && okRows.length === 0 && cachedRows.length === 0) {
    return {
      category: "tw",
      label: "台股 / ETF",
      status: "error",
      source: newestQuote?.source,
      tradeDate,
      generatedAt,
      message: "台股 / ETF 靜態市場資料讀取發生錯誤，估值可能不完整。",
    };
  }

  if (okRows.length === 0 && cachedRows.length === 0) {
    return {
      category: "tw",
      label: "台股 / ETF",
      status: "unavailable",
      source: newestQuote?.source,
      tradeDate,
      generatedAt,
      message: "目前無法取得已持有台股 / ETF 的價格。",
    };
  }

  if (unavailableRows.length > 0) {
    return {
      category: "tw",
      label: "台股 / ETF",
      status: "partial",
      source: newestQuote?.source,
      tradeDate,
      generatedAt,
      message: `${unavailableRows.length} 筆台股 / ETF 持倉缺少價格，投組估值可能不完整。`,
    };
  }

  if (cachedRows.length > 0) {
    return {
      category: "tw",
      label: "台股 / ETF",
      status: "cached",
      source: newestQuote?.source,
      tradeDate,
      generatedAt,
      lastUpdated: newestQuote?.lastUpdated,
      message: "目前使用快取的台股 / ETF 價格。",
    };
  }

  if (tradeDate && daysSince(tradeDate, now) > 3) {
    return {
      category: "tw",
      label: "台股 / ETF",
      status: "stale",
      source: newestQuote?.source,
      tradeDate,
      generatedAt,
      message: "台股 / ETF 交易日已超過 3 天，資料可能因週末或休市而看起來較舊。",
    };
  }

  return {
    category: "tw",
    label: "台股 / ETF",
    status: "fresh",
    source: newestQuote?.source,
    tradeDate,
    generatedAt,
    message: "台股 / ETF 靜態市場資料已載入。",
  };
}

export function getCryptoStatus(
  holdingValues: HoldingValue[],
  now = new Date(),
): MarketDataFreshness {
  const rows = holdingValues.filter((row) => row.metadata.market === "CRYPTO");
  if (rows.length === 0) {
    return {
      category: "crypto",
      label: "Crypto",
      status: "fresh",
      message: "目前沒有 Crypto 持倉。",
    };
  }

  const okRows = rows.filter((row) => row.quote.status === "ok");
  const cachedRows = rows.filter((row) => row.quote.status === "cached");
  const unavailableRows = rows.filter(
    (row) => row.quote.status === "unavailable" || row.quote.price === null,
  );
  const newestQuote = getNewestQuote(rows);

  if (unavailableRows.length === rows.length) {
    return {
      category: "crypto",
      label: "Crypto",
      status: "unavailable",
      source: newestQuote?.source,
      lastUpdated: newestQuote?.lastUpdated,
      message: "目前無法取得 Crypto 價格，可能是來源暫時不可用或 rate limit。",
    };
  }

  if (unavailableRows.length > 0) {
    return {
      category: "crypto",
      label: "Crypto",
      status: "partial",
      source: newestQuote?.source,
      lastUpdated: newestQuote?.lastUpdated,
      message: `${unavailableRows.length} 筆 Crypto 持倉缺少價格。`,
    };
  }

  if (cachedRows.length > 0 && okRows.length === 0) {
    return {
      category: "crypto",
      label: "Crypto",
      status: "cached",
      source: newestQuote?.source,
      lastUpdated: newestQuote?.lastUpdated,
      message: "目前使用快取的 Crypto 價格。",
    };
  }

  if (newestQuote?.lastUpdated && hoursSince(newestQuote.lastUpdated, now) > 6) {
    return {
      category: "crypto",
      label: "Crypto",
      status: "stale",
      source: newestQuote.source,
      lastUpdated: newestQuote.lastUpdated,
      message: "Crypto 價格更新時間較久，可能需要重新整理價格。",
    };
  }

  return {
    category: "crypto",
    label: "Crypto",
    status: "fresh",
    source: newestQuote?.source,
    lastUpdated: newestQuote?.lastUpdated,
    message: "Crypto 價格已載入。",
  };
}

export function getFxStatus(
  fxRates: FxRates,
  now = new Date(),
): MarketDataFreshness {
  if (fxRates.status === "error") {
    return {
      category: "fx",
      label: "匯率",
      status: "error",
      source: fxRates.source,
      lastUpdated: fxRates.lastUpdated,
      message: "匯率資料讀取發生錯誤。",
    };
  }

  if (fxRates.status === "fallback") {
    return {
      category: "fx",
      label: "匯率",
      status: "unavailable",
      source: fxRates.source,
      lastUpdated: fxRates.lastUpdated,
      message: "目前使用可見的預設匯率，請在網路恢復後重新整理。",
    };
  }

  if (fxRates.status === "cached") {
    return {
      category: "fx",
      label: "匯率",
      status:
        fxRates.lastUpdated && daysSince(fxRates.lastUpdated, now) > 3
          ? "stale"
          : "cached",
      source: fxRates.source,
      lastUpdated: fxRates.lastUpdated,
      message: "目前使用快取匯率。",
    };
  }

  if (fxRates.lastUpdated && hoursSince(fxRates.lastUpdated, now) > 24) {
    return {
      category: "fx",
      label: "匯率",
      status: "stale",
      source: fxRates.source,
      lastUpdated: fxRates.lastUpdated,
      message: "匯率更新時間超過 24 小時，可能需要重新整理。",
    };
  }

  return {
    category: "fx",
    label: "匯率",
    status: "fresh",
    source: fxRates.source,
    lastUpdated: fxRates.lastUpdated,
    message: "匯率資料已載入。",
  };
}

function getNewestQuote(rows: HoldingValue[]): PriceQuote | undefined {
  return rows
    .map((row) => row.quote)
    .filter((quote) => quote.lastUpdated || quote.generatedAt || quote.tradeDate)
    .sort((a, b) => {
      const aTime = Date.parse(a.lastUpdated ?? a.generatedAt ?? a.tradeDate ?? "");
      const bTime = Date.parse(b.lastUpdated ?? b.generatedAt ?? b.tradeDate ?? "");
      return safeTime(bTime) - safeTime(aTime);
    })[0];
}

function daysSince(value: string, now: Date) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return Number.POSITIVE_INFINITY;
  }

  return (now.getTime() - time) / (1000 * 60 * 60 * 24);
}

function hoursSince(value: string, now: Date) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return Number.POSITIVE_INFINITY;
  }

  return (now.getTime() - time) / (1000 * 60 * 60);
}

function safeTime(value: number) {
  return Number.isFinite(value) ? value : 0;
}
