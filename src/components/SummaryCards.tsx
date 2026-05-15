import type { Currency, FxRates, Holding } from "../types/portfolio";
import { formatDisplayMoney } from "../utils/format";
import { AppBadge, AppCard } from "./ui";

type SummaryCardsProps = {
  totalValueTWD: number;
  holdings: Holding[];
  etfHoldingCount: number;
  unavailableCount: number;
  displayCurrency: Currency;
  fxRates: FxRates;
};

export function SummaryCards({
  totalValueTWD,
  holdings,
  etfHoldingCount,
  unavailableCount,
  displayCurrency,
  fxRates,
}: SummaryCardsProps) {
  const totalValueText = formatDisplayMoney(totalValueTWD, displayCurrency, fxRates);
  const isPartial = unavailableCount > 0;

  return (
    <section className="space-y-3 sm:space-y-4" aria-label="投組摘要">
      <PortfolioHeroCard
        totalValueText={totalValueText}
        displayCurrency={displayCurrency}
        holdingsCount={holdings.length}
        etfHoldingCount={etfHoldingCount}
        unavailableCount={unavailableCount}
        isPartial={isPartial}
      />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <CompactSummaryCard label="持倉數" value={`${holdings.length}`} helper="資產項目" />
        <CompactSummaryCard
          label="缺價"
          value={`${unavailableCount}`}
          helper={isPartial ? "需留意" : "完整"}
          tone={isPartial ? "warning" : "success"}
        />
        <CompactSummaryCard label="ETF" value={`${etfHoldingCount}`} helper="持倉" />
      </div>
    </section>
  );
}

function PortfolioHeroCard({
  totalValueText,
  displayCurrency,
  holdingsCount,
  etfHoldingCount,
  unavailableCount,
  isPartial,
}: {
  totalValueText: string;
  displayCurrency: Currency;
  holdingsCount: number;
  etfHoldingCount: number;
  unavailableCount: number;
  isPartial: boolean;
}) {
  return (
    <AppCard className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.20),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(74,222,128,0.13),transparent_32%)]" />
      <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300">
              Total Portfolio
            </p>
            <p className="mt-1 text-sm text-slate-400">總資產估值</p>
          </div>

          <AppBadge tone={isPartial ? "warning" : "success"}>
            {isPartial ? "部分估值" : "估值完整"}
          </AppBadge>
        </div>

        <div className="mt-5">
          <p className="break-words text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {totalValueText}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            顯示幣別：{displayCurrency}
            {isPartial ? " · 部分資產缺少價格，總額可能不完整。" : " · 已使用可用價格估值。"}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <HeroMetric label="持倉" value={holdingsCount} />
          <HeroMetric label="ETF" value={etfHoldingCount} />
          <HeroMetric label="缺價" value={unavailableCount} highlight={isPartial} />
        </div>
      </div>
    </AppCard>
  );
}

function HeroMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 text-center backdrop-blur">
      <p className={`text-lg font-semibold ${highlight ? "text-amber-200" : "text-white"}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function CompactSummaryCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const valueTone =
    tone === "success"
      ? "text-emerald-200"
      : tone === "warning"
        ? "text-amber-200"
        : "text-white";

  return (
    <AppCard className="px-3 py-3 sm:px-4 sm:py-4">
      <p className="text-[11px] text-slate-400 sm:text-xs">{label}</p>
      <p className={`mt-1 break-words text-xl font-semibold sm:text-2xl ${valueTone}`}>
        {value}
      </p>
      {helper ? <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{helper}</p> : null}
    </AppCard>
  );
}