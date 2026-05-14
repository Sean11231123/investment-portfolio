import type { PortfolioSettings } from "../types/portfolio";

export const SETTINGS_STORAGE_KEY_V1 =
  "modular-investment-portfolio:v1:settings";
export const SETTINGS_STORAGE_KEY =
  "modular-investment-portfolio:v2:settings";

export const defaultSettings: PortfolioSettings = {
  displayCurrency: "TWD",
};

export function loadSettings(): PortfolioSettings {
  const rawV2 = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (rawV2) {
    try {
      const parsed = JSON.parse(rawV2);
      if (validateSettings(parsed)) {
        return parsed;
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
  return ["TWD", "USD", "USDT"].includes(String(settings.displayCurrency));
}
