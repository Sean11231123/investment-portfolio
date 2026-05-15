import type { Currency, FxRates, Holding } from "../types/portfolio";
import { formatDisplayMoney } from "../utils/format";
import { AppCard } from "./ui";

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
  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4" aria-label="投組摘要">
      <SummaryCard
        label={`總資產 ${displayCurrency}`}
        value={formatDisplayMoney(totalValueTWD, displayCurrency, fxRates)}
        helper={
          unavailableCount > 0
            ? "部分資產缺少價格，總額可能不完整。"
            : "已使用可用價格估值。"
        }
        featured
      />
      <SummaryCard label="持倉數" value={`${holdings.length}`} />
      <SummaryCard label="缺價資產" value={`${unavailableCount}`} />
      <SummaryCard label="ETF 持倉" value={`${etfHoldingCount}`} />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  featured = false,
}: {
  label: string;
  value: string;
  helper?: string;
  featured?: boolean;
}) {
  return (
    <AppCard
      className={
        featured
          ? "relative col-span-2 overflow-hidden bg-gradient-to-br from-violet-500/25 via-indigo-500/15 to-[#111a35]/90 md:col-span-1"
          : ""
      }
    >
      {featured ? (
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-400/20 blur-2xl" />
      ) : null}
      <p className="text-xs text-slate-400 sm:text-sm">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold text-white sm:text-2xl">{value}</p>
      {helper ? <p className="mt-2 text-xs leading-5 text-slate-400">{helper}</p> : null}
    </AppCard>
  );
}
