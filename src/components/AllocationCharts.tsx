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
import {
  AppCard,
  EmptyState,
  chartColors,
  chartGridColor,
  chartTextColor,
  chartTooltipStyle,
} from "./ui";

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
      <EmptyState
        title="尚無可繪製的估值資料"
        message="價格暫時無法取得的資產不會被當成 0，等價格可用後圖表會自動呈現。"
      />
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
      <ChartPanel title="前十大持倉">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={topHoldingChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
            <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(value) => `${Number(value) / 1000}k`}
              tick={{ fill: chartTextColor, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value) =>
                formatDisplayMoney(Number(value), displayCurrency, fxRates)
              }
            />
            <Bar dataKey="valueTWD" name={`金額 ${displayCurrency}`} radius={[10, 10, 0, 0]}>
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
          innerRadius={64}
          outerRadius={96}
          paddingAngle={3}
          stroke="rgba(15,23,42,0.9)"
          strokeWidth={3}
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.key}
              fill={chartColors[index % chartColors.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={chartTooltipStyle}
          formatter={(value) =>
            formatDisplayMoney(Number(value), displayCurrency, fxRates)
          }
        />
        <Legend wrapperStyle={{ color: chartTextColor, fontSize: 12 }} />
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
    <AppCard>
      <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
      <div className="mt-4">{children}</div>
    </AppCard>
  );
}
