export function formatTWD(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("zh-TW", {
    maximumFractionDigits,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${formatNumber(value, 2)}%`;
}
