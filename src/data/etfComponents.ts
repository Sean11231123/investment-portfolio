import type { ETFComponentMap } from "../types/portfolio";

export const etfComponents: ETFComponentMap = {
  "0050": {
    name: "元大台灣50",
    sourceNote: "sample/manual data for MVP; update this file before relying on it.",
    lastUpdated: "2026-05-13",
    components: [
      { symbol: "2330", name: "台積電", weight: 0.48 },
      { symbol: "2317", name: "鴻海", weight: 0.06 },
      { symbol: "2454", name: "聯發科", weight: 0.05 },
      { symbol: "2308", name: "台達電", weight: 0.035 },
      { symbol: "2412", name: "中華電", weight: 0.025 },
      { symbol: "2881", name: "富邦金", weight: 0.02 },
      { symbol: "2891", name: "中信金", weight: 0.018 },
      { symbol: "6505", name: "台塑化", weight: 0.014 },
    ],
  },
  "006208": {
    name: "富邦台50",
    sourceNote: "sample/manual data for MVP; update this file before relying on it.",
    lastUpdated: "2026-05-13",
    components: [
      { symbol: "2330", name: "台積電", weight: 0.485 },
      { symbol: "2317", name: "鴻海", weight: 0.058 },
      { symbol: "2454", name: "聯發科", weight: 0.048 },
      { symbol: "2308", name: "台達電", weight: 0.034 },
      { symbol: "2412", name: "中華電", weight: 0.024 },
      { symbol: "2882", name: "國泰金", weight: 0.019 },
      { symbol: "2886", name: "兆豐金", weight: 0.017 },
      { symbol: "1303", name: "南亞", weight: 0.013 },
    ],
  },
  "00878": {
    name: "國泰永續高股息",
    sourceNote: "sample/manual data for MVP; update this file before relying on it.",
    lastUpdated: "2026-05-13",
    components: [
      { symbol: "2382", name: "廣達", weight: 0.07 },
      { symbol: "2357", name: "華碩", weight: 0.06 },
      { symbol: "3231", name: "緯創", weight: 0.055 },
      { symbol: "2324", name: "仁寶", weight: 0.045 },
      { symbol: "2303", name: "聯電", weight: 0.04 },
      { symbol: "2891", name: "中信金", weight: 0.038 },
      { symbol: "2886", name: "兆豐金", weight: 0.035 },
      { symbol: "2412", name: "中華電", weight: 0.03 },
    ],
  },
};
