import type { Currency, FxRates, PortfolioSettings } from "../types/portfolio";
import { formatDateTime, formatNumber } from "../utils/format";

type SettingsPanelProps = {
  settings: PortfolioSettings;
  fxRates: FxRates;
  onSave: (settings: PortfolioSettings) => void;
  onRefreshFx: () => void;
};

export function SettingsPanel({
  settings,
  fxRates,
  onSave,
  onRefreshFx,
}: SettingsPanelProps) {
  return (
    <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">匯率與顯示幣別</h2>
          <p className="mt-1 text-sm text-[#607078]">
            TWD 仍是基準估值幣別，顯示幣別只影響畫面呈現，不會改變持倉資料。
          </p>
        </div>
        <button
          type="button"
          onClick={onRefreshFx}
          className="rounded-md bg-[#1f6f78] px-4 py-2 text-sm font-medium text-white hover:bg-[#185a61]"
        >
          更新匯率
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Info label="FX source" value={fxRates.source} />
        <Info label="USD/TWD" value={formatNumber(fxRates.usdToTwd, 4)} />
        <Info label="USDT/TWD" value={formatNumber(fxRates.usdtToTwd, 4)} />
        <Info label="狀態" value={getFxStatusLabel(fxRates.status)} />
        <Info label="上次更新" value={formatDateTime(fxRates.lastUpdated)} />
        <label className="block text-sm font-medium text-[#314249]">
          顯示幣別
          <select
            value={settings.displayCurrency}
            onChange={(event) =>
              onSave({
                ...settings,
                displayCurrency: event.target.value as Currency,
              })
            }
            className="mt-2 w-full rounded-md border border-[#b6c5c9] bg-white px-3 py-2"
          >
            <option value="TWD">TWD</option>
            <option value="USD">USD</option>
            <option value="USDT">USDT</option>
          </select>
        </label>
      </div>

      {fxRates.error ? (
        <p className="mt-4 rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-3 text-sm text-[#6f5a19]">
          {fxRates.error}
        </p>
      ) : null}
    </section>
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

function getFxStatusLabel(status: FxRates["status"]) {
  if (status === "ok") return "線上更新";
  if (status === "cached") return "使用快取";
  if (status === "fallback") return "使用備援";
  return "錯誤";
}
