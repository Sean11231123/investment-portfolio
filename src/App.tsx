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
import { loadAssetUniverse } from "./services/universeService";
import type {
  AssetMetadata,
  FxRates,
  Holding,
  PortfolioSettings,
  PriceQuote,
} from "./types/portfolio";
import type { UniverseFileSummary } from "./types/universe";

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
  const [universeAssets, setUniverseAssets] = useState<AssetMetadata[]>([]);
  const [universeFiles, setUniverseFiles] = useState<UniverseFileSummary[]>([]);
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const [migrationMessage] = useState(() => {
    return initialLoadResult.migrated
      ? "已將舊版 localStorage 持倉遷移為 v2 格式。"
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
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    refreshFxRates().then(setFxRates);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadAssetUniverse().then((result) => {
      if (!cancelled) {
        setUniverseAssets(result.assets);
        setUniverseFiles(result.files ?? []);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (holdings.length === 0) {
      return;
    }

    handleRefreshPrices();
  }, [holdings, universeAssets]);

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
    if (window.confirm("確定要刪除此持倉？")) {
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
      const next = await refreshPrices(holdings, universeAssets);
      savePriceCache(next);
      setPriceCache(next);
    } finally {
      setPriceRefreshing(false);
    }
  }

  function renderPage() {
    switch (activePage) {
      case "dashboard":
        return (
          <Dashboard
            holdings={holdings}
            settings={settings}
            fxRates={fxRates}
            priceCache={priceCache}
            priceRefreshing={priceRefreshing}
            universeAssets={universeAssets}
            onRefreshPrices={handleRefreshPrices}
          />
        );

      case "holdings":
        return (
          <HoldingsPage
            holdings={holdings}
            settings={settings}
            fxRates={fxRates}
            priceCache={priceCache}
            priceRefreshing={priceRefreshing}
            universeAssets={universeAssets}
            onUpsertHolding={handleUpsertHolding}
            onDeleteHolding={handleDeleteHolding}
            onImportHoldings={handleImportHoldings}
            onImportSettings={(nextSettings) =>
              nextSettings ? setSettings(nextSettings) : undefined
            }
            onUpdateSettings={setSettings}
            onLoadDemo={handleLoadDemo}
            onClearAll={handleClearAll}
            onRefreshPrices={handleRefreshPrices}
          />
        );

      case "etf":
        return (
          <ETFExposurePage
            holdings={holdings}
            settings={settings}
            fxRates={fxRates}
            priceCache={priceCache}
            universeAssets={universeAssets}
          />
        );

      case "settings":
        return (
          <SettingsPage
            holdings={holdings}
            settings={settings}
            fxRates={fxRates}
            priceCache={priceCache}
            universeAssets={universeAssets}
            universeFiles={universeFiles}
            onSaveSettings={setSettings}
            onImportHoldings={handleImportHoldings}
            onRefreshFx={handleRefreshFx}
          />
        );

      default:
        return null;
    }
  }

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {migrationMessage ? (
        <section className="mb-4 rounded-md border border-[#e5d7a6] bg-[#fffaf0] p-4 text-sm text-[#6f5a19]">
          {migrationMessage}
        </section>
      ) : null}

      <div key={activePage} className="animate-page-fade">
        {renderPage()}
      </div>
    </Layout>
  );
}

export default App;
