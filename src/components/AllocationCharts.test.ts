import { describe, expect, it } from "vitest";
import { getActiveChartValueColor } from "./AllocationCharts";

describe("top holdings active chart value color", () => {
  it("uses the selected chart item color when available", () => {
    expect(getActiveChartValueColor("#38bdf8cc")).toBe("#38bdf8cc");
  });

  it("falls back to readable slate text instead of black", () => {
    expect(getActiveChartValueColor()).toBe("#e2e8f0");
    expect(getActiveChartValueColor("")).not.toBe("#000");
  });
});
