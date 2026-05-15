import { useMemo, useState } from "react";
import { HoldingForm } from "../components/HoldingForm";
import { HoldingsTable } from "../components/HoldingsTable";
import { ImportExportPanel } from "../components/ImportExportPanel";
import { AppButton } from "../components/ui";
import type {
  AssetMetadata,
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
  universeAssets?: AssetMetadata[];
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
  universeAssets = [],
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
    () => getPortfolioValuation(holdings, fxRates, priceCache, universeAssets),
    [holdings, fxRates, priceCache, universeAssets],
  );

  function handleSubmit(holding: Holding) {
    onUpsertHolding(holding);
    setEditingHolding(null);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <HoldingForm
        editingHolding={editingHolding}
        universeAssets={universeAssets}
        onSubmit={handleSubmit}
        onCancelEdit={() => setEditingHolding(null)}
      />
      <div className="flex">
        <AppButton className="w-full sm:ml-auto sm:w-auto" onClick={onRefreshPrices} disabled={priceRefreshing}>
          {priceRefreshing ? "更新中" : "更新價格"}
        </AppButton>
      </div>
      <HoldingsTable
        holdings={holdings}
        holdingValues={valuation.holdingValues}
        fxRates={fxRates}
        displayCurrency={settings.displayCurrency}
        onEdit={setEditingHolding}
        onDelete={onDeleteHolding}
      />
      <ImportExportPanel
        holdings={holdings}
        settings={settings}
        onImport={onImportHoldings}
        onImportSettings={onImportSettings}
        onUpdateSettings={onUpdateSettings}
        onLoadDemo={onLoadDemo}
        onClearAll={onClearAll}
      />
    </div>
  );
}
