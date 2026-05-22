import { describe, expect, it } from "vitest";
import { assetTypeLabels } from "../data/assetRegistry";
import type { HoldingValue } from "../types/portfolio";
import { getQuantityLabel, getAvgCostLabel } from "./HoldingForm";
import { getQuoteDateLabel, getQuoteValueLabel } from "./HoldingsTable";

const fundRow: HoldingValue = {
  holding: {
    id: "fund",
    type: "taiwan_fund",
    symbol: "TW_FUND_00512527_TWD_AH22_00957B",
    quantity: 10,
    avgCost: 12,
  },
  metadata: {
    symbol: "TW_FUND_00512527_TWD_AH22_00957B",
    name: "兆豐美國企業優選投資級公司債ETF基金",
    type: "taiwan_fund",
    market: "TW",
    currency: "TWD",
    unitLabel: "單位",
    priceSource: "fund_nav_tw",
  },
  quote: {
    symbol: "TW_FUND_00512527_TWD_AH22_00957B",
    price: 13.3281,
    currency: "TWD",
    source: "static-tw-fund-nav-json",
    navDate: "2026-05-20",
    tradeDate: "2026-05-20",
    status: "ok",
  },
  marketValueTWD: 133.281,
  costBasisTWD: 120,
  pnlTWD: 13.281,
  pnlPercent: 11.0675,
};

describe("fund holding UI labels", () => {
  it("labels domestic funds in asset type selectors and allocation", () => {
    expect(assetTypeLabels.taiwan_fund).toBe("境內基金");
  });

  it("uses fund unit labels in the holding form", () => {
    expect(getQuantityLabel("taiwan_fund")).toBe("單位");
    expect(getAvgCostLabel("taiwan_fund")).toBe("平均成本 / 單位");
  });

  it("uses NAV labels for fund holdings table rows", () => {
    expect(getQuoteValueLabel(fundRow)).toBe("淨值");
    expect(getQuoteDateLabel(fundRow)).toBe("淨值日期");
  });
});
