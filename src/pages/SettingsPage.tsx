import { ImportExportPanel } from "../components/ImportExportPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import type { FxRates, Holding, PortfolioSettings } from "../types/portfolio";
import { formatDateTime } from "../utils/format";

type SettingsPageProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
  fxRates: FxRates;
  onSaveSettings: (settings: PortfolioSettings) => void;
  onImportHoldings: (holdings: Holding[]) => void;
  onRefreshFx: () => void;
};

export function SettingsPage({
  holdings,
  settings,
  fxRates,
  onSaveSettings,
  onImportHoldings,
  onRefreshFx,
}: SettingsPageProps) {
  const backup = settings.backup;
  const showNeverExportedReminder = holdings.length > 0 && !backup?.lastExportedAt;

  return (
    <div className="space-y-6">
      <SettingsPanel
        settings={settings}
        fxRates={fxRates}
        onSave={onSaveSettings}
        onRefreshFx={onRefreshFx}
      />

      <section className="space-y-4 rounded-md border border-[#d8e0e3] bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold">備份與還原</h2>
          <p className="mt-2 text-sm leading-6 text-[#607078]">
            你的投組資料只存在此瀏覽器。清除瀏覽器資料、換裝置或換瀏覽器時，資料不會自動同步。請定期匯出 JSON 備份。
          </p>
        </div>

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
          <p className="rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-3 text-sm text-[#6f5a19]">
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

      <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
        <h2 className="text-lg font-semibold">資料儲存說明</h2>
        <p className="mt-2 text-sm leading-6 text-[#607078]">
          v2 持倉與設定只會儲存在目前瀏覽器的 localStorage。GitHub repo 不會儲存你的個人投組資料。
        </p>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d8e0e3] bg-[#fafbfb] p-4">
      <p className="text-xs text-[#607078]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
