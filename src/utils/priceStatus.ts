import type { AssetMetadata, PriceQuote } from "../types/portfolio";

export type PriceReasonCategory =
  | "priced"
  | "cached"
  | "untracked"
  | "provider_unavailable"
  | "source_missing"
  | "stale"
  | "unsupported";

export type PriceReason = {
  category: PriceReasonCategory;
  label: string;
  tone: "success" | "warning" | "danger";
};

const LABELS: Record<PriceReasonCategory, string> = {
  priced: "已取得價格",
  cached: "使用快取價格",
  untracked: "尚未追蹤價格",
  provider_unavailable: "價格取得失敗",
  source_missing: "來源尚無價格",
  stale: "價格可能已過期",
  unsupported: "尚未支援價格來源",
};

export function getPriceReason(
  quote: PriceQuote,
  metadata?: AssetMetadata,
  now = new Date(),
): PriceReason {
  if (quote.status === "cached") {
    return reason("cached");
  }

  if (quote.status === "ok" && quote.price !== null) {
    return isStaleQuote(quote, metadata, now) ? reason("stale") : reason("priced");
  }

  const error = quote.error ?? "";
  if (isProviderFailure(error)) {
    return reason("provider_unavailable");
  }

  if (isSourceMissing(error)) {
    return reason("source_missing");
  }

  if (isUnsupported(metadata, quote, error)) {
    return reason("unsupported");
  }

  if (isUntracked(error, metadata, quote)) {
    return reason("untracked");
  }

  return reason("source_missing");
}

export function getPriceReasonLabel(
  quote: PriceQuote,
  metadata?: AssetMetadata,
  now = new Date(),
) {
  return getPriceReason(quote, metadata, now).label;
}

function reason(category: PriceReasonCategory): PriceReason {
  return {
    category,
    label: LABELS[category],
    tone:
      category === "priced"
        ? "success"
        : category === "cached" || category === "stale"
          ? "warning"
          : "danger",
  };
}

function isUnsupported(
  metadata: AssetMetadata | undefined,
  quote: PriceQuote,
  error: string,
) {
  if (error.includes("尚未支援") || error.includes("手動資料")) {
    return true;
  }
  return metadata?.priceSource === "manual" || quote.source === "manual";
}

function isProviderFailure(error: string) {
  return (
    error.includes("取得失敗") ||
    error.includes("暫時無法取得") ||
    error.includes("returned") ||
    error.includes("invalid") ||
    error.includes("Binance price unavailable") ||
    error.includes("CoinGecko returned")
  );
}

function isSourceMissing(error: string) {
  return (
    error.includes("來源尚無價格") ||
    error.includes("尚未取得台股/ETF") ||
    error.includes("CoinGecko price missing") ||
    error.includes("Binance price missing")
  );
}

function isUntracked(
  error: string,
  metadata: AssetMetadata | undefined,
  quote: PriceQuote,
) {
  if (error.includes("尚未追蹤")) {
    return true;
  }
  return metadata?.priceSource === "us_static" || quote.source === "us_static";
}

function isStaleQuote(
  quote: PriceQuote,
  metadata: AssetMetadata | undefined,
  now: Date,
) {
  const timestamp = quote.tradeDate ?? quote.generatedAt ?? quote.lastUpdated;
  if (!timestamp) {
    return false;
  }

  const ageMs = now.getTime() - Date.parse(timestamp);
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return false;
  }

  const staleHours = metadata?.market === "CRYPTO" ? 6 : 24 * 3;
  return ageMs > staleHours * 60 * 60 * 1000;
}
