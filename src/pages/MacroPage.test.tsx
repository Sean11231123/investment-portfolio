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
  indicatorCount: 7,
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
    TW_CPI: {
      country: "TW",
      category: "inflation",
      name: "Taiwan CPI",
      source: "data.gov.tw / DGBAS",
      sourceSeriesId: "消費者物價-指數",
      period: "2026-03",
      level: 110.36,
      mom: -0.005138,
      yoy: 0.012013,
      unit: "index",
      changeUnit: "decimal_return",
      frequency: "monthly",
      status: "ok",
      history: [],
    },
    TW_PPI: {
      country: "TW",
      category: "inflation",
      name: "Taiwan PPI",
      source: "data.gov.tw / DGBAS",
      sourceSeriesId: "生產者物價-指數",
      period: "2026-03",
      level: 116.63,
      mom: 0.035882,
      yoy: 0.025319,
      unit: "index",
      changeUnit: "decimal_return",
      frequency: "monthly",
      status: "ok",
      history: [],
    },
    TW_UNEMPLOYMENT_RATE: {
      country: "TW",
      category: "labor",
      name: "Taiwan Unemployment Rate",
      source: "data.gov.tw / DGBAS",
      sourceSeriesId: "失業率（百分比）",
      period: "2026-03",
      level: 3.34,
      mom: 0.02,
      yoy: -0.01,
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
    expect(html).toContain("美國總經");
    expect(html).toContain("US CPI");
    expect(html).toContain("US Core CPI");
    expect(html).toContain("US PPI Final Demand");
    expect(html).toContain("US Unemployment Rate");
    expect(html).toContain("Latest completed FOMC");
    expect(html).toContain("Next upcoming FOMC");
  });

  it("renders Taiwan macro section and indicator cards", () => {
    const html = renderToStaticMarkup(
      <MacroPageContent macroData={macroData} now={new Date("2026-05-22T00:00:00.000Z")} />,
    );

    expect(html).toContain("台灣總經");
    expect(html).toContain("Taiwan CPI");
    expect(html).toContain("Taiwan PPI");
    expect(html).toContain("Taiwan Unemployment Rate");
    expect(html).toContain("data.gov.tw / DGBAS");
  });

  it("formats CPI/Core/PPI changes as percentages", () => {
    expect(formatMacroChange(0.037792, "decimal_return")).toBe("+3.78%");
    expect(formatMacroChange(0.0064, "decimal_return")).toBe("+0.64%");
    expect(formatMacroChange(-0.005138, "decimal_return")).toBe("-0.51%");
    expect(formatMacroChange(0.012013, "decimal_return")).toBe("+1.2%");
  });

  it("formats unemployment level and changes as percentage-point moves", () => {
    expect(formatMacroLevel(indicatorsFile.indicators.US_UNEMPLOYMENT_RATE)).toBe("4.3%");
    expect(formatMacroLevel(indicatorsFile.indicators.TW_UNEMPLOYMENT_RATE)).toBe("3.34%");
    expect(formatMacroChange(0.1, "percentage_point")).toBe("+0.1 個百分點");
    expect(formatMacroChange(-0.1, "percentage_point")).toBe("-0.1 個百分點");
    expect(formatMacroChange(0.02, "percentage_point")).toBe("+0.02 個百分點");
    expect(formatMacroChange(-0.01, "percentage_point")).toBe("-0.01 個百分點");
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

  it("renders missing Taiwan indicators without crashing", () => {
    const html = renderToStaticMarkup(
      <MacroPageContent
        macroData={{
          indicators: {
            data: {
              ...indicatorsFile,
              indicators: {
                US_CPI: indicatorsFile.indicators.US_CPI,
                US_CORE_CPI: indicatorsFile.indicators.US_CORE_CPI,
                US_PPI_FINAL_DEMAND: indicatorsFile.indicators.US_PPI_FINAL_DEMAND,
                US_UNEMPLOYMENT_RATE: indicatorsFile.indicators.US_UNEMPLOYMENT_RATE,
              },
            },
            status: "loaded",
            errors: [],
          },
          events: { data: eventsFile, status: "loaded", errors: [] },
        }}
      />,
    );

    expect(html).toContain("US CPI");
    expect(html).toContain("台灣總經資料暫時無法載入");
    expect(html).toContain("Latest completed FOMC");
  });

  it("uses dash for null values", () => {
    expect(formatMacroChange(null, "decimal_return")).toBe("—");
  });

  it("does not render prediction or sentiment language", () => {
    const html = renderToStaticMarkup(
      <MacroPageContent macroData={macroData} now={new Date("2026-05-22T00:00:00.000Z")} />,
    );

    expect(html).not.toContain("hawkish");
    expect(html).not.toContain("dovish");
    expect(html).not.toContain("買進");
    expect(html).not.toContain("賣出");
  });
});
