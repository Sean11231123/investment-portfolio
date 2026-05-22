import type {
  MacroData,
  MacroDataLoadResult,
  MacroEvent,
  MacroEventsFile,
  MacroIndicator,
  MacroIndicatorHistoryPoint,
  MacroIndicatorsFile,
} from "../types/macro";

const INDICATORS_PATH = "data/macro/macro-indicators.json";
const EVENTS_PATH = "data/macro/macro-events.json";

export async function loadMacroIndicators(): Promise<
  MacroDataLoadResult<MacroIndicatorsFile>
> {
  return loadMacroJson(INDICATORS_PATH, parseMacroIndicatorsFile);
}

export async function loadMacroEvents(): Promise<
  MacroDataLoadResult<MacroEventsFile>
> {
  return loadMacroJson(EVENTS_PATH, parseMacroEventsFile);
}

export async function loadMacroData(): Promise<MacroData> {
  const [indicators, events] = await Promise.all([
    loadMacroIndicators(),
    loadMacroEvents(),
  ]);

  return { indicators, events };
}

export function parseMacroIndicatorsFile(value: unknown): MacroIndicatorsFile {
  const file = expectObject(value, "Macro indicators file");
  if (file.version !== 1) {
    throw new Error("Macro indicators file version must be 1.");
  }
  if (!isValidDateString(file.generatedAt)) {
    throw new Error("Macro indicators generatedAt is invalid.");
  }
  if (!isNonEmptyString(file.source)) {
    throw new Error("Macro indicators source is required.");
  }
  if (!file.indicators || typeof file.indicators !== "object" || Array.isArray(file.indicators)) {
    throw new Error("Macro indicators must be an object.");
  }

  const indicators: Record<string, MacroIndicator> = Object.fromEntries(
    Object.entries(file.indicators as Record<string, unknown>).map(([id, indicator]) => [
      id,
      parseMacroIndicator(id, indicator),
    ]),
  );

  return {
    version: 1,
    generatedAt: file.generatedAt as string,
    source: file.source as string,
    sourceName: optionalString(file.sourceName),
    sourceUrl: optionalString(file.sourceUrl),
    indicatorCount: optionalNumber(file.indicatorCount),
    historyLimit: optionalNumber(file.historyLimit),
    indicators,
    errors: parseStringArray(file.errors),
  };
}

export function parseMacroEventsFile(value: unknown): MacroEventsFile {
  const file = expectObject(value, "Macro events file");
  if (file.version !== 1) {
    throw new Error("Macro events file version must be 1.");
  }
  if (!isValidDateString(file.generatedAt)) {
    throw new Error("Macro events generatedAt is invalid.");
  }
  if (!isNonEmptyString(file.source)) {
    throw new Error("Macro events source is required.");
  }
  if (!Array.isArray(file.events)) {
    throw new Error("Macro events must be an array.");
  }

  return {
    version: 1,
    generatedAt: file.generatedAt as string,
    source: file.source as string,
    sourceUrl: optionalString(file.sourceUrl),
    eventCount: optionalNumber(file.eventCount),
    events: file.events.map(parseMacroEvent),
    errors: parseStringArray(file.errors),
  };
}

async function loadMacroJson<T>(
  path: string,
  parser: (value: unknown) => T,
): Promise<MacroDataLoadResult<T>> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${path}`, {
      cache: "no-cache",
    });
    if (!response.ok) {
      throw new Error(`${path} returned ${response.status}`);
    }

    const data = parser(await response.json());
    return {
      data,
      status: getFileErrors(data).length > 0 ? "partial" : "loaded",
      errors: getFileErrors(data),
    };
  } catch (error) {
    return {
      data: null,
      status: "unavailable",
      errors: [`${path}: ${getErrorMessage(error)}`],
    };
  }
}

function parseMacroIndicator(id: string, value: unknown): MacroIndicator {
  const indicator = expectObject(value, `${id} macro indicator`);
  if (!isNonEmptyString(indicator.name)) {
    throw new Error(`${id}: macro indicator name is required.`);
  }
  if (!isNonEmptyString(indicator.sourceSeriesId)) {
    throw new Error(`${id}: sourceSeriesId is required.`);
  }
  if (!["ok", "partial", "unavailable"].includes(String(indicator.status))) {
    throw new Error(`${id}: status is invalid.`);
  }
  if (!Array.isArray(indicator.history)) {
    throw new Error(`${id}: history must be an array.`);
  }

  return {
    country: stringOrDefault(indicator.country, "US"),
    category: stringOrDefault(indicator.category, "macro"),
    name: indicator.name as string,
    source: stringOrDefault(indicator.source, "BLS"),
    sourceSeriesId: indicator.sourceSeriesId as string,
    period: optionalString(indicator.period) ?? null,
    level: nullableNumber(indicator.level),
    mom: nullableNumber(indicator.mom),
    yoy: nullableNumber(indicator.yoy),
    unit: stringOrDefault(indicator.unit, "index"),
    changeUnit: optionalString(indicator.changeUnit),
    frequency: stringOrDefault(indicator.frequency, "monthly"),
    calculation: optionalString(indicator.calculation),
    note: optionalString(indicator.note),
    status: indicator.status as "ok" | "partial" | "unavailable",
    history: indicator.history.map((point, index) =>
      parseMacroIndicatorHistoryPoint(id, index, point),
    ),
  };
}

function parseMacroIndicatorHistoryPoint(
  id: string,
  index: number,
  value: unknown,
): MacroIndicatorHistoryPoint {
  const point = expectObject(value, `${id} history[${index}]`);
  if (!isNonEmptyString(point.period)) {
    throw new Error(`${id}: history period is required.`);
  }
  return {
    period: point.period as string,
    level: nullableNumber(point.level),
    mom: nullableNumber(point.mom),
    yoy: nullableNumber(point.yoy),
  };
}

function parseMacroEvent(value: unknown): MacroEvent {
  const event = expectObject(value, "Macro event");
  if (!isNonEmptyString(event.id)) {
    throw new Error("Macro event id is required.");
  }
  if (!isNonEmptyString(event.decisionDate)) {
    throw new Error(`${event.id}: decisionDate is required.`);
  }
  const rateDecision = expectObject(event.rateDecision, `${event.id} rateDecision`);
  const links = expectObject(event.links, `${event.id} links`);

  return {
    id: event.id as string,
    country: stringOrDefault(event.country, "US"),
    type: stringOrDefault(event.type, "FOMC"),
    title: stringOrDefault(event.title, "FOMC Meeting"),
    startDate: stringOrDefault(event.startDate, event.decisionDate as string),
    endDate: stringOrDefault(event.endDate, event.decisionDate as string),
    decisionDate: event.decisionDate as string,
    status: parseEventStatus(event.status, event.id as string),
    hasSep: typeof event.hasSep === "boolean" ? event.hasSep : undefined,
    minutesReleaseDate: optionalString(event.minutesReleaseDate) ?? null,
    rateDecision: {
      available: rateDecision.available === true,
      targetRangeLower: nullableNumber(rateDecision.targetRangeLower),
      targetRangeUpper: nullableNumber(rateDecision.targetRangeUpper),
      changeBps: nullableNumber(rateDecision.changeBps),
      unit: "%" as const,
    },
    links: {
      statement: optionalString(links.statement) ?? null,
      implementationNote: optionalString(links.implementationNote) ?? null,
      minutes: optionalString(links.minutes) ?? null,
      pressConference: optionalString(links.pressConference) ?? null,
      sep: optionalString(links.sep) ?? null,
    },
    source: stringOrDefault(event.source, "Federal Reserve"),
    sourceUrl: stringOrDefault(event.sourceUrl, ""),
    lastUpdated: optionalString(event.lastUpdated),
  };
}

function parseEventStatus(value: unknown, id: string) {
  const status = String(value ?? "");
  if (["upcoming", "released", "minutes_pending", "complete"].includes(status)) {
    return status as "upcoming" | "released" | "minutes_pending" | "complete";
  }
  throw new Error(`${id}: event status is invalid.`);
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function getFileErrors(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }
  const errors = (value as { errors?: unknown }).errors;
  return Array.isArray(errors)
    ? errors.filter((item): item is string => typeof item === "string")
    : [];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function stringOrDefault(value: unknown, fallback: string) {
  return optionalString(value) ?? fallback;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isValidDateString(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown macro data load error.";
}
