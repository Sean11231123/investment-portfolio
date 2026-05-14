import { etfComponentDatasets } from "../data/etfComponents";
import type { AssetMetadata, FxRates, HoldingValue } from "../types/portfolio";
import type { UniverseFileSummary } from "../types/universe";
import { getFxStatus } from "./marketDataStatus";

export type UnifiedStatusKind =
  | "ok"
  | "partial"
  | "unavailable"
  | "runtime"
  | "tracked"
  | "stale";

export type UnifiedStatusRow = {
  id: string;
  name: string;
  status: UnifiedStatusKind;
  statusLabel: string;
  summary: string;
  source?: string;
  generatedAt?: string;
  tradeDate?: string;
  lastUpdated?: string;
  details?: string[];
};

export type UnifiedStatusSection = {
  id: "universe" | "prices" | "etf-components" | "notes";
  title: string;
  rows: UnifiedStatusRow[];
};

type UniverseFile = {
  count?: number;
  generatedAt?: string;
  source?: string;
  assets?: unknown[];
};

export type UnifiedPriceFile = {
  quoteCount?: number;
  pricedCount?: number;
  unavailableCount?: number;
  generatedAt?: string;
  tradeDate?: string;
  source?: string;
  quotes?: Record<
    string,
    {
      price?: number | null;
      status?: string;
      [key: string]: unknown;
    }
  >;
};

type ETFComponentDataset = {
  symbol: string;
  dataQuality?: string;
  lastUpdated?: string;
  asOfDate?: string | null;
};

type UnifiedMarketDataStatusInput = {
  holdingValues?: HoldingValue[];
  universeAssets?: AssetMetadata[];
  universeFiles?: UniverseFileSummary[];
  fxRates: FxRates;
  now?: Date;
  universes?: {
    tw?: UniverseFile | null;
    us?: UniverseFile | null;
    crypto?: UniverseFile | null;
  };
  prices?: {
    tw?: UnifiedPriceFile | null;
    us?: UnifiedPriceFile | null;
  };
  etfDatasets?: ETFComponentDataset[];
};

const statusLabels: Record<UnifiedStatusKind, string> = {
  ok: "正常",
  partial: "部分可用",
  unavailable: "尚未載入",
  runtime: "即時查詢",
  tracked: "追蹤清單",
  stale: "價格可能已過期",
};

export function getUnifiedMarketDataStatus({
  holdingValues = [],
  universeAssets = [],
  universeFiles = [],
  fxRates,
  now = new Date(),
  universes,
  prices,
  etfDatasets = etfComponentDatasets,
}: UnifiedMarketDataStatusInput): UnifiedStatusSection[] {
  const twUniverseRow = summarizeUniverseFile(
    "tw-universe",
    "台股資產清單",
    universes?.tw ?? buildUniverseSummary(universeAssets, universeFiles, "TW"),
    "TWSE ISIN",
  );
  const usUniverseRow = summarizeUniverseFile(
    "us-universe",
    "美股資產清單",
    universes?.us ?? buildUniverseSummary(universeAssets, universeFiles, "US"),
    "Nasdaq Trader",
  );
  const cryptoUniverseRow = summarizeUniverseFile(
    "crypto-universe",
    "加密貨幣清單",
    universes?.crypto ??
      buildUniverseSummary(universeAssets, universeFiles, "CRYPTO"),
    "Binance + CoinGecko",
  );

  const twPriceRow = summarizePriceFile({
    id: "tw-prices",
    name: "台股價格",
    file: prices?.tw,
    sourceLabel: "TWSE",
    detail: "台股價格來自靜態市場資料，缺價資產會維持未提供。",
  });
  const usPriceRow = summarizePriceFile({
    id: "us-prices",
    name: "美股價格",
    file: prices?.us,
    sourceLabel: "Stooq",
    trackedSubset: true,
    detail: "美股價格為精選追蹤清單，非全市場。",
  });
  const cryptoPriceRow = summarizeCryptoRuntimePrices(holdingValues);
  const fxRow = summarizeFxStatus(fxRates, now);
  const etfRow = summarizeEtfComponents(etfDatasets);

  return [
    {
      id: "universe",
      title: "資產宇宙",
      rows: [twUniverseRow, usUniverseRow, cryptoUniverseRow],
    },
    {
      id: "prices",
      title: "價格資料",
      rows: [twPriceRow, usPriceRow, cryptoPriceRow, fxRow],
    },
    {
      id: "etf-components",
      title: "ETF 成分資料",
      rows: [etfRow],
    },
    {
      id: "notes",
      title: "資料說明 / 限制",
      rows: [
        {
          id: "coverage-boundaries",
          name: "覆蓋範圍",
          status: "partial",
          statusLabel: statusLabels.partial,
          summary: "搜尋、價格、ETF 成分是三個獨立層次。",
          details: [
            "可搜尋資產不代表一定有價格。",
            "ETF 有價格不代表一定有成分資料。",
            "缺價會維持未提供，不會用 0 估值。",
          ],
        },
      ],
    },
  ];
}

export function summarizeUniverseFile(
  id: string,
  name: string,
  file: UniverseFile | null | undefined,
  sourceLabel: string,
): UnifiedStatusRow {
  const count = getUniverseCount(file);

  if (!file || count === 0) {
    return {
      id,
      name,
      status: "unavailable",
      statusLabel: statusLabels.unavailable,
      summary: "尚未載入資產清單",
      source: sourceLabel,
    };
  }

  return {
    id,
    name,
    status: "ok",
    statusLabel: statusLabels.ok,
    summary: `${count.toLocaleString("zh-TW")} 筆`,
    source: sourceLabel,
    generatedAt: file.generatedAt,
    details: file.source ? [`來源 ${file.source}`] : undefined,
  };
}

export function summarizePriceFile({
  id,
  name,
  file,
  sourceLabel,
  trackedSubset = false,
  detail,
}: {
  id: string;
  name: string;
  file: UnifiedPriceFile | null | undefined;
  sourceLabel: string;
  trackedSubset?: boolean;
  detail?: string;
}): UnifiedStatusRow {
  if (!file || !file.quotes) {
    return {
      id,
      name,
      status: "unavailable",
      statusLabel: statusLabels.unavailable,
      summary: "靜態市場資料暫時無法取得",
      source: sourceLabel,
    };
  }

  const counts = getPriceCounts(file);
  const hasUnavailable = counts.unavailable > 0;
  const status: UnifiedStatusKind = trackedSubset
    ? "tracked"
    : hasUnavailable
      ? "partial"
      : "ok";

  return {
    id,
    name,
    status,
    statusLabel: statusLabels[status],
    summary: `${counts.priced.toLocaleString("zh-TW")} / ${counts.total.toLocaleString("zh-TW")} 有價格`,
    source: sourceLabel,
    generatedAt: file.generatedAt,
    tradeDate: file.tradeDate,
    details: [
      `${counts.unavailable.toLocaleString("zh-TW")} 筆尚未取得價格`,
      ...(detail ? [detail] : []),
    ],
  };
}

export function summarizeCryptoRuntimePrices(
  holdingValues: HoldingValue[] = [],
): UnifiedStatusRow {
  const heldCryptoCount = holdingValues.filter(
    (row) => row.metadata.market === "CRYPTO",
  ).length;

  return {
    id: "crypto-runtime-prices",
    name: "Crypto 價格",
    status: "runtime",
    statusLabel: statusLabels.runtime,
    summary:
      heldCryptoCount > 0
        ? `${heldCryptoCount.toLocaleString("zh-TW")} 個持倉資產才查詢`
        : "持倉資產才查詢",
    source: "Binance / CoinGecko",
    details: [
      "Binance 即時查詢，CoinGecko 備援。",
      "不會預先載入全部加密貨幣價格。",
    ],
  };
}

export function summarizeFxStatus(
  fxRates: FxRates,
  now: Date = new Date(),
): UnifiedStatusRow {
  const status = getFxStatus(fxRates, now);
  const unifiedStatus: UnifiedStatusKind =
    status.status === "fresh"
      ? "ok"
      : status.status === "cached"
        ? "partial"
        : status.status === "stale"
          ? "stale"
          : "unavailable";

  return {
    id: "fx-rates",
    name: "匯率資料",
    status: unifiedStatus,
    statusLabel: statusLabels[unifiedStatus],
    summary: "使用快取或即時匯率資料",
    source: fxRates.source,
    lastUpdated: fxRates.lastUpdated,
    details: [
      `USD/TWD ${fxRates.usdToTwd.toLocaleString("zh-TW", { maximumFractionDigits: 4 })}`,
      `USDT/TWD ${fxRates.usdtToTwd.toLocaleString("zh-TW", { maximumFractionDigits: 4 })}`,
    ],
  };
}

export function summarizeEtfComponents(
  datasets: ETFComponentDataset[] = etfComponentDatasets,
): UnifiedStatusRow {
  const symbols = datasets.map((dataset) => dataset.symbol).sort();
  const qualitySummary = summarizeComponentQualities(datasets);
  const latestUpdated = datasets
    .map((dataset) => dataset.lastUpdated)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    id: "etf-components",
    name: "ETF 成分",
    status: "partial",
    statusLabel: statusLabels.partial,
    summary:
      symbols.length > 0
        ? `${symbols.join(" / ")} 已展開`
        : "尚未建立成分資料",
    source: "static ETF JSON",
    lastUpdated: latestUpdated,
    details: [
      `${symbols.length.toLocaleString("zh-TW")} 個 ETF component files loaded`,
      qualitySummary,
      "其他 ETF 會顯示為 未展開 ETF，這不是價格失敗。",
    ].filter(Boolean),
  };
}

function getUniverseCount(file: UniverseFile | null | undefined) {
  if (!file) return 0;
  if (typeof file.count === "number") return file.count;
  return Array.isArray(file.assets) ? file.assets.length : 0;
}

function buildUniverseSummary(
  assets: AssetMetadata[],
  files: UniverseFileSummary[],
  market: AssetMetadata["market"],
): UniverseFile | null {
  const file = files.find((item) => item.market === market);
  if (file) {
    return {
      count: file.count,
      generatedAt: file.generatedAt,
      source: file.source,
    };
  }

  const count = assets.filter((asset) => asset.market === market).length;
  return count > 0 ? { count } : null;
}

function getPriceCounts(file: UnifiedPriceFile) {
  const quotes = file.quotes ?? {};
  const values = Object.values(quotes);
  const total = file.quoteCount ?? values.length;
  const priced =
    file.pricedCount ??
    values.filter(
      (quote) =>
        quote.status === "ok" &&
        typeof quote.price === "number" &&
        Number.isFinite(quote.price) &&
        quote.price > 0,
    ).length;
  const unavailable =
    file.unavailableCount ??
    Math.max(0, total - priced);

  return { total, priced, unavailable };
}

function summarizeComponentQualities(datasets: ETFComponentDataset[]) {
  const counts = datasets.reduce<Record<string, number>>((acc, dataset) => {
    const quality = dataset.dataQuality ?? "unknown";
    acc[quality] = (acc[quality] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([quality, count]) => `${quality}: ${count}`)
    .join("，");
}
