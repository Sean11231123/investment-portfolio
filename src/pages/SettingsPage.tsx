import { ImportExportPanel } from "../components/ImportExportPanel";
import { MarketDataStatusCard } from "../components/MarketDataStatusCard";
import { SettingsPanel } from "../components/SettingsPanel";
import { AppCard, appMutedSurface, SectionHeader } from "../components/ui";
import type {
  AssetMetadata,
  FxRates,
  Holding,
  PortfolioSettings,
  PriceQuote,
} from "../types/portfolio";
import type { UniverseFileSummary } from "../types/universe";
import { formatDateTime } from "../utils/format";
import { getPortfolioValuation } from "../utils/portfolioCalculations";

type SettingsPageProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
  fxRates: FxRates;
  priceCache: Record<string, PriceQuote>;
  universeAssets?: AssetMetadata[];
  universeFiles?: UniverseFileSummary[];
  onSaveSettings: (settings: PortfolioSettings) => void;
  onImportHoldings: (holdings: Holding[]) => void;
  onRefreshFx: () => void;
};

export function SettingsPage({
  holdings,
  settings,
  fxRates,
  priceCache,
  universeAssets = [],
  universeFiles = [],
  onSaveSettings,
  onImportHoldings,
  onRefreshFx,
}: SettingsPageProps) {
  const backup = settings.backup;
  const showNeverExportedReminder = holdings.length > 0 && !backup?.lastExportedAt;
  const valuation = getPortfolioValuation(
    holdings,
    fxRates,
    priceCache,
    universeAssets,
  );

  return (
    <div className="space-y-6">
      <SettingsPanel
        settings={settings}
        fxRates={fxRates}
        onSave={onSaveSettings}
        onRefreshFx={onRefreshFx}
      />

      <MarketDataStatusCard
        holdingValues={valuation.holdingValues}
        fxRates={fxRates}
        universeAssets={universeAssets}
        universeFiles={universeFiles}
      />

      <section className="space-y-4">
        <SectionHeader
          title="備份與還原"
          description="你的投組資料只存在此瀏覽器。清除瀏覽器資料、換裝置或換瀏覽器時，資料不會自動同步。請定期匯出 JSON 備份。"
        />

        <div className="grid gap-3 md:grid-cols-4">
          <Info label="目前持倉數" value={`${holdings.length}`} />
          <Info label="上次備份" value={formatDateTime(backup?.lastExportedAt)} />
          <Info label="上次匯入" value={formatDateTime(backup?.lastImportedAt)} />
          <Info
            label="上次匯入筆數"
            value={
              backup?.lastImportHoldingCount === undefined
                ? "尚未匯入"
                : `${backup.lastImportHoldingCount}`
            }
          />
        </div>

        {showNeverExportedReminder ? (
          <p className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-sm text-amber-200">
            你目前有持倉，但尚未記錄過備份。建議下載一份 JSON 備份。
          </p>
        ) : null}

        <ImportExportPanel
          holdings={holdings}
          settings={settings}
          onImport={onImportHoldings}
          onImportSettings={(nextSettings) =>
            nextSettings ? onSaveSettings(nextSettings) : undefined
          }
          onUpdateSettings={onSaveSettings}
          showDemoAndClear={false}
          title="手動備份"
          description="下載目前投組的 JSON 備份，或先預覽備份檔內容再匯入取代目前持倉。"
        />
      </section>

      <AppCard>
        <SectionHeader
          title="資料儲存說明"
          description="v2 持倉與設定只會儲存在目前瀏覽器的 localStorage。GitHub repo 不會儲存你的個人投組資料。"
        />
      </AppCard>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className={`rounded-2xl p-4 ${appMutedSurface}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-100">{value}</p>
    </div>
  );
}
