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
  })).map((entry, index) => ({
    ...entry,
    color: chartColors[index % chartColors.length],
  }));

  return (
    <section className="grid min-w-0 gap-3 sm:gap-4 xl:grid-cols-3">
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
        <div className="h-64 min-w-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
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
                content={(props) => (
                  <TopHoldingTooltip
                    {...props}
                    displayCurrency={displayCurrency}
                    fxRates={fxRates}
                  />
                )}
              />
              <Bar dataKey="valueTWD" name={`金額 ${displayCurrency}`} radius={[10, 10, 0, 0]}>
                {topHoldingChartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>
    </section>
  );
}

type TopHoldingTooltipPayload = {
  payload?: {
    color?: string;
    valueTWD?: number;
  };
  value?: unknown;
};

function TopHoldingTooltip({
  active,
  label,
  payload,
  displayCurrency,
  fxRates,
}: {
  active?: boolean;
  label?: string | number;
  payload?: readonly TopHoldingTooltipPayload[];
  displayCurrency: Currency;
  fxRates: FxRates;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];
  const value = Number(item.payload?.valueTWD ?? item.value ?? 0);
  const color = getActiveChartValueColor(item.payload?.color);

  return (
    <div
      style={chartTooltipStyle}
      className="rounded-2xl px-3 py-2 text-xs shadow-xl"
    >
      <p className="font-semibold text-[var(--app-text)]">{label}</p>
      <p className="mt-1 font-semibold" style={{ color }}>
        {formatDisplayMoney(value, displayCurrency, fxRates)}
      </p>
    </div>
  );
}

export function getActiveChartValueColor(color?: string | null) {
  return color && color.trim().length > 0 ? color : "#e2e8f0";
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
    <div className="h-56 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="valueTWD"
            nameKey="label"
            innerRadius="52%"
            outerRadius="76%"
            paddingAngle={3}
            stroke="var(--app-chart-slice-stroke)"
            strokeWidth={2}
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
    </div>
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
    <AppCard className="min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-primary)]">
            Analysis
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold text-[var(--app-text)]">
            {title}
          </h2>
        </div>
      </div>

      <div className="mt-4 min-w-0 rounded-[1.35rem] border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2 sm:p-3">
        {children}
      </div>
    </AppCard>
  );
}
