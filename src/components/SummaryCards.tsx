import type { Currency, FxRates, Holding } from "../types/portfolio";
import { formatDisplayMoney } from "../utils/format";

type SummaryCardsProps = {
  totalValueTWD: number;
  holdings: Holding[];
  etfCoverageCount: number;
  unavailableCount: number;
  displayCurrency: Currency;
  fxRates: FxRates;
};

export function SummaryCards({
  totalValueTWD,
  holdings,
  etfCoverageCount,
  unavailableCount,
  displayCurrency,
  fxRates,
}: SummaryCardsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-4" aria-label="投組摘要">
      <SummaryCard
        label={`總資產 ${displayCurrency}`}
        value={formatDisplayMoney(totalValueTWD, displayCurrency, fxRates)}
        helper={
          unavailableCount > 0
            ? "部分資產缺少價格，總值可能不完整"
            : undefined
        }
      />
      <SummaryCard label="持倉數" value={`${holdings.length}`} />
      <SummaryCard label="價格缺漏" value={`${unavailableCount}`} />
      <SummaryCard label="ETF 展開覆蓋" value={`${etfCoverageCount}`} />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-md border border-[#d8e0e3] bg-white p-5">
      <p className="text-sm text-[#607078]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#172026]">{value}</p>
      {helper ? <p className="mt-2 text-xs text-[#7a6a33]">{helper}</p> : null}
    </div>
  );
}
