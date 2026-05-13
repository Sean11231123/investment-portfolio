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
import {
  loadSettings,
  saveSettings,
} from "./storage/settingsStorage";
import type { Holding, PortfolioSettings } from "./types/portfolio";

type PageKey = "dashboard" | "holdings" | "etf" | "settings";

function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [holdings, setHoldings] = useState<Holding[]>(() => loadHoldings());
  const [settings, setSettings] = useState<PortfolioSettings>(() =>
    loadSettings(),
  );

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

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {activePage === "dashboard" ? (
        <Dashboard holdings={holdings} settings={settings} />
      ) : null}
      {activePage === "holdings" ? (
        <HoldingsPage
          holdings={holdings}
          settings={settings}
          onUpsertHolding={handleUpsertHolding}
          onDeleteHolding={handleDeleteHolding}
          onImportHoldings={handleImportHoldings}
          onLoadDemo={handleLoadDemo}
          onClearAll={handleClearAll}
        />
      ) : null}
      {activePage === "etf" ? (
        <ETFExposurePage holdings={holdings} settings={settings} />
      ) : null}
      {activePage === "settings" ? (
        <SettingsPage settings={settings} onSaveSettings={setSettings} />
      ) : null}
    </Layout>
  );
}

export default App;
