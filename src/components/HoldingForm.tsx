import { useEffect, useMemo, useState } from "react";
import {
  assetTypeLabels,
  getAssetMetadata,
  searchAssets,
} from "../data/assetRegistry";
import type { AssetMetadata, AssetType, Holding } from "../types/portfolio";

type HoldingFormProps = {
  editingHolding?: Holding | null;
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

    const metadata = getAssetMetadata(editingHolding.symbol, editingHolding.type);
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
  }, [editingHolding]);

  const suggestions = useMemo(
    () => searchAssets(form.query, form.type),
    [form.query, form.type],
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
      setError("請先從搜尋結果選擇代號，不會自動建立不完整持倉。");
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
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-[#d8e0e3] bg-white p-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {editingHolding ? "編輯持倉" : "新增持倉"}
          </h2>
          <p className="mt-1 text-sm text-[#607078]">
            名稱、市場、幣別與目前價格會由資產資料與價格來源帶入。
          </p>
        </div>
        {editingHolding ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-md border border-[#b6c5c9] px-3 py-2 text-sm text-[#314249] hover:bg-[#eef3f4]"
          >
            取消編輯
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="資產類型">
          <select
            value={form.type}
            onChange={(event) => handleTypeChange(event.target.value as AssetType)}
            className="w-full rounded-md border border-[#b6c5c9] bg-white px-3 py-2"
          >
            <option value="taiwan_stock">台股</option>
            <option value="taiwan_etf">台股 ETF</option>
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
              placeholder="搜尋代號或名稱，例如 00、2330、BTC"
              className="w-full rounded-md border border-[#b6c5c9] px-3 py-2"
            />
          </Field>
          {form.query && suggestions.length > 0 && !selectedAsset ? (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-[#b6c5c9] bg-white shadow-lg">
              {suggestions.map((asset) => (
                <button
                  key={`${asset.type}-${asset.symbol}`}
                  type="button"
                  onClick={() => handleSelectAsset(asset)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[#eef3f4]"
                >
                  <span className="font-semibold">{asset.symbol}</span>
                  <span className="text-[#607078]"> - {asset.name}</span>
                  <span className="ml-2 text-xs text-[#607078]">
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
            className="w-full rounded-md border border-[#b6c5c9] px-3 py-2"
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
            className="w-full rounded-md border border-[#b6c5c9] px-3 py-2"
          />
        </Field>
      </div>

      {selectedAsset ? (
        <div className="mt-4 rounded-md bg-[#eef3f4] p-3 text-sm text-[#314249]">
          已選擇：{selectedAsset.symbol} - {selectedAsset.name}，
          {selectedAsset.market} / {selectedAsset.currency} / 價格來源：
          {selectedAsset.priceSource}
        </div>
      ) : null}

      <Field label="備註">
        <textarea
          value={form.note}
          onChange={(event) =>
            setForm((current) => ({ ...current, note: event.target.value }))
          }
          rows={2}
          className="mt-2 w-full rounded-md border border-[#b6c5c9] px-3 py-2"
        />
      </Field>

      {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-[#1f6f78] px-4 py-2 text-sm font-medium text-white hover:bg-[#185a61]"
        >
          {submitLabel}
        </button>
      </div>
    </form>
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
    <label className="block text-sm font-medium text-[#314249]">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function getQuantityLabel(type: AssetType) {
  if (type === "taiwan_stock" || type === "taiwan_etf") {
    return "數量（股）";
  }
  if (type === "crypto") {
    return "數量（顆）";
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
