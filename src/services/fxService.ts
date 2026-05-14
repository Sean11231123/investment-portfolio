import type { Currency, FxRates } from "../types/portfolio";

export const FX_CACHE_KEY = "modular-investment-portfolio:v2:fx-cache";

const fallbackFxRates: FxRates = {
  usdToTwd: 32,
  usdtToTwd: 32,
  source: "Fallback 32 TWD",
  status: "fallback",
  error: "匯率暫時無法取得，使用可見的備援匯率。",
};

export function loadCachedFxRates(): FxRates {
  const raw = localStorage.getItem(FX_CACHE_KEY);
  if (!raw) {
    return fallbackFxRates;
  }

  try {
    const parsed = JSON.parse(raw);
    if (isFxRates(parsed)) {
      return { ...parsed, status: parsed.status === "ok" ? "cached" : parsed.status };
    }
  } catch {
    return fallbackFxRates;
  }

  return fallbackFxRates;
}

export function saveFxRates(rates: FxRates) {
  localStorage.setItem(FX_CACHE_KEY, JSON.stringify(rates));
}

export async function refreshFxRates(): Promise<FxRates> {
  const cached = loadCachedFxRates();

  try {
    const response = await fetch("https://api.frankfurter.dev/v2/rate/USD/TWD");
    if (!response.ok) {
      throw new Error(`Frankfurter returned ${response.status}`);
    }

    const data = await response.json();
    const rate = Number(data.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Frankfurter did not return a usable USD/TWD rate.");
    }

    const rates: FxRates = {
      usdToTwd: rate,
      usdtToTwd: rate,
      source: "Frankfurter USD/TWD; USDT uses USD/TWD fallback",
      lastUpdated: new Date().toISOString(),
      status: "ok",
    };
    saveFxRates(rates);
    return rates;
  } catch (error) {
    if (cached.status !== "fallback") {
      return {
        ...cached,
        status: "cached",
        error: getErrorMessage(error),
      };
    }

    return {
      ...fallbackFxRates,
      error: getErrorMessage(error),
    };
  }
}

export function getFxRateToTWD(currency: Currency, fxRates: FxRates) {
  if (currency === "TWD") {
    return 1;
  }

  if (currency === "USD") {
    return fxRates.usdToTwd;
  }

  return fxRates.usdtToTwd;
}

export function convertFromTWD(
  valueTWD: number,
  currency: Currency,
  fxRates: FxRates,
) {
  if (currency === "TWD") {
    return valueTWD;
  }

  return valueTWD / getFxRateToTWD(currency, fxRates);
}

function isFxRates(value: unknown): value is FxRates {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rates = value as Record<string, unknown>;
  return (
    typeof rates.usdToTwd === "number" &&
    rates.usdToTwd > 0 &&
    typeof rates.usdtToTwd === "number" &&
    rates.usdtToTwd > 0 &&
    typeof rates.source === "string"
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "匯率更新失敗。";
}
