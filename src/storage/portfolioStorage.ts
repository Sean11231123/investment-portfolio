import { getAssetMetadata, normalizeSymbol } from "../data/assetRegistry";
import type {
  AssetType,
  Holding,
  ImportResult,
  LegacyHolding,
  PortfolioExportV2,
} from "../types/portfolio";
import { validateSettings } from "./settingsStorage";

export const PORTFOLIO_STORAGE_KEY_V1 =
  "modular-investment-portfolio:v1:holdings";
export const PORTFOLIO_STORAGE_KEY =
  "modular-investment-portfolio:v2:holdings";

export type LoadHoldingsResult = {
  holdings: Holding[];
  migrated: boolean;
  migrationWarnings: string[];
};

export function loadHoldings(): LoadHoldingsResult {
  const rawV2 = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
  if (rawV2) {
    try {
      const parsed = JSON.parse(rawV2);
      return {
        holdings: validateHoldings(parsed) ? parsed : [],
        migrated: false,
        migrationWarnings: validateHoldings(parsed)
          ? []
          : ["v2 localStorage holdings schema is invalid."],
      };
    } catch {
      return {
        holdings: [],
        migrated: false,
        migrationWarnings: ["v2 localStorage holdings JSON is invalid."],
      };
    }
  }

  const rawV1 = localStorage.getItem(PORTFOLIO_STORAGE_KEY_V1);
  if (!rawV1) {
    return { holdings: [], migrated: false, migrationWarnings: [] };
  }

  try {
    const parsed = JSON.parse(rawV1);
    const migrated = migrateUnknownHoldings(parsed);
    if (!migrated.ok) {
      return {
        holdings: [],
        migrated: false,
        migrationWarnings: [migrated.error],
      };
    }

    saveHoldings(migrated.holdings);
    return {
      holdings: migrated.holdings,
      migrated: true,
      migrationWarnings: migrated.warnings,
    };
  } catch {
    return {
      holdings: [],
      migrated: false,
      migrationWarnings: ["v1 localStorage holdings JSON is invalid."],
    };
  }
}

export function saveHoldings(holdings: Holding[]) {
  localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(holdings));
}

export function clearHoldingsStorage() {
  localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
}

export function parseImportedPortfolio(value: unknown): ImportResult {
  if (isPortfolioExportV2(value)) {
    if (!validateHoldings(value.holdings)) {
      return { ok: false, error: "v2 JSON holdings schema is invalid." };
    }

    return {
      ok: true,
      holdings: value.holdings,
      settings: value.settings,
      migrated: false,
    };
  }

  const migrated = migrateUnknownHoldings(value);
  if (!migrated.ok) {
    return { ok: false, error: migrated.error };
  }

  return {
    ok: true,
    holdings: migrated.holdings,
    migrated: true,
  };
}

export function createPortfolioExport(
  holdings: Holding[],
  settings?: PortfolioExportV2["settings"],
): PortfolioExportV2 {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    holdings,
    settings,
  };
}

export function validateHoldings(value: unknown): value is Holding[] {
  return Array.isArray(value) && value.every(isHolding);
}

function isHolding(value: unknown): value is Holding {
  if (!value || typeof value !== "object") {
    return false;
  }

  const holding = value as Record<string, unknown>;

  return (
    typeof holding.id === "string" &&
    holding.id.trim().length > 0 &&
    isAssetType(holding.type) &&
    typeof holding.symbol === "string" &&
    holding.symbol.trim().length > 0 &&
    isNonNegativeNumber(holding.quantity) &&
    (holding.avgCost === undefined || isNonNegativeNumber(holding.avgCost)) &&
    (holding.note === undefined || typeof holding.note === "string")
  );
}

function isPortfolioExportV2(value: unknown): value is PortfolioExportV2 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 2 &&
    Array.isArray(candidate.holdings) &&
    (candidate.settings === undefined || validateSettings(candidate.settings))
  );
}

function migrateUnknownHoldings(
  value: unknown,
):
  | { ok: true; holdings: Holding[]; warnings: string[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "JSON must be a v2 export object or v1 holdings array." };
  }

  const holdings: Holding[] = [];
  const warnings: string[] = [];

  for (const item of value) {
    if (!isLegacyOrV2Candidate(item)) {
      return { ok: false, error: "Imported holdings contain invalid fields." };
    }

    const symbol = normalizeSymbol(item.symbol);
    const metadata = getAssetMetadata(symbol, item.type);
    const type = metadata?.type ?? item.type;

    if (!metadata && item.type !== "custom") {
      warnings.push(`${symbol} was migrated as custom because it is not in the registry.`);
    }

    holdings.push({
      id: item.id.trim(),
      type: metadata ? type : "custom",
      symbol,
      quantity: item.quantity,
      avgCost: item.avgCost,
      note: item.note,
    });
  }

  return { ok: true, holdings, warnings };
}

function isLegacyOrV2Candidate(
  value: unknown,
): value is Holding | LegacyHolding {
  if (!isHolding(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.currentPrice !== undefined && !isNonNegativeNumber(candidate.currentPrice)) {
    return false;
  }

  return true;
}

function isAssetType(value: unknown): value is AssetType {
  return ["taiwan_stock", "taiwan_etf", "us_stock", "us_etf", "crypto", "cash", "custom"].includes(
    value as AssetType,
  );
}

function isNonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
