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
  "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-[var(--app-shadow)]";
export const appMutedSurface =
  "border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)]";
export const appInput =
  "rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-subtle)] focus:border-[var(--app-border)] focus:ring-2 focus:ring-[var(--app-border)] focus:ring-opacity-40 disabled:cursor-not-allowed disabled:opacity-60";
export const appTableHeader =
  "bg-[var(--app-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--app-text-muted)]";
export const appTableRow =
  "border-t border-[var(--app-border)] hover:bg-[var(--app-surface-muted)]";
export const chartTooltipStyle = {
  backgroundColor: "var(--app-surface)",
  border: "1px solid var(--app-border)",
  borderRadius: "16px",
  color: "var(--app-text)",
  boxShadow: "0 18px 40px rgba(15,23,42,0.10)",
};
export const chartGridColor = "var(--app-chart-grid)";
export const chartTextColor = "var(--app-text-muted)";
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
      "bg-[var(--app-primary)] text-[var(--app-primary-text)] shadow-sm hover:brightness-110",
    secondary:
      "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]",
    danger:
      "border border-[var(--app-border)] bg-[var(--app-danger-bg)] text-[var(--app-danger-text)] hover:bg-[var(--app-danger-bg)]/90",
    ghost: "text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]",
  };

  return (
    <button
      type={type}
      className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]/70 disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${className}`}
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
    neutral: "border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]",
    success: "border-[var(--app-border)] bg-[var(--app-success-bg)] text-[var(--app-success-text)]",
    warning: "border-[var(--app-border)] bg-[var(--app-warning-bg)] text-[var(--app-warning-text)]",
    danger: "border-[var(--app-border)] bg-[var(--app-danger-bg)] text-[var(--app-danger-text)]",
    accent: "border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)]",
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
      <h2 className="text-lg font-semibold text-[var(--app-text)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">{message}</p>
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
        <h2 className="text-lg font-semibold text-[var(--app-text)]">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
