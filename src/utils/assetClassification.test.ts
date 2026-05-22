import { describe, expect, it } from "vitest";
import { assetTypeLabels } from "../data/assetRegistry";
import type { AssetMetadata } from "../types/portfolio";
import { getAssetClassificationLabel } from "./assetClassification";

const base: AssetMetadata = {
  symbol: "0050",
  name: "Test",
  type: "taiwan_etf",
  market: "TW",
  currency: "TWD",
  unitLabel: "\u80a1" as AssetMetadata["unitLabel"],
  priceSource: "twse",
};

function asset(overrides: Partial<AssetMetadata>): AssetMetadata {
  return { ...base, ...overrides };
}

describe("asset classification labels", () => {
  it("labels TWSE listed stocks", () => {
    expect(
      getAssetClassificationLabel(
        asset({
          type: "taiwan_stock",
          exchange: "TWSE",
          marketSegment: "listed",
          board: "main",
          securityType: "stock",
          classificationConfidence: "high",
        }),
      ),
    ).toBe("\u4e0a\u5e02\u80a1\u7968");
  });

  it("labels TPEx OTC stocks", () => {
    expect(
      getAssetClassificationLabel(
        asset({
          type: "taiwan_stock",
          exchange: "TPEX",
          marketSegment: "otc",
          board: "main",
          securityType: "stock",
          classificationConfidence: "high",
        }),
      ),
    ).toBe("\u4e0a\u6ac3\u80a1\u7968");
  });

  it("labels TWSE and TPEx ETFs", () => {
    expect(
      getAssetClassificationLabel(
        asset({
          type: "taiwan_etf",
          exchange: "TWSE",
          marketSegment: "listed",
          securityType: "etf",
          classificationConfidence: "high",
        }),
      ),
    ).toBe("\u4e0a\u5e02 ETF");

    expect(
      getAssetClassificationLabel(
        asset({
          type: "taiwan_etf",
          exchange: "TPEX",
          marketSegment: "otc",
          securityType: "etf",
          classificationConfidence: "high",
        }),
      ),
    ).toBe("\u4e0a\u6ac3 ETF");
  });

  it("labels future emerging and innovation metadata without new asset types", () => {
    expect(
      getAssetClassificationLabel(
        asset({
          type: "taiwan_stock",
          board: "emerging",
          classificationConfidence: "high",
        }),
      ),
    ).toBe("\u8208\u6ac3\u80a1\u7968");

    expect(
      getAssetClassificationLabel(
        asset({
          type: "taiwan_stock",
          board: "innovation",
          classificationConfidence: "high",
        }),
      ),
    ).toBe("\u5275\u65b0\u677f\u80a1\u7968");
  });

  it("labels domestic funds", () => {
    expect(
      getAssetClassificationLabel(
        asset({
          type: "taiwan_fund",
          priceSource: "fund_nav_tw",
          exchange: "SITCA",
          marketSegment: "fund",
          board: "fund",
          securityType: "fund",
          classificationConfidence: "high",
        }),
      ),
    ).toBe("\u5883\u5167\u57fa\u91d1");
  });

  it("falls back when metadata is missing or low confidence", () => {
    expect(getAssetClassificationLabel(asset({ type: "taiwan_stock" }))).toBe(
      assetTypeLabels.taiwan_stock,
    );
    expect(
      getAssetClassificationLabel(
        asset({
          type: "taiwan_stock",
          exchange: "TPEX",
          marketSegment: "otc",
          classificationConfidence: "low",
        }),
      ),
    ).toBe(assetTypeLabels.taiwan_stock);
  });
});
