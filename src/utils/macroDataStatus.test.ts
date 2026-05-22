import { describe, expect, it } from "vitest";
import type { MacroData, MacroEventsFile, MacroIndicatorsFile } from "../types/macro";
import {
  getMacroDataStatus,
  getMacroStatusSection,
  summarizeMacroEventsRow,
  summarizeMacroIndicatorsRow,
} from "./macroDataStatus";

const indicatorsFile: MacroIndicatorsFile = {
  version: 1,
  generatedAt: "2026-05-22T00:00:00.000Z",
  source: "BLS",
  sourceName: "U.S. Bureau of Labor Statistics Public Data API",
  sourceUrl: "https://api.bls.gov/publicAPI/v2/timeseries/data/",
  indicatorCount: 4,
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
      history: [],
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
      history: [],
    },
  },
  errors: [],
};

const eventsFile: MacroEventsFile = {
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
      rateDecision: {
        available: true,
        targetRangeLower: 3.5,
        targetRangeUpper: 3.75,
        changeBps: 0,
        unit: "%",
      },
      links: {
        statement: "https://www.federalreserve.gov/statement.htm",
        implementationNote: "https://www.federalreserve.gov/note.htm",
        minutes: "https://www.federalreserve.gov/minutes.htm",
        pressConference: "https://www.federalreserve.gov/press.htm",
        sep: null,
      },
      source: "Federal Reserve",
      sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
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
    },
  ],
  errors: [],
};

function macroData(
  indicators: MacroIndicatorsFile | null = indicatorsFile,
  events: MacroEventsFile | null = eventsFile,
): MacroData {
  return {
    indicators: {
      data: indicators,
      status: indicators ? "loaded" : "unavailable",
      errors: indicators ? [] : ["missing indicators"],
    },
    events: {
      data: events,
      status: events ? "loaded" : "unavailable",
      errors: events ? [] : ["missing events"],
    },
  };
}

describe("macro data status", () => {
  it("summarizes indicator and event counts", () => {
    const status = getMacroDataStatus(macroData(), new Date("2026-05-22T12:00:00.000Z"));

    expect(status.status).toBe("ok");
    expect(status.indicatorCount).toBe(4);
    expect(status.eventCount).toBe(2);
    expect(status.latestIndicatorPeriod).toBe("2026-04");
  });

  it("detects latest completed and next upcoming FOMC dates", () => {
    const status = getMacroDataStatus(macroData(), new Date("2026-05-22T12:00:00.000Z"));

    expect(status.latestCompletedFomcDate).toBe("2026-04-29");
    expect(status.nextUpcomingFomcDate).toBe("2026-06-17");
  });

  it("marks stale indicators after 45 days", () => {
    const row = summarizeMacroIndicatorsRow(
      indicatorsFile,
      [],
      new Date("2026-07-10T00:00:00.000Z"),
    );

    expect(row.status).toBe("stale");
  });

  it("marks stale events after 14 days", () => {
    const row = summarizeMacroEventsRow(
      eventsFile,
      [],
      new Date("2026-06-10T00:00:00.000Z"),
    );

    expect(row.status).toBe("stale");
  });

  it("returns unavailable when one macro file is missing", () => {
    const status = getMacroDataStatus(
      macroData(null, null),
      new Date("2026-05-22T12:00:00.000Z"),
    );

    expect(status.status).toBe("unavailable");
    expect(status.indicatorCount).toBe(0);
    expect(status.eventCount).toBe(0);
    expect(status.errors).toContain("missing indicators");
  });

  it("creates a macro section for Settings diagnostics", () => {
    const section = getMacroStatusSection(
      macroData(),
      new Date("2026-05-22T12:00:00.000Z"),
    );

    expect(section.id).toBe("macro");
    expect(section.title).toBe("總經資料 / Macro");
    expect(section.rows.map((row) => row.id)).toEqual([
      "macro-indicators",
      "macro-events",
    ]);
  });
});
