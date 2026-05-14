import etf0050 from "../../public/data/etf-components/0050.json";
import etf006208 from "../../public/data/etf-components/006208.json";
import etf00878 from "../../public/data/etf-components/00878.json";
import type { ETFComponentMap } from "../types/portfolio";

type ETFComponentDataset = {
  version: 1;
  symbol: string;
  name: string;
  market: "TW";
  sourceNote: string;
  sourceUrl?: string;
  lastUpdated: string;
  dataQuality: "sample" | "manual" | "verified" | "stale";
  componentCount: number;
  totalWeight: number;
  components: {
    symbol: string;
    name: string;
    weight: number;
  }[];
};

const datasets = [etf0050, etf006208, etf00878] as ETFComponentDataset[];

export const etfComponentDatasets = datasets;

export const etfComponents: ETFComponentMap = Object.fromEntries(
  datasets.map((dataset) => [
    dataset.symbol,
    {
      name: dataset.name,
      sourceNote: dataset.sourceNote,
      sourceUrl: dataset.sourceUrl,
      lastUpdated: dataset.lastUpdated,
      dataQuality: dataset.dataQuality,
      componentCount: dataset.componentCount,
      totalWeight: dataset.totalWeight,
      components: dataset.components,
    },
  ]),
);
