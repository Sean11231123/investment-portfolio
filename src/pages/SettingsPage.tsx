import { SettingsPanel } from "../components/SettingsPanel";
import type { FxRates, PortfolioSettings } from "../types/portfolio";

type SettingsPageProps = {
  settings: PortfolioSettings;
  fxRates: FxRates;
  onSaveSettings: (settings: PortfolioSettings) => void;
  onRefreshFx: () => void;
};

export function SettingsPage({
  settings,
  fxRates,
  onSaveSettings,
  onRefreshFx,
}: SettingsPageProps) {
  return (
    <div className="space-y-6">
      <SettingsPanel
        settings={settings}
        fxRates={fxRates}
        onSave={onSaveSettings}
        onRefreshFx={onRefreshFx}
      />
      <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
        <h2 className="text-lg font-semibold">本機儲存說明</h2>
        <p className="mt-2 text-sm leading-6 text-[#607078]">
          v2 持倉只儲存代號、類型、數量、平均成本與備註。價格與匯率會線上更新並快取在本瀏覽器；
          換瀏覽器、清除網站資料或使用不同裝置時不會自動同步。請定期從「持倉」匯出 JSON 備份。
        </p>
      </section>
    </div>
  );
}
