import type { ReactNode } from "react";

type PageKey = "dashboard" | "holdings" | "etf" | "settings";

type LayoutProps = {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
};

const navItems: Array<{ key: PageKey; label: string }> = [
  { key: "dashboard", label: "總覽" },
  { key: "holdings", label: "持倉" },
  { key: "etf", label: "ETF" },
  { key: "settings", label: "設定" },
];

export function Layout({ activePage, onNavigate, children }: LayoutProps) {
  return (
    <div className="min-h-screen text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050816]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-violet-300">
              Portfolio Console
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-normal text-white sm:text-2xl">
              Modular Investment Portfolio
            </h1>
            <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-slate-400 sm:block">
              本機持倉、靜態市場資料、加密貨幣價格與 ETF 成分資料的投資組合控制台。
            </p>
          </div>

          <NavPill
            activePage={activePage}
            onNavigate={onNavigate}
            className="hidden sm:grid"
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pb-28 pt-4 sm:px-6 sm:py-6 lg:px-8">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#050816]/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl sm:hidden">
        <NavPill activePage={activePage} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function NavPill({
  activePage,
  onNavigate,
  className = "grid",
}: {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  className?: string;
}) {
  const activeIndex = Math.max(
    0,
    navItems.findIndex((item) => item.key === activePage),
  );

  return (
    <nav
      className={`relative grid-cols-4 gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 shadow-2xl shadow-black/20 ${className}`}
      aria-label="主選單"
    >
      <div
        aria-hidden="true"
        className="absolute left-1 top-1 h-[calc(100%-0.5rem)] rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 shadow-lg shadow-violet-500/25 transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${navItems.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />

      {navItems.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onNavigate(item.key)}
          className={`relative z-10 min-h-11 rounded-full px-2 py-2 text-xs font-semibold transition-colors duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-violet-400/70 sm:px-4 sm:text-sm ${
            activePage === item.key
              ? "text-white"
              : "text-slate-300 hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
