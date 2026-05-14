import { useEffect, useState } from "react";
import type { AssetMetadata, FxRates, HoldingValue } from "../types/portfolio";
import type { UniverseFileSummary } from "../types/universe";
import { formatDateTime } from "../utils/format";
import {
  getUnifiedMarketDataStatus,
  type UnifiedPriceFile,
  type UnifiedStatusKind,
  type UnifiedStatusRow,
} from "../utils/unifiedMarketDataStatus";
import { AppBadge, AppCard, appMutedSurface } from "./ui";

type MarketDataStatusCardProps = {
  holdingValues: HoldingValue[];
  fxRates: FxRates;
  universeAssets?: AssetMetadata[];
  universeFiles?: UniverseFileSummary[];
};

export function MarketDataStatusCard({
  holdingValues,
  fxRates,
  universeAssets = [],
  universeFiles = [],
}: MarketDataStatusCardProps) {
  const priceFiles = useStaticPriceStatusFiles();
  const sections = getUnifiedMarketDataStatus({
    holdingValues,
    universeAssets,
    universeFiles,
    fxRates,
    prices: priceFiles,
  });

  return (
    <AppCard>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-slate-50">市場資料狀態</h2>
        <p className="text-xs text-slate-400">
          搜尋清單、價格資料與 ETF 成分資料分開追蹤。
        </p>
      </div>

      <div className="mt-5 space-y-5">
        {sections.map((section) => (
          <section key={section.id} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">
              {section.title}
            </h3>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {section.rows.map((row) => (
                <StatusItem key={row.id} row={row} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppCard>
  );
}

function useStaticPriceStatusFiles() {
  const [priceFiles, setPriceFiles] = useState<{
    tw?: UnifiedPriceFile | null;
    us?: UnifiedPriceFile | null;
  }>({});

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadStaticPriceFile("data/market/tw-prices.json"),
      loadStaticPriceFile("data/market/us-prices.json"),
    ]).then(([tw, us]) => {
      if (!cancelled) {
        setPriceFiles({ tw, us });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return priceFiles;
}

async function loadStaticPriceFile(path: string) {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${path}`, {
      cache: "no-cache",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as UnifiedPriceFile;
  } catch {
    return null;
  }
}

function StatusItem({ row }: { row: UnifiedStatusRow }) {
  return (
    <div className={`rounded-2xl p-4 ${appMutedSurface}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium text-slate-100">{row.name}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            {row.summary}
          </p>
        </div>
        <AppBadge tone={getStatusTone(row.status)} className="shrink-0">
          {row.statusLabel}
        </AppBadge>
      </div>

      <dl className="mt-3 space-y-1 text-xs text-slate-400">
        {row.source ? <Info label="來源" value={row.source} /> : null}
        {row.tradeDate ? <Info label="交易日" value={row.tradeDate} /> : null}
        {row.generatedAt ? (
          <Info label="產生時間" value={formatDateTime(row.generatedAt)} />
        ) : null}
        {row.lastUpdated ? (
          <Info label="更新時間" value={formatDateTime(row.lastUpdated)} />
        ) : null}
      </dl>

      {row.details?.length ? (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-400">
          {row.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right text-slate-300">{value}</dd>
    </div>
  );
}

function getStatusTone(status: UnifiedStatusKind) {
  const tones: Record<
    UnifiedStatusKind,
    "neutral" | "success" | "warning" | "danger" | "accent"
  > = {
    ok: "success",
    runtime: "accent",
    tracked: "accent",
    partial: "warning",
    stale: "warning",
    unavailable: "danger",
  };
  return tones[status];
}
