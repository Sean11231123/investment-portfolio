import type { Currency, FxRates } from "../types/portfolio";
import { convertFromTWD } from "../services/fxService";

export function formatMoney(value: number, currency: Currency = "TWD") {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "TWD" ? 0 : 2,
  }).format(value);
}

export function formatTWD(value: number) {
  return formatMoney(value, "TWD");
}

export function formatDisplayMoney(
  valueTWD: number,
  displayCurrency: Currency,
  fxRates: FxRates,
) {
  return formatMoney(
    convertFromTWD(valueTWD, displayCurrency, fxRates),
    displayCurrency,
  );
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("zh-TW", {
    maximumFractionDigits,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${formatNumber(value, 2)}%`;
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "尚未更新";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
