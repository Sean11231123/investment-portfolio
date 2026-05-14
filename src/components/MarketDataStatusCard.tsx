import type {
  FxRates,
  HoldingValue,
  MarketDataFreshness,
} from "../types/portfolio";
import { formatDateTime, formatNumber } from "../utils/format";
import { getMarketDataStatuses } from "../utils/marketDataStatus";
import { AppBadge, AppCard, appMutedSurface } from "./ui";

type MarketDataStatusCardProps = {
  holdingValues: HoldingValue[];
  fxRates: FxRates;
};

export function MarketDataStatusCard({
  holdingValues,
  fxRates,
}: MarketDataStatusCardProps) {
  const statuses = getMarketDataStatuses(holdingValues, fxRates);

  return (
    <AppCard>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-slate-50">市場資料狀態</h2>
        <p className="text-xs text-slate-400">
          顯示價格、匯率與快取資料是否完整。
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {statuses.map((status) => (
          <StatusItem key={status.category} status={status} fxRates={fxRates} />
        ))}
      </div>
    </AppCard>
  );
}

function StatusItem({
  status,
  fxRates,
}: {
  status: MarketDataFreshness;
  fxRates: FxRates;
}) {
  return (
    <div className={`rounded-2xl p-4 ${appMutedSurface}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-slate-100">{status.label}</h3>
        <AppBadge tone={getStatusTone(status.status)}>
          {getStatusLabel(status.status)}
        </AppBadge>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">{status.message}</p>

      <dl className="mt-3 space-y-1 text-xs text-slate-400">
        {status.source ? <Info label="來源" value={getSourceLabel(status.source)} /> : null}
        {status.tradeDate ? <Info label="交易日" value={status.tradeDate} /> : null}
        {status.generatedAt ? (
          <Info label="產生時間" value={formatDateTime(status.generatedAt)} />
        ) : null}
        {status.lastUpdated ? (
          <Info label="上次更新" value={formatDateTime(status.lastUpdated)} />
        ) : null}
        {status.category === "fx" ? (
          <>
            <Info label="USD/TWD" value={formatNumber(fxRates.usdToTwd, 4)} />
            <Info label="USDT/TWD" value={formatNumber(fxRates.usdtToTwd, 4)} />
          </>
        ) : null}
      </dl>
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

function getStatusLabel(status: MarketDataFreshness["status"]) {
  const labels: Record<MarketDataFreshness["status"], string> = {
    fresh: "正常",
    stale: "可能過期",
    cached: "使用快取",
    partial: "部分缺漏",
    unavailable: "無法取得",
    error: "錯誤",
  };
  return labels[status];
}

function getStatusTone(status: MarketDataFreshness["status"]) {
  if (status === "fresh") return "success";
  if (status === "cached" || status === "stale") return "warning";
  if (status === "partial") return "danger";
  return "danger";
}

function getSourceLabel(source: string) {
  if (source === "static-tw-market-json") return "TWSE 靜態市場資料";
  if (source === "static-us-market-json") return "Stooq 靜態市場資料";
  if (source === "CoinGecko") return "CoinGecko";
  if (source === "cash") return "現金";
  if (source.includes("Frankfurter")) return "Frankfurter";
  return source;
}
