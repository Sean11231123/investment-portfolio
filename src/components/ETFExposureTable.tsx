import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ETFExposureRow } from "../types/portfolio";
import { formatPercent, formatTWD } from "../utils/format";

type ETFExposureTableProps = {
  rows: ETFExposureRow[];
};

export function ETFExposureTable({ rows }: ETFExposureTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[#b6c5c9] bg-white p-8 text-center">
        <h2 className="text-lg font-semibold">目前沒有可展開的 ETF 暴險</h2>
        <p className="mt-2 text-sm text-[#607078]">
          新增 0050、006208 或 00878 後，這裡會顯示樣本成分資料推算的間接暴險。
        </p>
      </div>
    );
  }

  const chartData = rows.slice(0, 8).map((row) => ({
    symbol: row.symbol,
    direct: row.directExposureTWD,
    indirect: row.indirectExposureTWD,
  }));

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-[#d8e0e3] bg-white p-5">
        <h2 className="text-lg font-semibold">ETF 展開暴險</h2>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8e0e3" />
              <XAxis dataKey="symbol" />
              <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
              <Tooltip formatter={(value) => formatTWD(Number(value))} />
              <Bar dataKey="direct" name="直接暴險" stackId="a" fill="#1f6f78" />
              <Bar
                dataKey="indirect"
                name="ETF 間接暴險"
                stackId="a"
                fill="#d88c3a"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-[#d8e0e3] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#d8e0e3] text-sm">
            <thead className="bg-[#eef3f4] text-left text-[#314249]">
              <tr>
                <Th>代號</Th>
                <Th>名稱</Th>
                <Th>直接暴險 TWD</Th>
                <Th>ETF 間接暴險 TWD</Th>
                <Th>總暴險 TWD</Th>
                <Th>投組占比</Th>
                <Th>來源 ETF</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f2]">
              {rows.map((row) => (
                <tr key={row.symbol} className="hover:bg-[#fafbfb]">
                  <Td strong>{row.symbol}</Td>
                  <Td>{row.name}</Td>
                  <Td>{formatTWD(row.directExposureTWD)}</Td>
                  <Td>{formatTWD(row.indirectExposureTWD)}</Td>
                  <Td>{formatTWD(row.totalExposureTWD)}</Td>
                  <Td>{formatPercent(row.portfolioPercentage)}</Td>
                  <Td>{row.sourceEtfs.length ? row.sourceEtfs.join(", ") : "-"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-3 ${
        strong ? "font-semibold text-[#172026]" : "text-[#314249]"
      }`}
    >
      {children}
    </td>
  );
}
