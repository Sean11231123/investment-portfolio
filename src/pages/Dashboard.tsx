import { AllocationCharts } from "../components/AllocationCharts";
import { CurrencyAllocationTable } from "../components/CurrencyAllocationTable";
import { ETFExposureTable } from "../components/ETFExposureTable";
import { SummaryCards } from "../components/SummaryCards";
import { AppButton, EmptyState } from "../components/ui";
import type {
  AssetMetadata,
  FxRates,
  Holding,
  PortfolioSettings,
  PriceQuote,
} from "../types/portfolio";
import {
  calculateETFOnlyAggregateExposure,
  isETFAssetType,
} from "../utils/etfLookthrough";
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
  universeAssets?: AssetMetadata[];
  onRefreshPrices: () => void;
};

export function Dashboard({
  holdings,
  settings,
  fxRates,
  priceCache,
  priceRefreshing,
  universeAssets = [],
  onRefreshPrices,
}: DashboardProps) {
  const valuation = getPortfolioValuation(
    holdings,
    fxRates,
    priceCache,
    universeAssets,
  );
  const etfHoldingCount = valuation.holdingValues.filter((row) =>
    isETFAssetType(row.metadata.type),
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
        etfHoldingCount={etfHoldingCount}
        unavailableCount={valuation.unavailableCount}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
      />

      {valuation.isPartial ? (
        <section className="rounded-3xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-200">
          部分資產缺少價格，因此總資產與投組占比可能不完整。
        </section>
      ) : null}

      <div className="flex justify-end">
        <AppButton onClick={onRefreshPrices} disabled={priceRefreshing}>
          {priceRefreshing ? "更新中..." : "更新價格"}
        </AppButton>
      </div>

      {holdings.length === 0 ? (
        <EmptyState
          title="投組目前是空的"
          message="到持倉頁新增資產後，這裡會顯示總資產、配置圖表與 ETF 展開摘要。"
        />
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

      <section className="rounded-3xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-200">
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
