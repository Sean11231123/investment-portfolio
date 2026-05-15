import type { AllocationRow, Currency, FxRates } from "../types/portfolio";
import { formatDisplayMoney, formatPercent } from "../utils/format";
import { AppCard, appTableHeader, appTableRow } from "./ui";

type CurrencyAllocationTableProps = {
  rows: AllocationRow[];
  displayCurrency: Currency;
  fxRates: FxRates;
};

export function CurrencyAllocationTable({
  rows,
  displayCurrency,
  fxRates,
}: CurrencyAllocationTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <AppCard>
      <h2 className="text-lg font-semibold text-[var(--app-text)]">幣別配置</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className={appTableHeader}>
            <tr>
              <th className="px-4 py-3 font-semibold">幣別</th>
              <th className="px-4 py-3 font-semibold">金額 {displayCurrency}</th>
              <th className="px-4 py-3 font-semibold">占比</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={appTableRow}>
                <td className="px-4 py-3 font-semibold text-[var(--app-text)]">{row.label}</td>
                <td className="px-4 py-3 text-[var(--app-text-muted)]">
                  {formatDisplayMoney(row.valueTWD, displayCurrency, fxRates)}
                </td>
                <td className="px-4 py-3 text-[var(--app-text-muted)]">{formatPercent(row.percentage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}
