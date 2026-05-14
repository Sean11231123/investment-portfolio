import type { ReactNode } from "react";
import type { Currency, FxRates, Holding, HoldingValue } from "../types/portfolio";
import {
  formatDateTime,
  formatDisplayMoney,
  formatNumber,
  formatPercent,
} from "../utils/format";
import { assetTypeLabels, marketLabels } from "../utils/portfolioCalculations";

type HoldingsTableProps = {
  holdings: Holding[];
  holdingValues: HoldingValue[];
  fxRates: FxRates;
  displayCurrency: Currency;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
};

export function HoldingsTable({
  holdings,
  holdingValues,
  fxRates,
  displayCurrency,
  onEdit,
  onDelete,
}: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[#b6c5c9] bg-white p-8 text-center">
        <h2 className="text-lg font-semibold">尚無持倉</h2>
        <p className="mt-2 text-sm text-[#607078]">
          新增第一筆資產後，這裡會顯示持倉、估值與價格來源。
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
              <Th>數量</Th>
              <Th>幣別</Th>
              <Th>目前價格</Th>
              <Th>市值</Th>
              <Th>損益</Th>
              <Th>價格狀態</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f2]">
            {holdingValues.map((row) => (
              <tr key={row.holding.id} className="hover:bg-[#fafbfb]">
                <Td strong>{row.metadata.symbol}</Td>
                <Td>{row.metadata.name}</Td>
                <Td>
                  {assetTypeLabels[row.metadata.type]} /{" "}
                  {marketLabels[row.metadata.market]}
                </Td>
                <Td>
                  {formatNumber(row.holding.quantity, 6)} {row.metadata.unitLabel}
                </Td>
                <Td>{row.metadata.currency}</Td>
                <Td>
                  {row.quote.price === null
                    ? "價格暫時無法取得"
                    : formatNumber(row.quote.price, 6)}
                </Td>
                <Td>
                  {row.marketValueTWD === null
                    ? "無法估值"
                    : formatDisplayMoney(
                        row.marketValueTWD,
                        displayCurrency,
                        fxRates,
                      )}
                </Td>
                <Td>
                  {row.pnlTWD === null ? (
                    "-"
                  ) : (
                    <span
                      className={
                        row.pnlTWD >= 0 ? "text-[#2c6b45]" : "text-[#b42318]"
                      }
                    >
                      {formatDisplayMoney(row.pnlTWD, displayCurrency, fxRates)}{" "}
                      ({formatPercent(row.pnlPercent ?? 0)})
                    </span>
                  )}
                </Td>
                <Td>
                  <div>
                    <p>{getStatusLabel(row.quote.status)}</p>
                    <p className="text-xs text-[#607078]">
                      價格來源：{getSourceLabel(row.quote.source)}
                    </p>
                    {row.quote.tradeDate ? (
                      <p className="text-xs text-[#607078]">
                        交易日：{row.quote.tradeDate}
                      </p>
                    ) : null}
                    <p className="text-xs text-[#607078]">
                      上次更新：{formatDateTime(row.quote.lastUpdated)}
                    </p>
                    {row.quote.error ? (
                      <p className="max-w-xs whitespace-normal text-xs text-[#b42318]">
                        {row.quote.error}
                      </p>
                    ) : null}
                  </div>
                </Td>
                <Td>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(row.holding)}
                      className="rounded-md border border-[#b6c5c9] px-3 py-1.5 text-xs hover:bg-[#eef3f4]"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row.holding.id)}
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

function getStatusLabel(status: string) {
  if (status === "ok") return "已更新";
  if (status === "cached") return "快取";
  if (status === "error") return "錯誤";
  return "unavailable";
}

function getSourceLabel(source: string) {
  if (source === "static-tw-market-json") return "靜態市場資料";
  if (source === "CoinGecko") return "CoinGecko";
  if (source === "cash") return "現金";
  if (source === "yahoo" || source === "twse") return "台股/ETF adapter";
  return source;
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({
  children,
  strong = false,
}: {
  children: ReactNode;
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
