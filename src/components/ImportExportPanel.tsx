import { useRef, useState } from "react";
import type { Holding, PortfolioSettings } from "../types/portfolio";
import {
  type BackupPreview,
  type BackupPreviewResult,
  createBackupFilename,
  createBackupPayload,
  parseBackupPreview,
} from "../utils/backup";
import { formatDateTime } from "../utils/format";
import { AppButton, AppCard, appMutedSurface, SectionHeader } from "./ui";

type ImportExportPanelProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
  onImport: (holdings: Holding[]) => void;
  onImportSettings: (settings?: PortfolioSettings) => void;
  onUpdateSettings?: (settings: PortfolioSettings) => void;
  onLoadDemo?: () => void;
  onClearAll?: () => void;
  showDemoAndClear?: boolean;
  title?: string;
  description?: string;
};

export function ImportExportPanel({
  holdings,
  settings,
  onImport,
  onImportSettings,
  onUpdateSettings,
  onLoadDemo,
  onClearAll,
  showDemoAndClear = true,
  title = "備份與還原",
  description = "匯出 JSON 備份，或先預覽備份檔內容再匯入取代目前持倉。",
}: ImportExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingImport, setPendingImport] = useState<BackupPreviewResult | null>(
    null,
  );

  function handleExport() {
    const now = new Date();
    const nextSettings: PortfolioSettings = {
      ...settings,
      backup: {
        ...settings.backup,
        lastExportedAt: now.toISOString(),
      },
    };
    const payload = JSON.stringify(
      createBackupPayload(holdings, nextSettings, now),
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = createBackupFilename(now);
    link.click();
    URL.revokeObjectURL(url);
    onUpdateSettings?.(nextSettings);
    setMessage("已下載 JSON 備份。");
    setError("");
    setPendingImport(null);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const result = parseBackupPreview(text);
      setPendingImport(result);

      if (!result.ok) {
        setError(result.error);
        setMessage("");
        return;
      }

      setError("");
      setMessage("備份檔已通過檢查，請確認預覽後再匯入。");
    } catch {
      setPendingImport(null);
      setError("JSON 格式無效，請確認你選擇的是投組備份檔。");
      setMessage("");
    } finally {
      event.target.value = "";
    }
  }

  function handleConfirmImport() {
    if (!pendingImport?.ok) {
      return;
    }

    const importedAt = new Date().toISOString();
    const nextSettings: PortfolioSettings = {
      ...(pendingImport.parsed.settings ?? settings),
      backup: {
        ...(pendingImport.parsed.settings?.backup ?? settings.backup),
        lastImportedAt: importedAt,
        lastImportHoldingCount: pendingImport.parsed.holdings.length,
      },
    };

    onImport(pendingImport.parsed.holdings);
    onImportSettings(nextSettings);
    setMessage("已匯入備份並取代目前持倉。");
    setError("");
    setPendingImport(null);
  }

  function handleCancelImport() {
    setPendingImport(null);
    setMessage("匯入已取消，現有資料未變更。");
    setError("");
  }

  function handleClearAll() {
    if (!onClearAll) {
      return;
    }

    if (window.confirm("確定要清除全部持倉？此動作只會影響目前瀏覽器資料。")) {
      onClearAll();
      setMessage("已清除全部持倉。");
      setError("");
      setPendingImport(null);
    }
  }

  function handleLoadDemo() {
    if (!onLoadDemo) {
      return;
    }

    if (
      window.confirm(
        "載入示範投組會取代目前持倉。示範資料不是你的真實投組，確定要繼續嗎？",
      )
    ) {
      onLoadDemo();
      setMessage("已載入示範投組。");
      setError("");
      setPendingImport(null);
    }
  }

  return (
    <AppCard>
      <SectionHeader title={title} description={description} />
      <div className="mt-4 flex flex-wrap gap-2">
        <AppButton onClick={handleExport}>下載備份</AppButton>
        <AppButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
          選擇備份檔
        </AppButton>
        {showDemoAndClear ? (
          <>
            <AppButton variant="secondary" onClick={handleLoadDemo}>
              載入示範投組
            </AppButton>
            <AppButton variant="danger" onClick={handleClearAll}>
              清除全部
            </AppButton>
          </>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        className="hidden"
      />

      {pendingImport?.ok ? (
        <ImportPreview
          preview={pendingImport.preview}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
        />
      ) : null}

      {message ? (
        <p className="mt-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </AppCard>
  );
}

function ImportPreview({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: BackupPreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={`mt-4 rounded-2xl p-4 ${appMutedSurface}`}>
      <h3 className="font-semibold text-slate-50">匯入預覽</h3>
      <dl className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
        <Info
          label="格式"
          value={preview.detectedFormat === "v2" ? "v2 備份" : "v1 匯入並遷移"}
        />
        <Info label="匯出時間" value={formatDateTime(preview.exportedAt)} />
        <Info label="持倉數量" value={`${preview.holdingCount}`} />
        <Info label="包含設定" value={preview.includesSettings ? "是" : "否"} />
      </dl>
      <div className="mt-3 text-sm text-slate-300">
        <p className="font-medium text-slate-200">包含代號</p>
        <p className="mt-1 break-words text-slate-400">
          {preview.symbols.length > 0 ? preview.symbols.join(", ") : "無"}
        </p>
      </div>
      <p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-sm text-amber-200">
        匯入後會取代目前持倉。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <AppButton onClick={onConfirm}>確認匯入</AppButton>
        <AppButton variant="secondary" onClick={onCancel}>
          取消
        </AppButton>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-100">{value}</dd>
    </div>
  );
}
