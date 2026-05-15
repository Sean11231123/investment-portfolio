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
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--app-text-muted)] sm:text-xs">
              Portfolio Console
            </p>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-[var(--app-text)] sm:text-2xl">
              Modular Investment Portfolio
            </h1>
            <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-[var(--app-text-muted)] sm:block">
              本機持倉、靜態市場資料、加密貨幣價格與 ETF 成分資料的投資組合控制台。
            </p>
          </div>

          <NavPill
            activePage={activePage}
            onNavigate={onNavigate}
            className="hidden sm:grid"
            variant="desktop"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 pb-28 pt-4 sm:px-6 sm:py-6 lg:px-8">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] sm:hidden">
        <div className="mx-auto max-w-md rounded-[1.75rem] border border-[var(--app-border)] bg-[var(--app-surface)]/95 p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <NavPill activePage={activePage} onNavigate={onNavigate} variant="mobile" />
        </div>
      </div>
    </div>
  );
}

function NavPill({
  activePage,
  onNavigate,
  className = "grid",
  variant = "desktop",
}: {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  className?: string;
  variant?: "desktop" | "mobile";
}) {
  const activeIndex = Math.max(
    0,
    navItems.findIndex((item) => item.key === activePage),
  );

  const isMobile = variant === "mobile";

  return (
    <nav
      className={`relative grid-cols-4 gap-1 ${isMobile
        ? "grid rounded-[1.45rem] bg-[var(--app-surface)] p-1"
        : "rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-sm"
        } ${className}`}
      aria-label="主選單"
    >
      <div
        aria-hidden="true"
        className={`absolute left-1 top-1 h-[calc(100%-0.5rem)] transition-transform duration-300 ease-out ${isMobile
          ? "rounded-[1.15rem] bg-[var(--app-primary)] shadow-sm"
          : "rounded-full bg-[var(--app-primary)] shadow-sm"
          }`}
        style={{
          width: `calc((100% - 0.5rem) / ${navItems.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />

      {navItems.map((item) => {
        const active = activePage === item.key;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            className={`relative z-10 rounded-full px-2 py-2 text-xs font-semibold transition-colors duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-sky-400/70 sm:px-4 sm:text-sm ${isMobile ? "min-h-12" : "min-h-11"
              } ${active
                ? "text-[var(--app-primary-text)]"
                : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
              }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}