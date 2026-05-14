import type { ReactNode } from "react";
import type { Currency, FxRates, Holding, HoldingValue } from "../types/portfolio";
import {
  formatDateTime,
  formatDisplayMoney,
  formatNumber,
  formatPercent,
} from "../utils/format";
import { getPriceReason } from "../utils/priceStatus";
import { assetTypeLabels, marketLabels } from "../utils/portfolioCalculations";
import { AppBadge, AppButton, EmptyState, appTableHeader, appTableRow, AppCard } from "./ui";

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
      <EmptyState
        title="尚無持倉"
        message="新增第一筆資產後，這裡會顯示市值、損益、價格來源與更新狀態。"
      />
    );
  }

  return (
    <AppCard padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className={appTableHeader}>
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
          <tbody>
            {holdingValues.map((row) => {
              const priceReason = getPriceReason(row.quote, row.metadata);
              return (
              <tr key={row.holding.id} className={appTableRow}>
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
                    ? priceReason.label
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
                        row.pnlTWD >= 0 ? "text-emerald-300" : "text-rose-300"
                      }
                    >
                      {formatDisplayMoney(row.pnlTWD, displayCurrency, fxRates)}{" "}
                      ({formatPercent(row.pnlPercent ?? 0)})
                    </span>
                  )}
                </Td>
                <Td>
                  <div>
                    <AppBadge tone={priceReason.tone}>
                      {priceReason.label}
                    </AppBadge>
                    <p className="mt-2 text-xs text-slate-400">
                      價格來源：{getSourceLabel(row.quote.source)}
                    </p>
                    {row.quote.tradeDate ? (
                      <p className="text-xs text-slate-400">
                        交易日：{row.quote.tradeDate}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-400">
                      上次更新：{formatDateTime(row.quote.lastUpdated)}
                    </p>
                    {row.quote.error ? (
                      <p className="max-w-xs whitespace-normal text-xs text-rose-300">
                        {row.quote.error}
                      </p>
                    ) : null}
                  </div>
                </Td>
                <Td>
                  <div className="flex gap-2">
                    <AppButton
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => onEdit(row.holding)}
                    >
                      編輯
                    </AppButton>
                    <AppButton
                      variant="danger"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => onDelete(row.holding.id)}
                    >
                      刪除
                    </AppButton>
                  </div>
                </Td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}

function getSourceLabel(source: string) {
  if (source === "static-tw-market-json") return "TWSE 靜態資料";
  if (source === "static-us-market-json") return "US 靜態資料";
  if (source === "Binance") return "Binance";
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
        strong ? "font-semibold text-white" : "text-slate-300"
      }`}
    >
      {children}
    </td>
  );
}
