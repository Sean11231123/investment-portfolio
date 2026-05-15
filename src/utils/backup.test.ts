import { describe, expect, it } from "vitest";
import type { Holding, LegacyHolding, PortfolioSettings } from "../types/portfolio";
import { validateSettings } from "../storage/settingsStorage";
import {
  createBackupFilename,
  createBackupPayload,
  parseBackupPreview,
} from "./backup";

const holding: Holding = {
  id: "tw-1",
  type: "taiwan_stock",
  symbol: "2330",
  quantity: 10,
  avgCost: 700,
};

const settings: PortfolioSettings = {
  displayCurrency: "TWD",
  theme: "dark",
  backup: {
    lastExportedAt: "2026-05-14T12:00:00.000Z",
  },
};

describe("backup helpers", () => {
  it("formats timestamped backup filenames", () => {
    const date = new Date(2026, 4, 14, 20, 30);

    expect(createBackupFilename(date)).toBe(
      "investment-portfolio-backup-2026-05-14-2030.json",
    );
  });

  it("creates v2 backup payloads with exportedAt", () => {
    const date = new Date("2026-05-14T12:30:00.000Z");
    const payload = createBackupPayload([holding], settings, date);

    expect(payload.version).toBe(2);
    expect(payload.exportedAt).toBe("2026-05-14T12:30:00.000Z");
    expect(payload.holdings).toEqual([holding]);
    expect(payload.settings).toEqual(settings);
  });

  it("previews valid v2 backups without mutating localStorage", () => {
    const before = globalThis.localStorage;
    const raw = JSON.stringify({
      version: 2,
      exportedAt: "2026-05-14T12:30:00.000Z",
      holdings: [holding],
      settings,
    });

    const result = parseBackupPreview(raw);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.detectedFormat).toBe("v2");
      expect(result.preview.exportedAt).toBe("2026-05-14T12:30:00.000Z");
      expect(result.preview.holdingCount).toBe(1);
      expect(result.preview.symbols).toEqual(["2330"]);
      expect(result.preview.includesSettings).toBe(true);
      expect(result.preview.willReplaceCurrentData).toBe(true);
      expect(result.parsed.holdings).toEqual([holding]);
    }
    expect(globalThis.localStorage).toBe(before);
  });

  it("previews v1 backups through existing migration logic", () => {
    const legacy: LegacyHolding = {
      ...holding,
      name: "台積電",
      currentPrice: 800,
      currency: "TWD",
      market: "TW",
    };

    const result = parseBackupPreview(JSON.stringify([legacy]));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.detectedFormat).toBe("v1-migrated");
      expect(result.preview.holdingCount).toBe(1);
      expect(result.preview.includesSettings).toBe(false);
      expect(result.parsed.holdings[0]).toEqual(holding);
    }
  });

  it("rejects invalid JSON and invalid structures", () => {
    expect(parseBackupPreview("{").ok).toBe(false);
    expect(parseBackupPreview(JSON.stringify({ version: 2, holdings: "bad" })).ok).toBe(
      false,
    );
  });

  it("rejects invalid holdings such as negative quantity", () => {
    const result = parseBackupPreview(
      JSON.stringify({
        version: 2,
        exportedAt: "2026-05-14T12:30:00.000Z",
        holdings: [{ ...holding, quantity: -1 }],
      }),
    );

    expect(result.ok).toBe(false);
  });

  it("validates settings with optional backup metadata", () => {
    expect(validateSettings({ displayCurrency: "TWD" })).toBe(true);
    expect(
      validateSettings({
        displayCurrency: "USD",
        backup: {
          lastExportedAt: "2026-05-14T12:30:00.000Z",
          lastImportedAt: "2026-05-15T12:30:00.000Z",
          lastImportHoldingCount: 2,
        },
      }),
    ).toBe(true);
    expect(
      validateSettings({
        displayCurrency: "USD",
        backup: {
          lastImportHoldingCount: -1,
        },
      }),
    ).toBe(false);
    expect(validateSettings({ displayCurrency: "USD", backup: "bad" })).toBe(false);
  });
});
