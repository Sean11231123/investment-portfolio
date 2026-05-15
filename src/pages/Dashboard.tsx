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
    <div className="space-y-5 sm:space-y-6">
      <SummaryCards
        totalValueTWD={valuation.totalValueTWD}
        holdings={holdings}
        etfHoldingCount={etfHoldingCount}
        unavailableCount={valuation.unavailableCount}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
      />

      {valuation.isPartial ? (
        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
          <span className="font-semibold">估值提醒：</span>
          部分資產缺少價格，因此總資產與投組占比可能不完整。
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">價格與資料</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            手動更新可重新取得可用市場價格與匯率資料。
          </p>
        </div>

        <AppButton
          onClick={onRefreshPrices}
          disabled={priceRefreshing}
          className="w-full sm:w-auto"
        >
          {priceRefreshing ? "更新中..." : "更新價格"}
        </AppButton>
      </section>

      {holdings.length === 0 ? (
        <EmptyState
          title="投組目前是空的"
          message="到持倉頁新增資產後，這裡會顯示總資產、配置圖表與 ETF 展開摘要。"
        />
      ) : null}

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">投組配置</h2>
        <p className="text-sm leading-6 text-slate-500">
          依資產類型、市場與前十大持倉查看配置狀態。
        </p>
      </div>

      <AllocationCharts
        assetAllocation={assetAllocation}
        marketAllocation={marketAllocation}
        topHoldings={topHoldings}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
      />

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">幣別配置</h2>
        <p className="text-sm leading-6 text-slate-500">
          查看投組在不同計價幣別中的分布。
        </p>
      </div>

      <CurrencyAllocationTable
        rows={currencyAllocation}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
      />

      <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
        <span className="font-semibold">ETF 資料提醒：</span>
        ETF 成分資料為手動/範例資料，使用前請由使用者自行更新。
      </section>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">ETF 展開摘要</h2>
        <p className="text-sm leading-6 text-slate-500">
          只計算 ETF 持倉內部成分；未建立成分資料的 ETF 會顯示為未展開。
        </p>
      </div>

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
