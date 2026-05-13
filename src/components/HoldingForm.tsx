import { useEffect, useMemo, useState } from "react";
import type { AssetType, Currency, Holding, Market } from "../types/portfolio";

type HoldingFormProps = {
  editingHolding?: Holding | null;
  onSubmit: (holding: Holding) => void;
  onCancelEdit: () => void;
};

type FormState = {
  type: AssetType;
  symbol: string;
  name: string;
  quantity: string;
  avgCost: string;
  currentPrice: string;
  currency: Currency;
  market: Market;
  note: string;
};

const emptyForm: FormState = {
  type: "taiwan_stock",
  symbol: "",
  name: "",
  quantity: "",
  avgCost: "",
  currentPrice: "",
  currency: "TWD",
  market: "TW",
  note: "",
};

export function HoldingForm({
  editingHolding,
  onSubmit,
  onCancelEdit,
}: HoldingFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editingHolding) {
      setForm(emptyForm);
      setError("");
      return;
    }

    setForm({
      type: editingHolding.type,
      symbol: editingHolding.symbol,
      name: editingHolding.name,
      quantity: String(editingHolding.quantity),
      avgCost:
        editingHolding.avgCost === undefined ? "" : String(editingHolding.avgCost),
      currentPrice: String(editingHolding.currentPrice),
      currency: editingHolding.currency,
      market: editingHolding.market,
      note: editingHolding.note ?? "",
    });
    setError("");
  }, [editingHolding]);

  const isCash = form.type === "cash";

  useEffect(() => {
    if (isCash && !editingHolding) {
      setForm((current) => ({
        ...current,
        symbol: current.symbol || current.currency,
        name: current.name || `${current.currency} 現金`,
        currentPrice: "1",
        market: "CASH",
      }));
    }
  }, [isCash, editingHolding]);

  const submitLabel = useMemo(
    () => (editingHolding ? "儲存持倉" : "新增持倉"),
    [editingHolding],
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const quantity = Number(form.quantity);
    const currentPrice = Number(form.currentPrice);
    const avgCost = form.avgCost.trim() === "" ? undefined : Number(form.avgCost);

    if (!form.symbol.trim() || !form.name.trim()) {
      setError("請輸入代號與名稱。");
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      setError("數量不可為負數。");
      return;
    }

    if (!Number.isFinite(currentPrice) || currentPrice < 0) {
      setError("目前價格不可為負數。");
      return;
    }

    if (avgCost !== undefined && (!Number.isFinite(avgCost) || avgCost < 0)) {
      setError("平均成本不可為負數。");
      return;
    }

    onSubmit({
      id: editingHolding?.id ?? createId(),
      type: form.type,
      symbol: form.symbol.trim().toUpperCase(),
      name: form.name.trim(),
      quantity,
      avgCost,
      currentPrice,
      currency: form.currency,
      market: form.market,
      note: form.note.trim() || undefined,
    });

    if (!editingHolding) {
      setForm(emptyForm);
    }
    setError("");
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "type") {
        if (value === "taiwan_stock" || value === "taiwan_etf") {
          next.currency = "TWD";
          next.market = "TW";
        }
        if (value === "crypto") {
          next.currency = "USD";
          next.market = "CRYPTO";
        }
        if (value === "cash") {
          next.market = "CASH";
          next.currentPrice = "1";
        }
      }

      return next;
    });
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
            現金可用數量作為金額，價格維持 1。
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
            onChange={(event) =>
              updateField("type", event.target.value as AssetType)
            }
            className="w-full rounded-md border border-[#b6c5c9] bg-white px-3 py-2"
          >
            <option value="taiwan_stock">台股</option>
            <option value="taiwan_etf">台灣 ETF</option>
            <option value="crypto">加密貨幣</option>
            <option value="cash">現金</option>
            <option value="custom">自訂</option>
          </select>
        </Field>
        <Field label="代號">
          <input
            value={form.symbol}
            onChange={(event) => updateField("symbol", event.target.value)}
            placeholder="例如 2330, 0050, BTC"
            className="w-full rounded-md border border-[#b6c5c9] px-3 py-2"
          />
        </Field>
        <Field label="名稱">
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="例如 台積電"
            className="w-full rounded-md border border-[#b6c5c9] px-3 py-2"
          />
        </Field>
        <Field label="市場">
          <select
            value={form.market}
            onChange={(event) =>
              updateField("market", event.target.value as Market)
            }
            className="w-full rounded-md border border-[#b6c5c9] bg-white px-3 py-2"
          >
            <option value="TW">台灣</option>
            <option value="CRYPTO">加密貨幣</option>
            <option value="CASH">現金</option>
            <option value="CUSTOM">自訂</option>
          </select>
        </Field>
        <Field label={isCash ? "金額 / 數量" : "數量"}>
          <input
            type="number"
            min="0"
            step="any"
            value={form.quantity}
            onChange={(event) => updateField("quantity", event.target.value)}
            className="w-full rounded-md border border-[#b6c5c9] px-3 py-2"
          />
        </Field>
        <Field label="平均成本">
          <input
            type="number"
            min="0"
            step="any"
            value={form.avgCost}
            onChange={(event) => updateField("avgCost", event.target.value)}
            className="w-full rounded-md border border-[#b6c5c9] px-3 py-2"
          />
        </Field>
        <Field label="目前價格">
          <input
            type="number"
            min="0"
            step="any"
            value={form.currentPrice}
            onChange={(event) =>
              updateField("currentPrice", event.target.value)
            }
            className="w-full rounded-md border border-[#b6c5c9] px-3 py-2"
          />
        </Field>
        <Field label="幣別">
          <select
            value={form.currency}
            onChange={(event) =>
              updateField("currency", event.target.value as Currency)
            }
            className="w-full rounded-md border border-[#b6c5c9] bg-white px-3 py-2"
          >
            <option value="TWD">TWD</option>
            <option value="USD">USD</option>
            <option value="USDT">USDT</option>
          </select>
        </Field>
      </div>

      <Field label="備註">
        <textarea
          value={form.note}
          onChange={(event) => updateField("note", event.target.value)}
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

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `holding-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
