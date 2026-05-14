import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { demoPortfolio } from "./data/demoPortfolio";
import { Dashboard } from "./pages/Dashboard";
import { ETFExposurePage } from "./pages/ETFExposurePage";
import { HoldingsPage } from "./pages/HoldingsPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  clearHoldingsStorage,
  loadHoldings,
  saveHoldings,
} from "./storage/portfolioStorage";
import { loadSettings, saveSettings } from "./storage/settingsStorage";
import {
  loadCachedFxRates,
  refreshFxRates,
  saveFxRates,
} from "./services/fxService";
import {
  loadCachedPrices,
  refreshPrices,
  savePriceCache,
} from "./services/priceService";
import type {
  FxRates,
  Holding,
  PortfolioSettings,
  PriceQuote,
} from "./types/portfolio";

type PageKey = "dashboard" | "holdings" | "etf" | "settings";

function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [initialLoadResult] = useState(() => loadHoldings());
  const [holdings, setHoldings] = useState<Holding[]>(
    () => initialLoadResult.holdings,
  );
  const [settings, setSettings] = useState<PortfolioSettings>(() =>
    loadSettings(),
  );
  const [fxRates, setFxRates] = useState<FxRates>(() => loadCachedFxRates());
  const [priceCache, setPriceCache] = useState<Record<string, PriceQuote>>(() =>
    loadCachedPrices(),
  );
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const [migrationMessage] = useState(() => {
    return initialLoadResult.migrated
      ? "已將舊版 localStorage 持倉轉換為 v2 格式。"
      : initialLoadResult.migrationWarnings[0] ?? "";
  });

  useEffect(() => {
    if (holdings.length === 0) {
      clearHoldingsStorage();
      return;
    }

    saveHoldings(holdings);
  }, [holdings]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    refreshFxRates().then(setFxRates);
  }, []);

  useEffect(() => {
    if (holdings.length === 0) {
      return;
    }

    handleRefreshPrices();
  }, [holdings]);

  function handleUpsertHolding(nextHolding: Holding) {
    setHoldings((current) => {
      const existingIndex = current.findIndex(
        (holding) => holding.id === nextHolding.id,
      );

      if (existingIndex === -1) {
        return [...current, nextHolding];
      }

      return current.map((holding) =>
        holding.id === nextHolding.id ? nextHolding : holding,
      );
    });
  }

  function handleDeleteHolding(id: string) {
    if (window.confirm("確定刪除此持倉嗎？")) {
      setHoldings((current) => current.filter((holding) => holding.id !== id));
    }
  }

  function handleImportHoldings(nextHoldings: Holding[]) {
    setHoldings(nextHoldings);
  }

  function handleLoadDemo() {
    setHoldings(demoPortfolio.map((holding) => ({ ...holding })));
  }

  function handleClearAll() {
    clearHoldingsStorage();
    setHoldings([]);
  }

  async function handleRefreshFx() {
    const next = await refreshFxRates();
    saveFxRates(next);
    setFxRates(next);
  }

  async function handleRefreshPrices() {
    setPriceRefreshing(true);
    try {
      const next = await refreshPrices(holdings);
      savePriceCache(next);
      setPriceCache(next);
    } finally {
      setPriceRefreshing(false);
    }
  }

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {migrationMessage ? (
        <section className="mb-4 rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-4 text-sm text-[#6f5a19]">
          {migrationMessage}
        </section>
      ) : null}

      {activePage === "dashboard" ? (
        <Dashboard
          holdings={holdings}
          settings={settings}
          fxRates={fxRates}
          priceCache={priceCache}
          priceRefreshing={priceRefreshing}
          onRefreshPrices={handleRefreshPrices}
        />
      ) : null}
      {activePage === "holdings" ? (
        <HoldingsPage
          holdings={holdings}
          settings={settings}
          fxRates={fxRates}
          priceCache={priceCache}
          priceRefreshing={priceRefreshing}
          onUpsertHolding={handleUpsertHolding}
          onDeleteHolding={handleDeleteHolding}
          onImportHoldings={handleImportHoldings}
          onImportSettings={(nextSettings) =>
            nextSettings ? setSettings(nextSettings) : undefined
          }
          onLoadDemo={handleLoadDemo}
          onClearAll={handleClearAll}
          onRefreshPrices={handleRefreshPrices}
        />
      ) : null}
      {activePage === "etf" ? (
        <ETFExposurePage
          holdings={holdings}
          settings={settings}
          fxRates={fxRates}
          priceCache={priceCache}
        />
      ) : null}
      {activePage === "settings" ? (
        <SettingsPage
          settings={settings}
          fxRates={fxRates}
          onSaveSettings={setSettings}
          onRefreshFx={handleRefreshFx}
        />
      ) : null}
    </Layout>
  );
}

export default App;
