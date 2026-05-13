import type { AllocationRow } from "../types/portfolio";
import { formatPercent, formatTWD } from "../utils/format";

type CurrencyAllocationTableProps = {
  rows: AllocationRow[];
};

export function CurrencyAllocationTable({
  rows,
}: CurrencyAllocationTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-[#d8e0e3] bg-white p-5">
      <h2 className="text-lg font-semibold">幣別配置</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-[#d8e0e3] text-sm">
          <thead className="bg-[#eef3f4] text-left text-[#314249]">
            <tr>
              <th className="px-4 py-3 font-semibold">幣別</th>
              <th className="px-4 py-3 font-semibold">市值 TWD</th>
              <th className="px-4 py-3 font-semibold">占比</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f2]">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-3 font-semibold">{row.label}</td>
                <td className="px-4 py-3">{formatTWD(row.valueTWD)}</td>
                <td className="px-4 py-3">{formatPercent(row.percentage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
