import { useMemo, useState } from "react";
import { ETFExposureTable } from "../components/ETFExposureTable";
import { AppCard, appInput, appMutedSurface, SectionHeader } from "../components/ui";
import { etfComponents } from "../data/etfComponents";
import type {
  AssetMetadata,
  FxRates,
  Holding,
  HoldingValue,
  PortfolioSettings,
  PriceQuote,
} from "../types/portfolio";
import {
  calculateETFOnlyAggregateExposure,
  calculateSingleETFComposition,
  isETFAssetType,
} from "../utils/etfLookthrough";
import { getPortfolioValuation } from "../utils/portfolioCalculations";

type ETFExposurePageProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
  fxRates: FxRates;
  priceCache: Record<string, PriceQuote>;
  universeAssets?: AssetMetadata[];
};

export function ETFExposurePage({
  holdings,
  settings,
  fxRates,
  priceCache,
  universeAssets = [],
}: ETFExposurePageProps) {
  const valuation = useMemo(
    () => getPortfolioValuation(holdings, fxRates, priceCache, universeAssets),
    [holdings, fxRates, priceCache, universeAssets],
  );
  const aggregateRows = calculateETFOnlyAggregateExposure(
    valuation.holdingValues,
  );
  const heldEtfRows = getHeldEtfs(valuation.holdingValues);
  const [selectedEtf, setSelectedEtf] = useState("");
  const selectedSymbol = selectedEtf || heldEtfRows[0]?.metadata.symbol || "";
  const singleRows = selectedSymbol
    ? calculateSingleETFComposition(
        holdings,
        valuation.holdingValues,
        selectedSymbol,
        etfComponents,
      )
    : [];

  return (
    <div className="space-y-5 sm:space-y-6">
      <ETFComponentStatusSection heldEtfRows={heldEtfRows} />

      {valuation.isPartial ? (
        <section className="rounded-3xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-200">
          部分資產缺少價格，因此 ETF 展開可能只包含可估值的 ETF 部位。
        </section>
      ) : null}

      <ETFExposureTable
        title="ETF 持倉展開占比"
        rows={aggregateRows}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
        emptyTitle="尚無 ETF 展開資料"
        emptyMessage="目前沒有可估值的 ETF 持倉，或相關 ETF 價格暫時無法取得。"
        percentageLabel="占 ETF 持倉"
      />

      <AppCard>
        <SectionHeader
          title="單一 ETF 成分占比"
          description="選擇目前持有的 ETF，查看該 ETF 內部成分權重。"
          action={
            heldEtfRows.length > 0 ? (
              <select
                value={selectedSymbol}
                onChange={(event) => setSelectedEtf(event.target.value)}
                className={`${appInput} w-full sm:min-w-56`}
              >
                {heldEtfRows.map((row) => (
                  <option key={row.metadata.symbol} value={row.metadata.symbol}>
                    {row.metadata.symbol} - {row.metadata.name}
                  </option>
                ))}
              </select>
            ) : null
          }
        />
      </AppCard>

      <ETFExposureTable
        title={
          selectedSymbol
            ? `單一 ETF 成分占比：${selectedSymbol}`
            : "單一 ETF 成分占比"
        }
        rows={singleRows}
        displayCurrency={settings.displayCurrency}
        fxRates={fxRates}
        emptyTitle="尚無可展開 ETF"
        emptyMessage={
          selectedSymbol && !etfComponents[selectedSymbol]
            ? "此 ETF 尚無成分資料，暫時無法展開。"
            : "請先持有至少一檔 ETF。"
        }
        percentageLabel="占此 ETF"
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
    <AppCard>
      <SectionHeader
        title="ETF 成分資料狀態"
        description="ETF 成分資料是公開靜態資料，會隨時間變舊；使用前請確認資料來源與更新日期。"
      />

      {heldEtfRows.length === 0 ? (
        <div className={`mt-4 rounded-2xl p-4 text-sm text-slate-400 ${appMutedSurface}`}>
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
                  className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4"
                >
                  <p className="font-semibold text-slate-100">
                    {symbol} {row.metadata.name}
                  </p>
                  <p className="mt-2 text-sm text-amber-200">
                    此 ETF 尚無成分資料，暫時無法展開。
                  </p>
                </div>
              );
            }

            const showWarning =
              data.dataQuality === "sample" ||
              data.dataQuality === "stale" ||
              data.dataQuality === "partial";

            return (
              <div
                key={row.holding.id}
                className={`rounded-2xl p-4 ${appMutedSurface}`}
              >
                <p className="font-semibold text-slate-100">
                  {symbol} {data.name}
                </p>
                <dl className="mt-3 space-y-1 text-xs text-slate-400">
                  {data.asOfDate ? (
                    <Info label="資料日期" value={data.asOfDate} />
                  ) : null}
                  <Info label="更新日期" value={data.lastUpdated} />
                  <Info label="資料品質" value={getQualityLabel(data.dataQuality)} />
                  <Info
                    label="成分數量"
                    value={`${data.componentCount ?? data.components.length}`}
                  />
                  <Info
                    label="權重合計"
                    value={`${((data.totalWeight ?? 0) * 100).toFixed(1)}%`}
                  />
                </dl>
                <p className="mt-3 text-xs text-slate-400">
                  資料來源說明：{data.sourceNote}
                </p>
                {showWarning ? (
                  <p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-2 text-xs text-amber-200">
                    ETF 成分資料可能不是最新資料，請確認資料來源與更新日期。
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </AppCard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right text-slate-300">{value}</dd>
    </div>
  );
}

function getHeldEtfs(holdingValues: HoldingValue[]) {
  const seen = new Set<string>();
  return holdingValues.filter((row) => {
    if (!isETFAssetType(row.metadata.type)) {
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
  if (quality === "official") return "官方自動更新";
  if (quality === "verified") return "已驗證";
  if (quality === "partial") return "部分資料";
  if (quality === "manual") return "手動維護";
  if (quality === "stale") return "可能過期";
  return "範例資料";
}
