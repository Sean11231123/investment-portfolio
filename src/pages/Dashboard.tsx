import { AllocationCharts } from "../components/AllocationCharts";
import { CurrencyAllocationTable } from "../components/CurrencyAllocationTable";
import { ETFExposureTable } from "../components/ETFExposureTable";
import { SummaryCards } from "../components/SummaryCards";
import { etfComponents } from "../data/etfComponents";
import type { Holding, PortfolioSettings } from "../types/portfolio";
import { calculateETFExposure } from "../utils/etfLookthrough";
import {
  assetTypeLabels,
  getAllocationBy,
  getTopHoldings,
  getTotalValueTWD,
  marketLabels,
} from "../utils/portfolioCalculations";

type DashboardProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
};

export function Dashboard({ holdings, settings }: DashboardProps) {
  const totalValueTWD = getTotalValueTWD(holdings, settings);
  const etfCoverageCount = holdings.filter(
    (holding) => etfComponents[holding.symbol.trim().toUpperCase()],
  ).length;
  const assetAllocation = getAllocationBy(
    holdings,
    settings,
    (holding) => holding.type,
    (key) => assetTypeLabels[key] ?? key,
  );
  const marketAllocation = getAllocationBy(
    holdings,
    settings,
    (holding) => holding.market,
    (key) => marketLabels[key] ?? key,
  );
  const currencyAllocation = getAllocationBy(
    holdings,
    settings,
    (holding) => holding.currency,
  );
  const topHoldings = getTopHoldings(holdings, settings);
  const etfExposureRows = calculateETFExposure(
    holdings,
    settings,
    etfComponents,
  ).filter((row) => row.indirectExposureTWD > 0);

  return (
    <div className="space-y-6">
      <SummaryCards
        totalValueTWD={totalValueTWD}
        holdings={holdings}
        etfCoverageCount={etfCoverageCount}
      />

      {holdings.length === 0 ? (
        <section className="rounded-md border border-dashed border-[#b6c5c9] bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">投資組合目前是空的</h2>
          <p className="mt-2 text-sm text-[#607078]">
            請到「持倉」新增資產，或手動載入展示投組。新使用者不會自動載入任何共享資料。
          </p>
        </section>
      ) : null}

      <AllocationCharts
        assetAllocation={assetAllocation}
        marketAllocation={marketAllocation}
        topHoldings={topHoldings}
      />

      <CurrencyAllocationTable rows={currencyAllocation} />

      <section className="rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-4 text-sm text-[#6f5a19]">
        ETF component data is sample/manual data and should be updated by the
        user.
      </section>

      <ETFExposureTable rows={etfExposureRows} />
    </div>
  );
}
