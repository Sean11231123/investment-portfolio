import type { ButtonHTMLAttributes, ReactNode } from "react";

type AppCardProps = {
  children: ReactNode;
  className?: string;
  padded?: boolean;
};

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

type FieldShellProps = {
  children: ReactNode;
  className?: string;
};

type AppBadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  className?: string;
};

export const appSurface =
  "border border-white/10 bg-[#111a35]/85 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur";
export const appMutedSurface = "border border-white/10 bg-white/[0.04]";
export const appInput =
  "rounded-2xl border border-white/10 bg-[#081126] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60";
export const appTableHeader = "bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-400";
export const appTableRow = "border-t border-white/10 hover:bg-white/[0.04]";
export const chartTooltipStyle = {
  backgroundColor: "#111a35",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "16px",
  color: "#f8fafc",
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
};
export const chartGridColor = "rgba(148, 163, 184, 0.18)";
export const chartTextColor = "#94a3b8";
export const chartColors = [
  "#38bdf8cc", // 亮天藍 (Sky 400) - 增加對比
  "#4ade80cc", // 薄荷綠 (Green 400) - 視覺最舒適
  "#fbbf24cc", // 暖金黃 (Amber 400) - 強力跳色
  "#22d3eecc", // 清爽青 (Cyan 400) 
  "#fb7185cc", // 柔玫瑰 (Rose 400) - 作為亮點
  "#818cf8cc", // 淡靛藍 (Indigo 400) - 與背景呼應但不重疊
  "#f97316cc", // 活力橘 (Orange 500)
  "#2dd4bfcc", // 翠綠藍 (Teal 400)
  "#e2e8f0cc", // 霧白 (Slate 200) - 用於次要數據，極高對比
];

export function AppCard({ children, className = "", padded = true }: AppCardProps) {
  return (
    <section className={`rounded-3xl ${appSurface} ${padded ? "p-4 sm:p-5" : ""} ${className}`}>
      {children}
    </section>
  );
}

export function AppButton({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: AppButtonProps) {
  const variants = {
    primary:
      "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-950/40 hover:from-violet-400 hover:to-indigo-400",
    secondary:
      "border border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]",
    danger:
      "border border-rose-300/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
    ghost: "text-slate-300 hover:bg-white/[0.06]",
  };

  return (
    <button
      type={type}
      className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-violet-400/70 disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function FieldShell({ children, className = "" }: FieldShellProps) {
  return <div className={`space-y-2 ${className}`}>{children}</div>;
}

export function AppBadge({ children, tone = "neutral", className = "" }: AppBadgeProps) {
  const tones = {
    neutral: "border-slate-400/20 bg-slate-400/10 text-slate-300",
    success: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-300/25 bg-amber-400/10 text-amber-200",
    danger: "border-rose-300/25 bg-rose-400/10 text-rose-200",
    accent: "border-violet-300/25 bg-violet-400/10 text-violet-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <AppCard className="border-dashed text-center">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
    </AppCard>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
