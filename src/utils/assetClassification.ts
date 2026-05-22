import { assetTypeLabels } from "../data/assetRegistry";
import type { AssetMetadata } from "../types/portfolio";

const LABELS = {
  listedStock: "\u4e0a\u5e02\u80a1\u7968",
  otcStock: "\u4e0a\u6ac3\u80a1\u7968",
  emergingStock: "\u8208\u6ac3\u80a1\u7968",
  innovationStock: "\u5275\u65b0\u677f\u80a1\u7968",
  listedEtf: "\u4e0a\u5e02 ETF",
  otcEtf: "\u4e0a\u6ac3 ETF",
  domesticFund: "\u5883\u5167\u57fa\u91d1",
} as const;

export function getAssetClassificationLabel(asset: AssetMetadata) {
  if (asset.classificationConfidence === "low") {
    return assetTypeLabels[asset.type];
  }

  if (asset.type === "taiwan_fund") {
    if (asset.exchange === "SITCA" || asset.marketSegment === "fund" || asset.board === "fund") {
      return LABELS.domesticFund;
    }
    return assetTypeLabels[asset.type];
  }

  if (asset.type === "taiwan_stock") {
    if (asset.board === "emerging" || asset.marketSegment === "emerging") {
      return LABELS.emergingStock;
    }
    if (asset.board === "innovation" || asset.marketSegment === "innovation") {
      return LABELS.innovationStock;
    }
    if (asset.exchange === "TPEX" || asset.marketSegment === "otc") {
      return LABELS.otcStock;
    }
    if (asset.exchange === "TWSE" || asset.marketSegment === "listed") {
      return LABELS.listedStock;
    }
  }

  if (asset.type === "taiwan_etf") {
    if (asset.exchange === "TPEX" || asset.marketSegment === "otc") {
      return LABELS.otcEtf;
    }
    if (asset.exchange === "TWSE" || asset.marketSegment === "listed") {
      return LABELS.listedEtf;
    }
  }

  return assetTypeLabels[asset.type];
}
