import type { PortfolioSettings } from "../types/portfolio";

export const SETTINGS_STORAGE_KEY_V1 =
  "modular-investment-portfolio:v1:settings";
export const SETTINGS_STORAGE_KEY =
  "modular-investment-portfolio:v2:settings";

export const defaultSettings: PortfolioSettings = {
  displayCurrency: "TWD",
  theme: "dark",
};

export function loadSettings(): PortfolioSettings {
  const rawV2 = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (rawV2) {
    try {
      const parsed = JSON.parse(rawV2);
      if (validateSettings(parsed)) {
        return { ...defaultSettings, ...parsed };
      }
    } catch {
      return defaultSettings;
    }
  }

  return defaultSettings;
}

export function saveSettings(settings: PortfolioSettings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function validateSettings(value: unknown): value is PortfolioSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const settings = value as Record<string, unknown>;
  return (
    ["TWD", "USD", "USDT"].includes(String(settings.displayCurrency)) &&
    (settings.theme === undefined || settings.theme === "dark" || settings.theme === "light") &&
    validateBackupMetadata(settings.backup)
  );
}

function validateBackupMetadata(value: unknown) {
  if (value === undefined) {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const backup = value as Record<string, unknown>;
  return (
    optionalString(backup.lastExportedAt) &&
    optionalString(backup.lastImportedAt) &&
    (backup.lastImportHoldingCount === undefined ||
      (typeof backup.lastImportHoldingCount === "number" &&
        Number.isInteger(backup.lastImportHoldingCount) &&
        backup.lastImportHoldingCount >= 0))
  );
}

function optionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}
