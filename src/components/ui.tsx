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
  "border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]";
export const appMutedSurface = "border border-slate-200/80 bg-slate-50";
export const appInput =
  "rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-300/60 disabled:cursor-not-allowed disabled:opacity-60";
export const appTableHeader =
  "bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500";
export const appTableRow = "border-t border-slate-200 hover:bg-slate-50/80";
export const chartTooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid rgba(226,232,240,1)",
  borderRadius: "16px",
  color: "#0f172a",
  boxShadow: "0 18px 40px rgba(15,23,42,0.10)",
};
export const chartGridColor = "rgba(148, 163, 184, 0.22)";
export const chartTextColor = "#64748b";
export const chartColors = [
  "#6b7280", // 柔灰
  "#93c5fd", // 淺藍
  "#fdba74", // 淺橘
  "#bef264", // 淺綠
  "#fca5a5", // 淺紅
  "#67e8f9", // 淺青
  "#c4b5fd", // 淺紫
  "#5eead4", // 淺綠藍
  "#d1d5db", // 淺灰
];

export function AppCard({ children, className = "", padded = true }: AppCardProps) {
  return (
    <section className={`rounded-[1.75rem] ${appSurface} ${padded ? "p-4 sm:p-5" : ""} ${className}`}>
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
      "bg-slate-900 text-white shadow-sm hover:bg-slate-800",
    secondary:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger:
      "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
    ghost: "text-slate-600 hover:bg-slate-100",
  };

  return (
    <button
      type={type}
      className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-violet-400/70 disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${className}`}
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
    neutral: "border-slate-200 bg-slate-100 text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-600",
    warning: "border-amber-200 bg-amber-50 text-amber-600",
    danger: "border-rose-200 bg-rose-50 text-rose-600",
    accent: "border-sky-200 bg-sky-50 text-sky-600",
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
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
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
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
