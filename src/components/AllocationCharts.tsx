import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AllocationRow, Currency, FxRates, HoldingValue } from "../types/portfolio";
import { formatDisplayMoney } from "../utils/format";

const chartColors = ["#1f6f78", "#d88c3a", "#6b7f3f", "#8a5a83", "#3e668d"];

type AllocationChartsProps = {
  assetAllocation: AllocationRow[];
  marketAllocation: AllocationRow[];
  topHoldings: HoldingValue[];
  displayCurrency: Currency;
  fxRates: FxRates;
};

export function AllocationCharts({
  assetAllocation,
  marketAllocation,
  topHoldings,
  displayCurrency,
  fxRates,
}: AllocationChartsProps) {
  if (
    assetAllocation.length === 0 &&
    marketAllocation.length === 0 &&
    topHoldings.length === 0
  ) {
    return (
      <section className="rounded-md border border-dashed border-[#b6c5c9] bg-white p-8 text-center">
        <h2 className="text-lg font-semibold">圖表會在取得價格後顯示</h2>
        <p className="mt-2 text-sm text-[#607078]">
          價格 unavailable 的持倉不會被靜默算成 0。
        </p>
      </section>
    );
  }

  const topHoldingChartData = topHoldings.map((row) => ({
    name: row.metadata.symbol,
    valueTWD: row.marketValueTWD ?? 0,
  }));

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <ChartPanel title="資產類型配置">
        <DonutAllocationChart
          data={assetAllocation}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
        />
      </ChartPanel>
      <ChartPanel title="市場配置">
        <DonutAllocationChart
          data={marketAllocation}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
        />
      </ChartPanel>
      <ChartPanel title="前五大持倉">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={topHoldingChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8e0e3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
            <Tooltip
              formatter={(value) =>
                formatDisplayMoney(Number(value), displayCurrency, fxRates)
              }
            />
            <Bar dataKey="valueTWD" name={`市值 ${displayCurrency}`} radius={[4, 4, 0, 0]}>
              {topHoldingChartData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={chartColors[index % chartColors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
    </section>
  );
}

function DonutAllocationChart({
  data,
  displayCurrency,
  fxRates,
}: {
  data: AllocationRow[];
  displayCurrency: Currency;
  fxRates: FxRates;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="valueTWD"
          nameKey="label"
          innerRadius={58}
          outerRadius={92}
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.key}
              fill={chartColors[index % chartColors.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) =>
            formatDisplayMoney(Number(value), displayCurrency, fxRates)
          }
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#d8e0e3] bg-white p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}
