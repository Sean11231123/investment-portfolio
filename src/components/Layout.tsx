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
  return (
    <div className="min-h-screen bg-[#f5f7f8] text-[#172026]">
      <header className="border-b border-[#d8e0e3] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-normal text-[#172026]">
              Modular Investment Portfolio
            </h1>
            <p className="mt-1 text-sm text-[#607078]">
              瀏覽器本機儲存，手動維護價格與 ETF 成分資料
            </p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="主要導覽">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  activePage === item.key
                    ? "bg-[#1f6f78] text-white"
                    : "bg-[#eef3f4] text-[#314249] hover:bg-[#dfe8ea]"
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
