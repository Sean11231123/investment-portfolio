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
import {
  AppBadge,
  AppButton,
  AppCard,
  EmptyState,
  appMutedSurface,
  appTableHeader,
  appTableRow,
} from "./ui";

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
        message="新增第一筆資產後，這裡會顯示價格、估值、損益與資料狀態。"
      />
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {holdingValues.map((row) => (
          <HoldingCard
            key={row.holding.id}
            row={row}
            fxRates={fxRates}
            displayCurrency={displayCurrency}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      <AppCard padded={false} className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={appTableHeader}>
              <tr>
                <Th>代號</Th>
                <Th>名稱</Th>
                <Th>類型</Th>
                <Th>數量</Th>
                <Th>幣別</Th>
                <Th>價格</Th>
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
                      <PriceStatusDetails row={row} />
                    </Td>
                    <Td>
                      <ActionButtons row={row} onEdit={onEdit} onDelete={onDelete} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AppCard>
    </>
  );
}

function HoldingCard({
  row,
  fxRates,
  displayCurrency,
  onEdit,
  onDelete,
}: {
  row: HoldingValue;
  fxRates: FxRates;
  displayCurrency: Currency;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
}) {
  const priceReason = getPriceReason(row.quote, row.metadata);

  return (
    <AppCard className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-[var(--app-text)]">{row.metadata.symbol}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--app-text-muted)]">
            {row.metadata.name}
          </p>
        </div>
        <AppBadge tone={priceReason.tone} className="shrink-0">
          {priceReason.label}
        </AppBadge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="類型" value={`${assetTypeLabels[row.metadata.type]} / ${marketLabels[row.metadata.market]}`} />
        <Info label="數量" value={`${formatNumber(row.holding.quantity, 6)} ${row.metadata.unitLabel}`} />
        <Info label="價格" value={row.quote.price === null ? priceReason.label : formatNumber(row.quote.price, 6)} />
        <Info
          label="市值"
          value={
            row.marketValueTWD === null
              ? "無法估值"
              : formatDisplayMoney(row.marketValueTWD, displayCurrency, fxRates)
          }
        />
      </div>

      <div className={`rounded-2xl p-3 ${appMutedSurface}`}>
        <PriceStatusDetails row={row} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <AppButton variant="secondary" onClick={() => onEdit(row.holding)}>
          編輯
        </AppButton>
        <AppButton variant="danger" onClick={() => onDelete(row.holding.id)}>
          刪除
        </AppButton>
      </div>
    </AppCard>
  );
}

function PriceStatusDetails({ row }: { row: HoldingValue }) {
  const priceReason = getPriceReason(row.quote, row.metadata);
  const hasUsablePrice =
    row.quote.price !== null &&
    Number.isFinite(row.quote.price) &&
    row.quote.price > 0;

  const shouldShowFriendlyError =
    !hasUsablePrice &&
    row.quote.status === "unavailable" &&
    priceReason.label !== "使用快取價格";

  return (
    <div>
      <AppBadge tone={priceReason.tone}>{priceReason.label}</AppBadge>
      <p className="mt-2 text-xs text-[var(--app-text-subtle)]">
        價格來源：{getSourceLabel(row.quote.source)}
      </p>
      {row.quote.tradeDate ? (
        <p className="text-xs text-[var(--app-text-subtle)]">交易日：{row.quote.tradeDate}</p>
      ) : null}
      <p className="text-xs text-[var(--app-text-subtle)]">
        更新時間：{formatDateTime(row.quote.lastUpdated)}
      </p>
      {shouldShowFriendlyError ? (
        <p className="mt-1 whitespace-normal text-xs text-[var(--app-danger-text)]">
          {getFriendlyPriceError(row.quote.source)}
        </p>
      ) : null}
    </div>
  );
}

function ActionButtons({
  row,
  onEdit,
  onDelete,
}: {
  row: HoldingValue;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <AppButton
        variant="secondary"
        className="min-h-0 px-3 py-1.5 text-xs"
        onClick={() => onEdit(row.holding)}
      >
        編輯
      </AppButton>
      <AppButton
        variant="danger"
        className="min-h-0 px-3 py-1.5 text-xs"
        onClick={() => onDelete(row.holding.id)}
      >
        刪除
      </AppButton>
    </div>
  );
}

function getFriendlyPriceError(source: string) {
  if (source === "static-us-market-json") return "美股靜態價格暫時無法取得。";
  if (source === "static-tw-market-json") return "台股/ETF 靜態價格暫時無法取得。";
  if (source === "Binance") return "Binance 價格暫時無法取得。";
  if (source === "CoinGecko") return "CoinGecko 價格暫時無法取得。";
  return "價格取得失敗。";
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--app-text-subtle)]">{label}</p>
      <p className="mt-1 break-words font-medium text-[var(--app-text)]">{value}</p>
    </div>
  );
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
      className={`whitespace-nowrap px-4 py-3 ${strong ? "font-semibold text-[var(--app-text)]" : "text-[var(--app-text-muted)]"
        }`}
    >
      {children}
    </td>
  );
}
