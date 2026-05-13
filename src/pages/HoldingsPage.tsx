import { useState } from "react";
import { HoldingForm } from "../components/HoldingForm";
import { HoldingsTable } from "../components/HoldingsTable";
import { ImportExportPanel } from "../components/ImportExportPanel";
import type { Holding, PortfolioSettings } from "../types/portfolio";

type HoldingsPageProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
  onUpsertHolding: (holding: Holding) => void;
  onDeleteHolding: (id: string) => void;
  onImportHoldings: (holdings: Holding[]) => void;
  onLoadDemo: () => void;
  onClearAll: () => void;
};

export function HoldingsPage({
  holdings,
  settings,
  onUpsertHolding,
  onDeleteHolding,
  onImportHoldings,
  onLoadDemo,
  onClearAll,
}: HoldingsPageProps) {
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);

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
      <ImportExportPanel
        holdings={holdings}
        onImport={onImportHoldings}
        onLoadDemo={onLoadDemo}
        onClearAll={onClearAll}
      />
      <HoldingsTable
        holdings={holdings}
        settings={settings}
        onEdit={setEditingHolding}
        onDelete={onDeleteHolding}
      />
    </div>
  );
}
