import type { Holding } from "../types/portfolio";

export const demoPortfolio: Holding[] = [
  {
    id: "demo-2330",
    type: "taiwan_stock",
    symbol: "2330",
    quantity: 10,
    avgCost: 700,
    note: "Demo data only",
  },
  {
    id: "demo-0050",
    type: "taiwan_etf",
    symbol: "0050",
    quantity: 20,
    avgCost: 150,
    note: "Demo data only",
  },
  {
    id: "demo-btc",
    type: "crypto",
    symbol: "BTC",
    quantity: 0.05,
    avgCost: 65000,
    note: "Demo data only",
  },
  {
    id: "demo-cash-twd",
    type: "cash",
    symbol: "TWD",
    quantity: 50000,
    note: "Demo data only",
  },
];
