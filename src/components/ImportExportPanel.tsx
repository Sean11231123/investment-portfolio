import { useRef, useState } from "react";
import type { Holding } from "../types/portfolio";
import { validateHoldings } from "../storage/portfolioStorage";

type ImportExportPanelProps = {
  holdings: Holding[];
  onImport: (holdings: Holding[]) => void;
  onLoadDemo: () => void;
  onClearAll: () => void;
};

export function ImportExportPanel({
  holdings,
  onImport,
  onLoadDemo,
  onClearAll,
}: ImportExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleExport() {
    const payload = JSON.stringify(holdings, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "portfolio-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("已匯出 JSON 備份。");
    setError("");
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!validateHoldings(parsed)) {
        setError("JSON 格式不符合持倉資料結構，未匯入。");
        setMessage("");
        return;
      }

      onImport(parsed);
      setMessage("已匯入 JSON，並取代目前持倉。");
      setError("");
    } catch {
      setError("無法讀取 JSON，請確認檔案內容有效。");
      setMessage("");
    } finally {
      event.target.value = "";
    }
  }

  function handleClearAll() {
    if (window.confirm("確定要清除所有持倉嗎？此動作只會影響本瀏覽器資料。")) {
      onClearAll();
      setMessage("已清除所有持倉。");
      setError("");
    }
  }

  function handleLoadDemo() {
    if (
      window.confirm(
        "載入展示資料會取代目前持倉。展示資料僅供測試，不是實際投資組合。確定載入嗎？",
      )
    ) {
      onLoadDemo();
      setMessage("已載入展示資料。");
      setError("");
    }
  }

  return (
    <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
      <h2 className="text-lg font-semibold">備份與資料管理</h2>
      <p className="mt-1 text-sm text-[#607078]">
        持倉只存在你的瀏覽器 localStorage。展示資料需手動載入。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md bg-[#1f6f78] px-4 py-2 text-sm font-medium text-white hover:bg-[#185a61]"
        >
          匯出 JSON
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-[#b6c5c9] px-4 py-2 text-sm font-medium hover:bg-[#eef3f4]"
        >
          匯入 JSON
        </button>
        <button
          type="button"
          onClick={handleLoadDemo}
          className="rounded-md border border-[#b6c5c9] px-4 py-2 text-sm font-medium hover:bg-[#eef3f4]"
        >
          載入展示投組
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          className="rounded-md border border-[#d9aaa4] px-4 py-2 text-sm font-medium text-[#a43f32] hover:bg-[#fff1ef]"
        >
          清除全部
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        className="hidden"
      />
      {message ? <p className="mt-3 text-sm text-[#2c6b45]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
    </section>
  );
}
