import { useMemo, useState } from "react";
import { ETFExposureTable } from "../components/ETFExposureTable";
import { etfComponents } from "../data/etfComponents";
import type {
  FxRates,
  Holding,
  HoldingValue,
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
  const heldEtfRows = getHeldTaiwanEtfs(valuation.holdingValues);
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
      <ETFComponentStatusSection heldEtfRows={heldEtfRows} />

      {valuation.isPartial ? (
        <section className="rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-4 text-sm text-[#6f5a19]">
          部分 ETF 或成分估值缺少價格，ETF 展開可能只包含可估值的部位。
        </section>
      ) : null}

      <ETFExposureTable
        title="ETF 展開後投組占比"
        rows={aggregateRows}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
        emptyTitle="尚無 ETF 展開資料"
        emptyMessage="目前沒有可展開的 ETF 持倉，或相關 ETF 價格暫時無法取得。"
      />

      <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">單一 ETF 投組占比</h2>
            <p className="mt-1 text-sm text-[#607078]">
              選擇目前持有且有成分資料的 ETF，查看它對整體投組的展開占比。
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
        emptyTitle="尚無可展開 ETF"
        emptyMessage={
          selectedSymbol && !etfComponents[selectedSymbol]
            ? "此 ETF 尚無成分資料，暫時無法展開。"
            : "請先持有至少一檔有成分資料的 ETF。"
        }
      />
    </div>
  );
}

function ETFComponentStatusSection({
  heldEtfRows,
}: {
  heldEtfRows: HoldingValue[];
}) {
  return (
    <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
      <h2 className="text-lg font-semibold">ETF 成分資料狀態</h2>
      <p className="mt-2 text-sm text-[#607078]">
        ETF 成分資料是公開靜態資料，會隨時間變舊；使用前請確認資料來源與更新日期。
      </p>

      {heldEtfRows.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-[#b6c5c9] bg-[#fafbfb] p-4 text-sm text-[#607078]">
          目前沒有 ETF 持倉。
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {heldEtfRows.map((row) => {
            const symbol = row.metadata.symbol;
            const data = etfComponents[symbol];

            if (!data) {
              return (
                <div
                  key={row.holding.id}
                  className="rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-4"
                >
                  <p className="font-semibold">
                    {symbol} {row.metadata.name}
                  </p>
                  <p className="mt-2 text-sm text-[#6f5a19]">
                    此 ETF 尚無成分資料，暫時無法展開。
                  </p>
                </div>
              );
            }

            const showWarning =
              data.dataQuality === "sample" || data.dataQuality === "stale";

            return (
              <div
                key={row.holding.id}
                className="rounded-md border border-[#d8e0e3] bg-[#fafbfb] p-4"
              >
                <p className="font-semibold">
                  {symbol} {data.name}
                </p>
                <dl className="mt-3 space-y-1 text-xs text-[#607078]">
                  <Info label="更新日期" value={data.lastUpdated} />
                  <Info label="資料品質" value={getQualityLabel(data.dataQuality)} />
                  <Info
                    label="成分數量"
                    value={`${data.componentCount ?? data.components.length}`}
                  />
                  <Info
                    label="總權重"
                    value={`${(((data.totalWeight ?? 0) * 100)).toFixed(1)}%`}
                  />
                </dl>
                <p className="mt-3 text-xs text-[#607078]">
                  資料來源說明：{data.sourceNote}
                </p>
                {showWarning ? (
                  <p className="mt-3 rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-2 text-xs text-[#6f5a19]">
                    ETF 成分資料可能不是最新資料，請確認資料來源與更新日期。
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right text-[#314249]">{value}</dd>
    </div>
  );
}

function getHeldTaiwanEtfs(holdingValues: HoldingValue[]) {
  const seen = new Set<string>();
  return holdingValues.filter((row) => {
    if (row.metadata.type !== "taiwan_etf") {
      return false;
    }

    const symbol = row.metadata.symbol;
    if (seen.has(symbol)) {
      return false;
    }

    seen.add(symbol);
    return true;
  });
}

function getQualityLabel(quality?: string) {
  if (quality === "verified") return "已驗證";
  if (quality === "manual") return "手動維護";
  if (quality === "stale") return "可能過期";
  return "範例資料";
}
