import { SettingsPanel } from "../components/SettingsPanel";
import type { PortfolioSettings } from "../types/portfolio";

type SettingsPageProps = {
  settings: PortfolioSettings;
  onSaveSettings: (settings: PortfolioSettings) => void;
};

export function SettingsPage({
  settings,
  onSaveSettings,
}: SettingsPageProps) {
  return (
    <div className="space-y-6">
      <SettingsPanel settings={settings} onSave={onSaveSettings} />
      <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
        <h2 className="text-lg font-semibold">本機儲存說明</h2>
        <p className="mt-2 text-sm leading-6 text-[#607078]">
          持倉與匯率設定儲存在本瀏覽器 localStorage。換瀏覽器、清除網站資料或使用不同裝置時，
          不會自動同步資料。請定期從「持倉」匯出 JSON 備份。
        </p>
      </section>
    </div>
  );
}
