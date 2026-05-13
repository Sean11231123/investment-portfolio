import type { Holding } from "../types/portfolio";
import { formatTWD } from "../utils/format";

type SummaryCardsProps = {
  totalValueTWD: number;
  holdings: Holding[];
  etfCoverageCount: number;
};

export function SummaryCards({
  totalValueTWD,
  holdings,
  etfCoverageCount,
}: SummaryCardsProps) {
  const totalCost = holdings.reduce(
    (sum, holding) =>
      sum +
      (holding.avgCost !== undefined
        ? holding.avgCost * holding.quantity
        : 0),
    0,
  );

  return (
    <section className="grid gap-4 md:grid-cols-3" aria-label="投資組合摘要">
      <SummaryCard label="總市值 TWD" value={formatTWD(totalValueTWD)} />
      <SummaryCard label="持倉數量" value={`${holdings.length}`} />
      <SummaryCard
        label="ETF 成分資料覆蓋"
        value={`${etfCoverageCount}`}
        helper={totalCost > 0 ? "平均成本為原幣粗估，未列入匯率換算" : undefined}
      />
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
