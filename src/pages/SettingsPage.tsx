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
    <div className="space-y-5 sm:space-y-6">
      <SettingsPanel
        settings={settings}
        fxRates={fxRates}
        onSave={onSaveSettings}
        onRefreshFx={onRefreshFx}
      />

      <AppCard>
        <SectionHeader
          title="外觀主題"
          description="選擇深色或淺色介面。此設定只會儲存在本機裝置。"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onSaveSettings({ ...settings, theme: "dark" })}
            className={`min-h-11 rounded-2xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]/70 ${settings.theme === "dark"
                ? "bg-[var(--app-primary)] text-[var(--app-primary-text)]"
                : "bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]"
              }`}
          >
            深色
          </button>
          <button
            type="button"
            onClick={() => onSaveSettings({ ...settings, theme: "light" })}
            className={`min-h-11 rounded-2xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]/70 ${settings.theme === "light"
                ? "bg-[var(--app-primary)] text-[var(--app-primary-text)]"
                : "bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]"
              }`}
          >
            淺色
          </button>
        </div>
      </AppCard>

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
          <p className="rounded-2xl border border-[var(--app-warning-bg)] bg-[var(--app-warning-bg)] p-3 text-sm text-[var(--app-warning-text)]">
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
      <p className="text-xs text-[var(--app-text-subtle)]">{label}</p>
      <p className="mt-1 font-semibold text-[var(--app-text)]">{value}</p>
    </div>
  );
}
