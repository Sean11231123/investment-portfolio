import { useEffect, useMemo, useState } from "react";
import {
  assetTypeLabels,
} from "../data/assetRegistry";
import {
  getResolvedAssetMetadata,
  searchResolvedAssets,
} from "../data/assetResolver";
import type { AssetMetadata, AssetType, Holding } from "../types/portfolio";
import { AppButton, AppCard, appInput, appMutedSurface, FieldShell, SectionHeader } from "./ui";

type HoldingFormProps = {
  editingHolding?: Holding | null;
  universeAssets?: AssetMetadata[];
  onSubmit: (holding: Holding) => void;
  onCancelEdit: () => void;
};

type FormState = {
  type: AssetType;
  query: string;
  symbol: string;
  quantity: string;
  avgCost: string;
  note: string;
};

const emptyForm: FormState = {
  type: "taiwan_stock",
  query: "",
  symbol: "",
  quantity: "",
  avgCost: "",
  note: "",
};

export function HoldingForm({
  editingHolding,
  universeAssets = [],
  onSubmit,
  onCancelEdit,
}: HoldingFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedAsset, setSelectedAsset] = useState<AssetMetadata | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editingHolding) {
      setForm(emptyForm);
      setSelectedAsset(null);
      setError("");
      return;
    }

    const metadata = getResolvedAssetMetadata(
      editingHolding.symbol,
      editingHolding.type,
      universeAssets,
    );
    setSelectedAsset(metadata ?? null);
    setForm({
      type: editingHolding.type,
      query: metadata
        ? `${metadata.symbol} - ${metadata.name}`
        : editingHolding.symbol,
      symbol: editingHolding.symbol,
      quantity: String(editingHolding.quantity),
      avgCost:
        editingHolding.avgCost === undefined
          ? ""
          : String(editingHolding.avgCost),
      note: editingHolding.note ?? "",
    });
    setError("");
  }, [editingHolding, universeAssets]);

  const suggestions = useMemo(
    () =>
      searchResolvedAssets(form.query, {
        type: form.type,
        universeAssets,
      }),
    [form.query, form.type, universeAssets],
  );
  const quantityLabel = getQuantityLabel(selectedAsset?.type ?? form.type);
  const submitLabel = editingHolding ? "儲存持倉" : "新增持倉";

  function handleTypeChange(type: AssetType) {
    setForm((current) => ({
      ...current,
      type,
      query: "",
      symbol: "",
    }));
    setSelectedAsset(null);
    setError("");
  }

  function handleSelectAsset(asset: AssetMetadata) {
    setSelectedAsset(asset);
    setForm((current) => ({
      ...current,
      type: asset.type,
      query: `${asset.symbol} - ${asset.name}`,
      symbol: asset.symbol,
    }));
    setError("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const quantity = Number(form.quantity);
    const avgCost = form.avgCost.trim() === "" ? undefined : Number(form.avgCost);

    if (!selectedAsset || !form.symbol) {
      setError("請先從搜尋結果選擇一個資產，避免建立不完整持倉。");
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      setError("數量不可為負數。");
      return;
    }

    if (avgCost !== undefined && (!Number.isFinite(avgCost) || avgCost < 0)) {
      setError("平均成本不可為負數。");
      return;
    }

    onSubmit({
      id: editingHolding?.id ?? createId(),
      type: selectedAsset.type,
      symbol: selectedAsset.symbol,
      quantity,
      avgCost,
      note: form.note.trim() || undefined,
    });

    if (!editingHolding) {
      setForm(emptyForm);
      setSelectedAsset(null);
    }
    setError("");
  }

  return (
    <AppCard>
      <form onSubmit={handleSubmit}>
        <SectionHeader
          title={editingHolding ? "編輯持倉" : "新增持倉"}
          description="只輸入資產類型、代號、數量與選填平均成本；名稱、市場、幣別與價格由資料來源帶入。"
          action={
            editingHolding ? (
              <AppButton variant="secondary" onClick={onCancelEdit}>
                取消編輯
              </AppButton>
            ) : null
          }
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="資產類型">
            <select
              value={form.type}
              onChange={(event) => handleTypeChange(event.target.value as AssetType)}
              className={`w-full ${appInput}`}
            >
              <option value="taiwan_stock">台股</option>
              <option value="taiwan_etf">台股 ETF</option>
              <option value="us_stock">美股</option>
              <option value="us_etf">美股 ETF</option>
              <option value="crypto">Crypto</option>
              <option value="cash">Cash</option>
              <option value="custom">Custom</option>
            </select>
          </Field>

          <div className="relative md:col-span-1 xl:col-span-2">
            <Field label="代號搜尋 / 選擇">
              <input
                value={form.query}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    query: event.target.value,
                    symbol: "",
                  }));
                  setSelectedAsset(null);
                }}
                placeholder="搜尋代號或名稱，例如 0050、2330、BTC"
                className={`w-full ${appInput}`}
              />
            </Field>
            {form.query && suggestions.length > 0 && !selectedAsset ? (
              <div className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#111a35] shadow-2xl shadow-black/40">
                {suggestions.map((asset) => (
                  <button
                    key={`${asset.type}-${asset.symbol}`}
                    type="button"
                    onClick={() => handleSelectAsset(asset)}
                    className="block w-full px-4 py-3 text-left text-sm text-slate-100 hover:bg-white/[0.06]"
                  >
                    <span className="font-semibold">{asset.symbol}</span>
                    <span className="text-slate-400"> - {asset.name}</span>
                    <span className="ml-2 text-xs text-violet-200">
                      {assetTypeLabels[asset.type]}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <Field label={quantityLabel}>
            <input
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={(event) =>
                setForm((current) => ({ ...current, quantity: event.target.value }))
              }
              className={`w-full ${appInput}`}
            />
          </Field>

          <Field label="平均成本（選填）">
            <input
              type="number"
              min="0"
              step="any"
              value={form.avgCost}
              onChange={(event) =>
                setForm((current) => ({ ...current, avgCost: event.target.value }))
              }
              className={`w-full ${appInput}`}
            />
          </Field>
        </div>

        {selectedAsset ? (
          <div className={`mt-4 rounded-2xl p-3 text-sm text-slate-300 ${appMutedSurface}`}>
            已選擇 {selectedAsset.symbol} - {selectedAsset.name}，
            {selectedAsset.market} / {selectedAsset.currency} / 價格來源：
            {selectedAsset.priceSource}
            {selectedAsset.priceSource !== "cash" ? (
              <p className="mt-2 text-xs text-slate-400">
                此資產可加入投組，但目前可能尚未追蹤價格。加入後市值可能暫時顯示為未提供。
              </p>
            ) : null}
          </div>
        ) : null}

        <Field label="備註">
          <textarea
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({ ...current, note: event.target.value }))
            }
            rows={2}
            className={`w-full ${appInput}`}
          />
        </Field>

        {error ? (
          <p className="mt-3 rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <AppButton type="submit">{submitLabel}</AppButton>
        </div>
      </form>
    </AppCard>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-300">
      {label}
      <FieldShell className="mt-2">{children}</FieldShell>
    </label>
  );
}

function getQuantityLabel(type: AssetType) {
  if (
    type === "taiwan_stock" ||
    type === "taiwan_etf" ||
    type === "us_stock" ||
    type === "us_etf"
  ) {
    return "股數";
  }

  if (type === "crypto") {
    return "數量";
  }

  if (type === "cash") {
    return "金額";
  }

  return "數量";
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `holding-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
