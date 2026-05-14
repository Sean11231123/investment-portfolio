import { AllocationCharts } from "../components/AllocationCharts";
import { CurrencyAllocationTable } from "../components/CurrencyAllocationTable";
import { ETFExposureTable } from "../components/ETFExposureTable";
import { MarketDataStatusCard } from "../components/MarketDataStatusCard";
import { SummaryCards } from "../components/SummaryCards";
import { etfComponents } from "../data/etfComponents";
import type {
  FxRates,
  Holding,
  PortfolioSettings,
  PriceQuote,
} from "../types/portfolio";
import { calculateETFOnlyAggregateExposure } from "../utils/etfLookthrough";
import {
  assetTypeLabels,
  getAllocationBy,
  getPortfolioValuation,
  getTopHoldings,
  marketLabels,
} from "../utils/portfolioCalculations";

type DashboardProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
  fxRates: FxRates;
  priceCache: Record<string, PriceQuote>;
  priceRefreshing: boolean;
  onRefreshPrices: () => void;
};

export function Dashboard({
  holdings,
  settings,
  fxRates,
  priceCache,
  priceRefreshing,
  onRefreshPrices,
}: DashboardProps) {
  const valuation = getPortfolioValuation(holdings, fxRates, priceCache);
  const etfCoverageCount = holdings.filter(
    (holding) => etfComponents[holding.symbol.trim().toUpperCase()],
  ).length;
  const assetAllocation = getAllocationBy(
    valuation.holdingValues,
    (row) => row.metadata.type,
    (key) => assetTypeLabels[key as keyof typeof assetTypeLabels] ?? key,
  );
  const marketAllocation = getAllocationBy(
    valuation.holdingValues,
    (row) => row.metadata.market,
    (key) => marketLabels[key] ?? key,
  );
  const currencyAllocation = getAllocationBy(
    valuation.holdingValues,
    (row) => row.metadata.currency,
  );
  const topHoldings = getTopHoldings(valuation.holdingValues);
  const etfExposureRows = calculateETFOnlyAggregateExposure(
    valuation.holdingValues,
  ).slice(0, 10);

  return (
    <div className="space-y-6">
      <SummaryCards
        totalValueTWD={valuation.totalValueTWD}
        holdings={holdings}
        etfCoverageCount={etfCoverageCount}
        unavailableCount={valuation.unavailableCount}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
      />

      {valuation.isPartial ? (
        <section className="rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-4 text-sm text-[#6f5a19]">
          部分資產缺少價格，因此總資產與投組占比可能不完整。
        </section>
      ) : null}

      <MarketDataStatusCard
        holdingValues={valuation.holdingValues}
        fxRates={fxRates}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRefreshPrices}
          disabled={priceRefreshing}
          className="rounded-md bg-[#1f6f78] px-4 py-2 text-sm font-medium text-white hover:bg-[#185a61] disabled:opacity-60"
        >
          {priceRefreshing ? "更新中..." : "更新價格"}
        </button>
      </div>

      {holdings.length === 0 ? (
        <section className="rounded-md border border-dashed border-[#b6c5c9] bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">投組目前是空的</h2>
          <p className="mt-2 text-sm text-[#607078]">
            到持倉頁新增資產後，這裡會顯示總資產、配置圖表與 ETF 展開摘要。
          </p>
        </section>
      ) : null}

      <AllocationCharts
        assetAllocation={assetAllocation}
        marketAllocation={marketAllocation}
        topHoldings={topHoldings}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
      />

      <CurrencyAllocationTable
        rows={currencyAllocation}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
      />

      <section className="rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-4 text-sm text-[#6f5a19]">
        ETF 成分資料為手動/範例資料，使用前請由使用者自行更新。
      </section>

      <ETFExposureTable
        title="ETF 展開摘要"
        rows={etfExposureRows}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
        emptyTitle="尚無 ETF 展開資料"
        emptyMessage="目前沒有可估值的 ETF 持倉，或相關 ETF 價格暫時無法取得。"
        percentageLabel="占 ETF 持倉"
      />
    </div>
  );
}
