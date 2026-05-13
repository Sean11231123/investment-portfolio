import { ETFExposureTable } from "../components/ETFExposureTable";
import { etfComponents } from "../data/etfComponents";
import type { Holding, PortfolioSettings } from "../types/portfolio";
import { calculateETFExposure } from "../utils/etfLookthrough";

type ETFExposurePageProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
};

export function ETFExposurePage({ holdings, settings }: ETFExposurePageProps) {
  const rows = calculateETFExposure(holdings, settings, etfComponents);
  const coveredEtfs = holdings
    .map((holding) => holding.symbol.trim().toUpperCase())
    .filter((symbol) => etfComponents[symbol]);

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
        <h2 className="text-lg font-semibold">ETF 成分展開</h2>
        <p className="mt-2 text-sm text-[#607078]">
          ETF component data is sample/manual data and should be updated by the
          user.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {Object.entries(etfComponents).map(([symbol, data]) => (
            <div
              key={symbol}
              className="rounded-md border border-[#d8e0e3] bg-[#fafbfb] p-4"
            >
              <p className="font-semibold">
                {symbol} {data.name}
              </p>
              <p className="mt-1 text-xs text-[#607078]">
                更新日期：{data.lastUpdated}
              </p>
              <p className="mt-2 text-xs text-[#607078]">{data.sourceNote}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-[#607078]">
          目前投組含樣本成分 ETF：{coveredEtfs.length ? coveredEtfs.join(", ") : "無"}
        </p>
      </section>
      <ETFExposureTable rows={rows} />
    </div>
  );
}
