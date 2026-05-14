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

const chartColors = [
  "#1f6f78",
  "#d88c3a",
  "#6b7f3f",
  "#8a5a83",
  "#3e668d",
  "#9a6b3f",
  "#4d8061",
  "#b04f4a",
  "#6d7488",
  "#2f7566",
  "#9c8f63",
];

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
    return (
      <div className="rounded-md border border-dashed border-[#b6c5c9] bg-white p-8 text-center">
        <h2 className="text-lg font-semibold">{emptyTitle}</h2>
        <p className="mt-2 text-sm text-[#607078]">{emptyMessage}</p>
      </div>
    );
  }

  const chartRows = groupSmallExposures(rows, 10);

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-[#d8e0e3] bg-white p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartRows}
                dataKey="portfolioPercentage"
                nameKey="name"
                innerRadius={72}
                outerRadius={112}
                paddingAngle={2}
              >
                {chartRows.map((row, index) => (
                  <Cell
                    key={row.symbol}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
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
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-[#d8e0e3] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#d8e0e3] text-sm">
            <thead className="bg-[#eef3f4] text-left text-[#314249]">
              <tr>
                <Th>標的</Th>
                <Th>名稱</Th>
                <Th>{percentageLabel}</Th>
                <Th>金額</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f2]">
              {rows.map((row) => (
                <tr key={row.symbol} className="hover:bg-[#fafbfb]">
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
      </div>
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
    <td
      className={`whitespace-nowrap px-4 py-3 ${
        strong ? "font-semibold text-[#172026]" : "text-[#314249]"
      }`}
    >
      {children}
    </td>
  );
}
