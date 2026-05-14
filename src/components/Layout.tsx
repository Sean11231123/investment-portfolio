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
  { key: "etf", label: "ETF 展開" },
  { key: "settings", label: "設定" },
];

export function Layout({ activePage, onNavigate, children }: LayoutProps) {
  const activeIndex = Math.max(
    0,
    navItems.findIndex((item) => item.key === activePage),
  );

  return (
    <div className="min-h-screen text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050816]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-violet-300">
              Portfolio Console
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white">
              Modular Investment Portfolio
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              本機儲存投組資料，搭配線上價格、匯率快取與手動 ETF 成分資料。
            </p>
          </div>

          <nav
            className="relative grid grid-cols-4 gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 shadow-2xl shadow-black/20"
            aria-label="主要導覽"
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
                className={`relative z-10 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-violet-400/70 ${activePage === item.key
                    ? "text-white"
                    : "text-slate-300 hover:text-white"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
