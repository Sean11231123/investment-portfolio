import type {
  FxRates,
  HoldingValue,
  MarketDataFreshness,
} from "../types/portfolio";
import { formatDateTime, formatNumber } from "../utils/format";
import { getMarketDataStatuses } from "../utils/marketDataStatus";

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
    <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-[#172026]">市場資料狀態</h2>
        <p className="text-xs text-[#607078]">
          台股資料可能因週末或休市而看起來較舊。
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {statuses.map((status) => (
          <StatusItem key={status.category} status={status} fxRates={fxRates} />
        ))}
      </div>
    </section>
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
    <div className="rounded-md border border-[#edf1f2] bg-[#fafbfb] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-[#172026]">{status.label}</h3>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
            status.status,
          )}`}
        >
          {getStatusLabel(status.status)}
        </span>
      </div>

      <p className="mt-3 text-sm text-[#314249]">{status.message}</p>

      <dl className="mt-3 space-y-1 text-xs text-[#607078]">
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
      <dd className="text-right text-[#314249]">{value}</dd>
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

function getStatusClass(status: MarketDataFreshness["status"]) {
  if (status === "fresh") return "bg-[#e8f5ee] text-[#2c6b45]";
  if (status === "cached" || status === "stale") return "bg-[#fff4d6] text-[#7a5a00]";
  if (status === "partial") return "bg-[#fff1ef] text-[#a43f32]";
  return "bg-[#f4e4e1] text-[#8f2d22]";
}

function getSourceLabel(source: string) {
  if (source === "static-tw-market-json") return "TWSE 靜態市場資料";
  if (source === "CoinGecko") return "CoinGecko";
  if (source === "cash") return "現金";
  if (source.includes("Frankfurter")) return "Frankfurter";
  return source;
}
