import type {
  MacroData,
  MacroDataStatus,
  MacroEventsFile,
  MacroFileStatus,
  MacroIndicatorsFile,
} from "../types/macro";
import type {
  UnifiedStatusRow,
  UnifiedStatusSection,
} from "./unifiedMarketDataStatus";

const INDICATOR_STALE_DAYS = 45;
const EVENT_STALE_DAYS = 14;

const statusLabels: Record<MacroFileStatus, string> = {
  ok: "正常",
  partial: "部分可用",
  unavailable: "尚未載入",
  stale: "資料可能已過期",
};

export function getMacroDataStatus(
  macroData: MacroData,
  now = new Date(),
): MacroDataStatus {
  const indicatorSummary = summarizeIndicatorsFile(
    macroData.indicators.data,
    macroData.indicators.errors,
    now,
  );
  const eventSummary = summarizeEventsFile(
    macroData.events.data,
    macroData.events.errors,
    now,
  );
  const status = combineMacroStatus(indicatorSummary.status, eventSummary.status);

  return {
    status,
    label: statusLabels[status],
    indicatorCount: indicatorSummary.indicatorCount,
    eventCount: eventSummary.eventCount,
    latestIndicatorPeriod: indicatorSummary.latestIndicatorPeriod,
    latestCompletedFomcDate: eventSummary.latestCompletedFomcDate,
    nextUpcomingFomcDate: eventSummary.nextUpcomingFomcDate,
    generatedAt: {
      indicators: macroData.indicators.data?.generatedAt ?? null,
      events: macroData.events.data?.generatedAt ?? null,
    },
    errors: [
      ...macroData.indicators.errors,
      ...macroData.events.errors,
      ...(macroData.indicators.data?.errors ?? []),
      ...(macroData.events.data?.errors ?? []),
    ],
  };
}

export function getMacroStatusSection(
  macroData: MacroData,
  now = new Date(),
): UnifiedStatusSection {
  return {
    id: "macro",
    title: "總經資料 / Macro",
    rows: [
      summarizeMacroIndicatorsRow(macroData.indicators.data, macroData.indicators.errors, now),
      summarizeMacroEventsRow(macroData.events.data, macroData.events.errors, now),
    ],
  };
}

export function summarizeMacroIndicatorsRow(
  file: MacroIndicatorsFile | null,
  loadErrors: string[] = [],
  now = new Date(),
): UnifiedStatusRow {
  const summary = summarizeIndicatorsFile(file, loadErrors, now);
  if (!file) {
    return {
      id: "macro-indicators",
      name: "US macro indicators",
      status: "unavailable",
      statusLabel: statusLabels.unavailable,
      summary: "尚未載入總經指標資料",
      source: "BLS",
      details: loadErrors,
    };
  }

  return {
    id: "macro-indicators",
    name: "US macro indicators",
    status: summary.status,
    statusLabel: statusLabels[summary.status],
    summary: `${summary.indicatorCount.toLocaleString("zh-TW")} indicators, latest ${summary.latestIndicatorPeriod ?? "N/A"}`,
    source: file.source,
    generatedAt: file.generatedAt,
    details: [
      "CPI / Core CPI / PPI / unemployment are loaded from static JSON.",
      "Browser does not call the BLS API directly.",
      ...loadErrors,
      ...file.errors,
    ],
  };
}

export function summarizeMacroEventsRow(
  file: MacroEventsFile | null,
  loadErrors: string[] = [],
  now = new Date(),
): UnifiedStatusRow {
  const summary = summarizeEventsFile(file, loadErrors, now);
  if (!file) {
    return {
      id: "macro-events",
      name: "FOMC events",
      status: "unavailable",
      statusLabel: statusLabels.unavailable,
      summary: "尚未載入 FOMC 事件資料",
      source: "Federal Reserve",
      details: loadErrors,
    };
  }

  return {
    id: "macro-events",
    name: "FOMC events",
    status: summary.status,
    statusLabel: statusLabels[summary.status],
    summary: `${summary.eventCount.toLocaleString("zh-TW")} events, next ${summary.nextUpcomingFomcDate ?? "N/A"}`,
    source: file.source,
    generatedAt: file.generatedAt,
    details: [
      `Latest completed FOMC: ${summary.latestCompletedFomcDate ?? "N/A"}`,
      "Official links and target ranges only; no summaries or predictions.",
      ...loadErrors,
      ...file.errors,
    ],
  };
}

function summarizeIndicatorsFile(
  file: MacroIndicatorsFile | null,
  loadErrors: string[],
  now: Date,
) {
  if (!file) {
    return {
      status: "unavailable" as const,
      indicatorCount: 0,
      latestIndicatorPeriod: null,
    };
  }

  const indicators = Object.values(file.indicators);
  const latestIndicatorPeriod =
    indicators
      .map((indicator) => indicator.period)
      .filter((period): period is string => Boolean(period))
      .sort()
      .at(-1) ?? null;
  const status = getFileStatus({
    generatedAt: file.generatedAt,
    staleDays: INDICATOR_STALE_DAYS,
    hasData: indicators.length > 0,
    hasErrors: loadErrors.length > 0 || file.errors.length > 0,
    now,
  });

  return {
    status,
    indicatorCount: file.indicatorCount ?? indicators.length,
    latestIndicatorPeriod,
  };
}

function summarizeEventsFile(
  file: MacroEventsFile | null,
  loadErrors: string[],
  now: Date,
) {
  if (!file) {
    return {
      status: "unavailable" as const,
      eventCount: 0,
      latestCompletedFomcDate: null,
      nextUpcomingFomcDate: null,
    };
  }

  const latestCompletedFomcDate =
    file.events
      .filter((event) => ["released", "minutes_pending", "complete"].includes(event.status))
      .map((event) => event.decisionDate)
      .sort()
      .at(-1) ?? null;
  const nextUpcomingFomcDate =
    file.events
      .filter((event) => event.status === "upcoming")
      .map((event) => event.decisionDate)
      .sort()
      .at(0) ?? null;
  const status = getFileStatus({
    generatedAt: file.generatedAt,
    staleDays: EVENT_STALE_DAYS,
    hasData: file.events.length > 0,
    hasErrors: loadErrors.length > 0 || file.errors.length > 0,
    now,
  });

  return {
    status,
    eventCount: file.eventCount ?? file.events.length,
    latestCompletedFomcDate,
    nextUpcomingFomcDate,
  };
}

function getFileStatus({
  generatedAt,
  staleDays,
  hasData,
  hasErrors,
  now,
}: {
  generatedAt: string;
  staleDays: number;
  hasData: boolean;
  hasErrors: boolean;
  now: Date;
}): MacroFileStatus {
  if (!hasData) {
    return "unavailable";
  }
  if (isStale(generatedAt, staleDays, now)) {
    return "stale";
  }
  return hasErrors ? "partial" : "ok";
}

function combineMacroStatus(
  indicators: MacroFileStatus,
  events: MacroFileStatus,
): MacroFileStatus {
  if (indicators === "unavailable" && events === "unavailable") {
    return "unavailable";
  }
  if (indicators === "stale" || events === "stale") {
    return "stale";
  }
  if (indicators !== "ok" || events !== "ok") {
    return "partial";
  }
  return "ok";
}

function isStale(generatedAt: string, staleDays: number, now: Date) {
  const generated = Date.parse(generatedAt);
  if (Number.isNaN(generated)) {
    return true;
  }
  return now.getTime() - generated > staleDays * 24 * 60 * 60 * 1000;
}
