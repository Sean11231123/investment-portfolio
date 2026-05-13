import type { Holding, PortfolioSettings } from "../types/portfolio";
import { formatNumber, formatTWD } from "../utils/format";
import {
  assetTypeLabels,
  getHoldingValueTWD,
  marketLabels,
} from "../utils/portfolioCalculations";

type HoldingsTableProps = {
  holdings: Holding[];
  settings: PortfolioSettings;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
};

export function HoldingsTable({
  holdings,
  settings,
  onEdit,
  onDelete,
}: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[#b6c5c9] bg-white p-8 text-center">
        <h2 className="text-lg font-semibold">尚無持倉</h2>
        <p className="mt-2 text-sm text-[#607078]">
          從上方新增第一筆資產，或手動載入展示資料。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[#d8e0e3] bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#d8e0e3] text-sm">
          <thead className="bg-[#eef3f4] text-left text-[#314249]">
            <tr>
              <Th>代號</Th>
              <Th>名稱</Th>
              <Th>類型</Th>
              <Th>市場</Th>
              <Th>數量</Th>
              <Th>價格</Th>
              <Th>幣別</Th>
              <Th>市值 TWD</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f2]">
            {holdings.map((holding) => (
              <tr key={holding.id} className="hover:bg-[#fafbfb]">
                <Td strong>{holding.symbol}</Td>
                <Td>{holding.name}</Td>
                <Td>{assetTypeLabels[holding.type] ?? holding.type}</Td>
                <Td>{marketLabels[holding.market] ?? holding.market}</Td>
                <Td>{formatNumber(holding.quantity, 6)}</Td>
                <Td>{formatNumber(holding.currentPrice, 4)}</Td>
                <Td>{holding.currency}</Td>
                <Td>{formatTWD(getHoldingValueTWD(holding, settings))}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(holding)}
                      className="rounded-md border border-[#b6c5c9] px-3 py-1.5 text-xs hover:bg-[#eef3f4]"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(holding.id)}
                      className="rounded-md border border-[#d9aaa4] px-3 py-1.5 text-xs text-[#a43f32] hover:bg-[#fff1ef]"
                    >
                      刪除
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
