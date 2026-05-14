import {
  createPortfolioExport,
  parseImportedPortfolio,
} from "../storage/portfolioStorage";
import type { Holding, PortfolioSettings } from "../types/portfolio";

export type BackupPreview = {
  detectedFormat: "v2" | "v1-migrated";
  exportedAt?: string;
  holdingCount: number;
  symbols: string[];
  includesSettings: boolean;
  willReplaceCurrentData: true;
};

export type ParsedBackup = {
  holdings: Holding[];
  settings?: PortfolioSettings;
};

export type BackupPreviewResult =
  | {
      ok: true;
      preview: BackupPreview;
      parsed: ParsedBackup;
    }
  | {
      ok: false;
      error: string;
    };

export function createBackupFilename(date: Date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `investment-portfolio-backup-${year}-${month}-${day}-${hours}${minutes}.json`;
}

export function createBackupPayload(
  holdings: Holding[],
  settings?: PortfolioSettings,
  date = new Date(),
) {
  return {
    ...createPortfolioExport(holdings, settings),
    exportedAt: date.toISOString(),
  };
}

export function parseBackupPreview(rawJson: string): BackupPreviewResult {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    return {
      ok: false,
      error: "JSON 格式無效，請確認你選擇的是投組備份檔。",
    };
  }

  const result = parseImportedPortfolio(parsedJson);
  if (!result.ok) {
    return {
      ok: false,
      error: `備份檔包含無效資料，未匯入任何資料：${result.error}`,
    };
  }

  const exportObject =
    parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)
      ? (parsedJson as Record<string, unknown>)
      : undefined;
  const exportedAt =
    typeof exportObject?.exportedAt === "string" ? exportObject.exportedAt : undefined;
  const includesSettings = Boolean(result.settings);

  return {
    ok: true,
    preview: {
      detectedFormat: result.migrated ? "v1-migrated" : "v2",
      exportedAt,
      holdingCount: result.holdings.length,
      symbols: Array.from(
        new Set(result.holdings.map((holding) => holding.symbol)),
      ).sort(),
      includesSettings,
      willReplaceCurrentData: true,
    },
    parsed: {
      holdings: result.holdings,
      settings: result.settings,
    },
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
