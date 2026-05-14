import { useMemo, useState } from "react";
import { HoldingForm } from "../components/HoldingForm";
import { HoldingsTable } from "../components/HoldingsTable";
import { ImportExportPanel } from "../components/ImportExportPanel";
import type {
  FxRates,
  Holding,
  PortfolioSettings,
  PriceQuote,
} from "../types/portfolio";
import { getPortfolioValuation } from "../utils/portfolioCalculations";

type HoldingsPageProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
  fxRates: FxRates;
  priceCache: Record<string, PriceQuote>;
  priceRefreshing: boolean;
  onUpsertHolding: (holding: Holding) => void;
  onDeleteHolding: (id: string) => void;
  onImportHoldings: (holdings: Holding[]) => void;
  onImportSettings: (settings?: PortfolioSettings) => void;
  onUpdateSettings: (settings: PortfolioSettings) => void;
  onLoadDemo: () => void;
  onClearAll: () => void;
  onRefreshPrices: () => void;
};

export function HoldingsPage({
  holdings,
  settings,
  fxRates,
  priceCache,
  priceRefreshing,
  onUpsertHolding,
  onDeleteHolding,
  onImportHoldings,
  onImportSettings,
  onUpdateSettings,
  onLoadDemo,
  onClearAll,
  onRefreshPrices,
}: HoldingsPageProps) {
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const valuation = useMemo(
    () => getPortfolioValuation(holdings, fxRates, priceCache),
    [holdings, fxRates, priceCache],
  );

  function handleSubmit(holding: Holding) {
    onUpsertHolding(holding);
    setEditingHolding(null);
  }

  return (
    <div className="space-y-6">
      <HoldingForm
        editingHolding={editingHolding}
        onSubmit={handleSubmit}
        onCancelEdit={() => setEditingHolding(null)}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRefreshPrices}
          disabled={priceRefreshing}
          className="rounded-md bg-[#1f6f78] px-4 py-2 text-sm font-medium text-white hover:bg-[#185a61] disabled:opacity-60"
        >
          {priceRefreshing ? "更新中" : "更新價格"}
        </button>
      </div>
      <ImportExportPanel
        holdings={holdings}
        settings={settings}
        onImport={onImportHoldings}
        onImportSettings={onImportSettings}
        onUpdateSettings={onUpdateSettings}
        onLoadDemo={onLoadDemo}
        onClearAll={onClearAll}
      />
      <HoldingsTable
        holdings={holdings}
        holdingValues={valuation.holdingValues}
        fxRates={fxRates}
        displayCurrency={settings.displayCurrency}
        onEdit={setEditingHolding}
        onDelete={onDeleteHolding}
      />
    </div>
  );
}
