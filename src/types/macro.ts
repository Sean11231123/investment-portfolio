export type MacroFileStatus = "ok" | "partial" | "unavailable" | "stale";

export type MacroIndicatorStatus = "ok" | "partial" | "unavailable";

export type MacroIndicatorHistoryPoint = {
  period: string;
  level: number | null;
  mom: number | null;
  yoy: number | null;
};

export type MacroIndicator = {
  country: string;
  category: string;
  name: string;
  source: string;
  sourceSeriesId: string;
  period: string | null;
  level: number | null;
  mom: number | null;
  yoy: number | null;
  unit: "index" | "percent_rate" | string;
  changeUnit?: "decimal_return" | "percentage_point" | string;
  frequency: "monthly" | string;
  calculation?: string;
  note?: string;
  status: MacroIndicatorStatus;
  history: MacroIndicatorHistoryPoint[];
};

export type MacroIndicatorsFile = {
  version: 1;
  generatedAt: string;
  source: string;
  sourceName?: string;
  sourceUrl?: string;
  indicatorCount?: number;
  historyLimit?: number;
  indicators: Record<string, MacroIndicator>;
  errors: string[];
};

export type FomcRateDecision = {
  available: boolean;
  targetRangeLower: number | null;
  targetRangeUpper: number | null;
  changeBps: number | null;
  unit: "%";
};

export type MacroEventLinks = {
  statement: string | null;
  implementationNote: string | null;
  minutes: string | null;
  pressConference: string | null;
  sep: string | null;
};

export type MacroEventStatus =
  | "upcoming"
  | "released"
  | "minutes_pending"
  | "complete";

export type MacroEvent = {
  id: string;
  country: string;
  type: "FOMC" | string;
  title: string;
  startDate: string;
  endDate: string;
  decisionDate: string;
  status: MacroEventStatus;
  hasSep?: boolean;
  minutesReleaseDate?: string | null;
  rateDecision: FomcRateDecision;
  links: MacroEventLinks;
  source: string;
  sourceUrl: string;
  lastUpdated?: string;
};

export type MacroEventsFile = {
  version: 1;
  generatedAt: string;
  source: string;
  sourceUrl?: string;
  eventCount?: number;
  events: MacroEvent[];
  errors: string[];
};

export type MacroDataLoadStatus = "loaded" | "partial" | "unavailable";

export type MacroDataLoadResult<T> = {
  data: T | null;
  status: MacroDataLoadStatus;
  errors: string[];
};

export type MacroData = {
  indicators: MacroDataLoadResult<MacroIndicatorsFile>;
  events: MacroDataLoadResult<MacroEventsFile>;
};

export type MacroDataStatus = {
  status: MacroFileStatus;
  label: string;
  indicatorCount: number;
  eventCount: number;
  latestIndicatorPeriod: string | null;
  latestCompletedFomcDate: string | null;
  nextUpcomingFomcDate: string | null;
  generatedAt: {
    indicators: string | null;
    events: string | null;
  };
  errors: string[];
};
