import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadMacroData,
  loadMacroEvents,
  loadMacroIndicators,
  parseMacroEventsFile,
  parseMacroIndicatorsFile,
} from "./macroDataService";

function response(ok: boolean, data: unknown, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

const indicatorsFixture = {
  version: 1,
  generatedAt: "2026-05-22T00:00:00.000Z",
  source: "BLS",
  sourceName: "U.S. Bureau of Labor Statistics Public Data API",
  sourceUrl: "https://api.bls.gov/publicAPI/v2/timeseries/data/",
  indicatorCount: 2,
  historyLimit: 24,
  indicators: {
    US_CPI: {
      country: "US",
      category: "inflation",
      name: "US CPI",
      source: "BLS",
      sourceSeriesId: "CUSR0000SA0",
      period: "2026-04",
      level: 332.407,
      mom: 0.0064,
      yoy: 0.037792,
      unit: "index",
      changeUnit: "decimal_return",
      frequency: "monthly",
      status: "ok",
      history: [
        { period: "2026-03", level: 330.292, mom: 0.001, yoy: 0.03 },
        { period: "2026-04", level: 332.407, mom: 0.0064, yoy: 0.037792 },
      ],
    },
    US_UNEMPLOYMENT_RATE: {
      country: "US",
      category: "labor",
      name: "US Unemployment Rate",
      source: "BLS",
      sourceSeriesId: "LNS14000000",
      period: "2026-04",
      level: 4.3,
      mom: 0,
      yoy: 0.1,
      unit: "percent_rate",
      changeUnit: "percentage_point",
      frequency: "monthly",
      status: "ok",
      history: [{ period: "2026-04", level: 4.3, mom: 0, yoy: 0.1 }],
    },
  },
  errors: [],
};

const eventsFixture = {
  version: 1,
  generatedAt: "2026-05-22T00:00:00.000Z",
  source: "Federal Reserve",
  sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  eventCount: 2,
  events: [
    {
      id: "FOMC_2026_04_29",
      country: "US",
      type: "FOMC",
      title: "FOMC Meeting",
      startDate: "2026-04-28",
      endDate: "2026-04-29",
      decisionDate: "2026-04-29",
      status: "complete",
      hasSep: false,
      minutesReleaseDate: "2026-05-20",
      rateDecision: {
        available: true,
        targetRangeLower: 3.5,
        targetRangeUpper: 3.75,
        changeBps: 0,
        unit: "%",
      },
      links: {
        statement: "https://www.federalreserve.gov/example-statement.htm",
        implementationNote: "https://www.federalreserve.gov/example-note.htm",
        minutes: "https://www.federalreserve.gov/example-minutes.htm",
        pressConference: "https://www.federalreserve.gov/example-press.htm",
        sep: null,
      },
      source: "Federal Reserve",
      sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      lastUpdated: "2026-05-22T00:00:00.000Z",
    },
    {
      id: "FOMC_2026_06_17",
      country: "US",
      type: "FOMC",
      title: "FOMC Meeting",
      startDate: "2026-06-16",
      endDate: "2026-06-17",
      decisionDate: "2026-06-17",
      status: "upcoming",
      hasSep: true,
      minutesReleaseDate: null,
      rateDecision: {
        available: false,
        targetRangeLower: null,
        targetRangeUpper: null,
        changeBps: null,
        unit: "%",
      },
      links: {
        statement: null,
        implementationNote: null,
        minutes: null,
        pressConference: null,
        sep: null,
      },
      source: "Federal Reserve",
      sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      lastUpdated: "2026-05-22T00:00:00.000Z",
    },
  ],
  errors: [],
};

describe("macro data service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid macro indicators without coercing missing values to zero", () => {
    const parsed = parseMacroIndicatorsFile({
      ...indicatorsFixture,
      indicators: {
        ...indicatorsFixture.indicators,
        US_CPI: {
          ...indicatorsFixture.indicators.US_CPI,
          mom: null,
          yoy: null,
          history: [{ period: "2026-04", level: 332.407, mom: null, yoy: null }],
        },
      },
    });

    expect(parsed.indicators.US_CPI.period).toBe("2026-04");
    expect(parsed.indicators.US_CPI.mom).toBeNull();
    expect(parsed.indicators.US_CPI.yoy).toBeNull();
    expect(parsed.indicators.US_CPI.mom).not.toBe(0);
  });

  it("parses valid macro events", () => {
    const parsed = parseMacroEventsFile(eventsFixture);

    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0].rateDecision.targetRangeLower).toBe(3.5);
    expect(parsed.events[1].rateDecision.targetRangeLower).toBeNull();
  });

  it("loads indicators and events from static macro JSON only", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("macro-indicators.json")) {
        return response(true, indicatorsFixture);
      }
      if (url.endsWith("macro-events.json")) {
        return response(true, eventsFixture);
      }
      return response(false, {}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await loadMacroData();

    expect(data.indicators.status).toBe("loaded");
    expect(data.events.status).toBe("loaded");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("data/macro/"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("bls.gov"))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("federalreserve.gov"))).toBe(false);
  });

  it("returns unavailable for missing indicators file", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(false, {}, 404)));

    const result = await loadMacroIndicators();

    expect(result.status).toBe("unavailable");
    expect(result.data).toBeNull();
    expect(result.errors[0]).toContain("macro-indicators.json");
  });

  it("returns unavailable for malformed events JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(true, { version: 1, events: "bad" })));

    const result = await loadMacroEvents();

    expect(result.status).toBe("unavailable");
    expect(result.data).toBeNull();
    expect(result.errors[0]).toContain("Macro events");
  });
});
