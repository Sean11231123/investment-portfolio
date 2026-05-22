import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MacroData, MacroEventsFile, MacroIndicatorsFile } from "../types/macro";
import {
  formatMacroChange,
  formatMacroLevel,
  MacroPageContent,
  selectLatestCompletedFomc,
  selectNextUpcomingFomc,
} from "./MacroPage";

const indicatorsFile: MacroIndicatorsFile = {
  version: 1,
  generatedAt: "2026-05-22T00:00:00.000Z",
  source: "BLS",
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
    US_CORE_CPI: {
      country: "US",
      category: "inflation",
      name: "US Core CPI",
      source: "BLS",
      sourceSeriesId: "CUSR0000SA0L1E",
      period: "2026-04",
      level: 335.423,
      mom: 0.003765,
      yoy: 0.027433,
      unit: "index",
      changeUnit: "decimal_return",
      frequency: "monthly",
      status: "ok",
      history: [],
    },
    US_PPI_FINAL_DEMAND: {
      country: "US",
      category: "inflation",
      name: "US PPI Final Demand",
      source: "BLS",
      sourceSeriesId: "WPSFD4",
      period: "2026-04",
      level: 156.496,
      mom: 0.013759,
      yoy: 0.059876,
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
      hasSep: true,
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

const macroData: MacroData = {
  indicators: { data: indicatorsFile, status: "loaded", errors: [] },
  events: { data: eventsFile, status: "loaded", errors: [] },
};

describe("MacroPage", () => {
  it("renders indicator cards and FOMC event cards", () => {
    const html = renderToStaticMarkup(
      <MacroPageContent macroData={macroData} now={new Date("2026-05-22T00:00:00.000Z")} />,
    );

    expect(html).toContain("總經觀察");
    expect(html).toContain("US CPI");
    expect(html).toContain("US Core CPI");
    expect(html).toContain("US PPI Final Demand");
    expect(html).toContain("US Unemployment Rate");
    expect(html).toContain("Latest completed FOMC");
    expect(html).toContain("Next upcoming FOMC");
  });

  it("formats CPI/Core/PPI changes as percentages", () => {
    expect(formatMacroChange(0.037792, "decimal_return")).toBe("+3.78%");
    expect(formatMacroChange(0.0064, "decimal_return")).toBe("+0.64%");
  });

  it("formats unemployment level and changes as percentage-point moves", () => {
    expect(formatMacroLevel(indicatorsFile.indicators.US_UNEMPLOYMENT_RATE)).toBe("4.3%");
    expect(formatMacroChange(0.1, "percentage_point")).toBe("+0.1 個百分點");
    expect(formatMacroChange(-0.1, "percentage_point")).toBe("-0.1 個百分點");
  });

  it("detects latest completed and next upcoming FOMC events", () => {
    expect(selectLatestCompletedFomc(eventsFile.events)?.id).toBe("FOMC_2026_04_29");
    expect(selectNextUpcomingFomc(eventsFile.events)?.id).toBe("FOMC_2026_06_17");
  });

  it("does not render missing FOMC links and renders official links safely", () => {
    const html = renderToStaticMarkup(
      <MacroPageContent macroData={macroData} now={new Date("2026-05-22T00:00:00.000Z")} />,
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Statement");
    expect(html).toContain("Implementation Note");
    expect(html).toContain("Minutes");
    expect(html).toContain("Press Conference");
    expect(html).not.toContain("SEP / Projections</a>");
  });

  it("renders unavailable states without crashing", () => {
    const html = renderToStaticMarkup(
      <MacroPageContent
        macroData={{
          indicators: { data: null, status: "unavailable", errors: ["missing indicators"] },
          events: { data: null, status: "unavailable", errors: ["missing events"] },
        }}
      />,
    );

    expect(html).toContain("總經指標暫時無法載入");
    expect(html).toContain("FOMC 事件資料暫時無法載入");
  });

  it("uses dash for null values", () => {
    expect(formatMacroChange(null, "decimal_return")).toBe("—");
  });
});
