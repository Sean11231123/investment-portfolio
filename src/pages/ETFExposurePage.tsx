import { useMemo, useState } from "react";
import { ETFExposureTable } from "../components/ETFExposureTable";
import { etfComponents } from "../data/etfComponents";
import type {
  FxRates,
  Holding,
  PortfolioSettings,
  PriceQuote,
} from "../types/portfolio";
import {
  calculateETFExposure,
  calculateSingleETFExposure,
  getHeldEtfsWithComponents,
} from "../utils/etfLookthrough";
import { getPortfolioValuation } from "../utils/portfolioCalculations";

type ETFExposurePageProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
  fxRates: FxRates;
  priceCache: Record<string, PriceQuote>;
};

export function ETFExposurePage({
  holdings,
  settings,
  fxRates,
  priceCache,
}: ETFExposurePageProps) {
  const valuation = useMemo(
    () => getPortfolioValuation(holdings, fxRates, priceCache),
    [holdings, fxRates, priceCache],
  );
  const aggregateRows = calculateETFExposure(valuation.holdingValues);
  const heldEtfs = getHeldEtfsWithComponents(valuation.holdingValues);
  const [selectedEtf, setSelectedEtf] = useState("");
  const selectedSymbol = selectedEtf || heldEtfs[0]?.symbol || "";
  const singleRows = selectedSymbol
    ? calculateSingleETFExposure(
        holdings,
        valuation.holdingValues,
        selectedSymbol,
        etfComponents,
      )
    : [];

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
      </section>

      {valuation.isPartial ? (
        <section className="rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-4 text-sm text-[#6f5a19]">
          有 ETF 或成分相關持倉價格 unavailable 時，ETF 展開只會使用可估值的 ETF。
        </section>
      ) : null}

      <ETFExposureTable
        title="ETF 展開後投組占比"
        rows={aggregateRows}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
        emptyTitle="目前沒有可展開的 ETF 暴險"
        emptyMessage="新增有樣本成分資料且價格可用的 ETF 後，這裡會顯示展開後占比。"
      />

      <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">單一 ETF 投組占比</h2>
            <p className="mt-1 text-sm text-[#607078]">
              成分占比會乘上該 ETF 在整體投組中的市值占比。
            </p>
          </div>
          {heldEtfs.length > 0 ? (
            <select
              value={selectedSymbol}
              onChange={(event) => setSelectedEtf(event.target.value)}
              className="rounded-md border border-[#b6c5c9] bg-white px-3 py-2 text-sm"
            >
              {heldEtfs.map((etf) => (
                <option key={etf.symbol} value={etf.symbol}>
                  {etf.symbol} - {etf.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </section>

      <ETFExposureTable
        title={
          selectedSymbol
            ? `單一 ETF 投組占比：${selectedSymbol}`
            : "單一 ETF 投組占比"
        }
        rows={singleRows}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
        emptyTitle="目前沒有可選擇的 ETF"
        emptyMessage={
          selectedSymbol && !etfComponents[selectedSymbol]
            ? "選取的 ETF 尚無手動成分資料。"
            : "請先新增持有且有樣本成分資料的 ETF。"
        }
      />
    </div>
  );
}
