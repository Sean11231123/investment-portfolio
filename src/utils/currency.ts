import type { Currency, PortfolioSettings } from "../types/portfolio";

export function getFxRateToTWD(
  currency: Currency,
  settings: PortfolioSettings,
): number {
  if (currency === "TWD") {
    return 1;
  }

  if (currency === "USD") {
    return settings.usdToTwd;
  }

  return settings.usdtToTwd;
}
