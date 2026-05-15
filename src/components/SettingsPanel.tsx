import type { Currency, FxRates, PortfolioSettings } from "../types/portfolio";
import { formatDateTime, formatNumber } from "../utils/format";
import { AppButton, AppCard, appInput, appMutedSurface, SectionHeader } from "./ui";

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
    <AppCard>
      <SectionHeader
        title="匯率與顯示"
        description="TWD 仍是基準估值幣別，顯示幣別可隨時切換，不會改變持倉資料。"
        action={<AppButton onClick={onRefreshFx}>更新匯率</AppButton>}
      />

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Info label="FX source" value={fxRates.source} />
        <Info label="USD/TWD" value={formatNumber(fxRates.usdToTwd, 4)} />
        <Info label="USDT/TWD" value={formatNumber(fxRates.usdtToTwd, 4)} />
        <Info label="狀態" value={getFxStatusLabel(fxRates.status)} />
        <Info label="上次更新" value={formatDateTime(fxRates.lastUpdated)} />
        <label className="block text-sm font-medium text-[var(--app-text)]">
          顯示幣別
          <select
            value={settings.displayCurrency}
            onChange={(event) =>
              onSave({
                ...settings,
                displayCurrency: event.target.value as Currency,
              })
            }
            className={`mt-2 w-full ${appInput}`}
          >
            <option value="TWD">TWD</option>
            <option value="USD">USD</option>
            <option value="USDT">USDT</option>
          </select>
        </label>
      </div>

      {fxRates.error ? (
        <p className="mt-4 rounded-2xl border border-[var(--app-warning-bg)] bg-[var(--app-warning-bg)] p-3 text-sm text-[var(--app-warning-text)]">
          {fxRates.error}
        </p>
      ) : null}
    </AppCard>
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

function getFxStatusLabel(status: FxRates["status"]) {
  if (status === "ok") return "線上更新";
  if (status === "cached") return "使用快取";
  if (status === "fallback") return "使用備援";
  return "錯誤";
}
