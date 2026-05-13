import { useState } from "react";
import type { PortfolioSettings } from "../types/portfolio";

type SettingsPanelProps = {
  settings: PortfolioSettings;
  onSave: (settings: PortfolioSettings) => void;
};

export function SettingsPanel({ settings, onSave }: SettingsPanelProps) {
  const [usdToTwd, setUsdToTwd] = useState(String(settings.usdToTwd));
  const [usdtToTwd, setUsdtToTwd] = useState(String(settings.usdtToTwd));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextUsd = Number(usdToTwd);
    const nextUsdt = Number(usdtToTwd);

    if (
      !Number.isFinite(nextUsd) ||
      nextUsd <= 0 ||
      !Number.isFinite(nextUsdt) ||
      nextUsdt <= 0
    ) {
      setError("匯率必須是大於 0 的數字。");
      setMessage("");
      return;
    }

    onSave({ usdToTwd: nextUsd, usdtToTwd: nextUsdt });
    setMessage("設定已儲存。");
    setError("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-[#d8e0e3] bg-white p-5"
    >
      <h2 className="text-lg font-semibold">匯率設定</h2>
      <p className="mt-1 text-sm text-[#607078]">
        TWD 為基準幣別，USD 與 USDT 匯率可手動調整並儲存在本瀏覽器。
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-[#314249]">
          USD to TWD
          <input
            type="number"
            min="0"
            step="any"
            value={usdToTwd}
            onChange={(event) => setUsdToTwd(event.target.value)}
            className="mt-2 w-full rounded-md border border-[#b6c5c9] px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-[#314249]">
          USDT to TWD
          <input
            type="number"
            min="0"
            step="any"
            value={usdtToTwd}
            onChange={(event) => setUsdtToTwd(event.target.value)}
            className="mt-2 w-full rounded-md border border-[#b6c5c9] px-3 py-2"
          />
        </label>
      </div>
      {message ? <p className="mt-3 text-sm text-[#2c6b45]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-[#1f6f78] px-4 py-2 text-sm font-medium text-white hover:bg-[#185a61]"
        >
          儲存設定
        </button>
      </div>
    </form>
  );
}
