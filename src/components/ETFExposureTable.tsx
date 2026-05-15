import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Currency, ETFExposureRow, FxRates } from "../types/portfolio";
import { formatDisplayMoney, formatPercent } from "../utils/format";
import { groupSmallExposures } from "../utils/etfLookthrough";
import {
  AppCard,
  EmptyState,
  appTableHeader,
  appTableRow,
  chartColors,
  chartTextColor,
  chartTooltipStyle,
} from "./ui";

type ETFExposureTableProps = {
  title: string;
  rows: ETFExposureRow[];
  displayCurrency: Currency;
  fxRates: FxRates;
  emptyTitle: string;
  emptyMessage: string;
  percentageLabel?: string;
};

export function ETFExposureTable({
  title,
  rows,
  displayCurrency,
  fxRates,
  emptyTitle,
  emptyMessage,
  percentageLabel = "投組占比",
}: ETFExposureTableProps) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  const chartRows = groupSmallExposures(rows, 10);

  return (
    <section className="space-y-4">
      <AppCard>
        <h2 className="text-lg font-semibold text-[var(--app-text)]">{title}</h2>
        <div className="mt-4 h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartRows}
                dataKey="portfolioPercentage"
                nameKey="name"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={3}
                stroke="rgba(15,23,42,0.9)"
                strokeWidth={3}
              >
                {chartRows.map((row, index) => (
                  <Cell
                    key={row.symbol}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(_value, _name, item) => {
                  const row = item.payload as ETFExposureRow;
                  return [
                    `${formatPercent(row.portfolioPercentage)} / ${formatDisplayMoney(
                      row.totalExposureTWD,
                      displayCurrency,
                      fxRates,
                    )}`,
                    row.name,
                  ];
                }}
              />
              <Legend wrapperStyle={{ color: chartTextColor, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </AppCard>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <AppCard key={row.symbol}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--app-text)]">{row.symbol}</p>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--app-text-muted)]">
                  {row.name}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-[var(--app-primary)]">
                {formatPercent(row.portfolioPercentage)}
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-[var(--app-text)]">
              {formatDisplayMoney(row.totalExposureTWD, displayCurrency, fxRates)}
            </p>
          </AppCard>
        ))}
      </div>

      <AppCard padded={false} className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={appTableHeader}>
              <tr>
                <Th>標的</Th>
                <Th>名稱</Th>
                <Th>{percentageLabel}</Th>
                <Th>金額</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.symbol} className={appTableRow}>
                  <Td strong>{row.symbol}</Td>
                  <Td>{row.name}</Td>
                  <Td>{formatPercent(row.portfolioPercentage)}</Td>
                  <Td>
                    {formatDisplayMoney(
                      row.totalExposureTWD,
                      displayCurrency,
                      fxRates,
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td className={`whitespace-nowrap px-4 py-3 ${strong ? "font-semibold text-[var(--app-text)]" : "text-[var(--app-text-muted)]"}`}>
      {children}
    </td>
  );
}
