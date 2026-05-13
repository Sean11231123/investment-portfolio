import type { PortfolioSettings } from "../types/portfolio";

export const SETTINGS_STORAGE_KEY =
  "modular-investment-portfolio:v1:settings";

export const defaultSettings: PortfolioSettings = {
  usdToTwd: 32,
  usdtToTwd: 32,
};

export function loadSettings(): PortfolioSettings {
  if (typeof localStorage === "undefined") {
    return defaultSettings;
  }

  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(raw);
    return validateSettings(parsed) ? parsed : defaultSettings;
  } catch {
    return defaultSettings;
  }
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
    isPositiveNumber(settings.usdToTwd) && isPositiveNumber(settings.usdtToTwd)
  );
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
