import { useEffect, useState } from "react";
import { loadMacroData } from "../services/macroDataService";
import type { MacroData, MacroEvent, MacroIndicator } from "../types/macro";
import { formatDateTime } from "../utils/format";
import { getMacroDataStatus } from "../utils/macroDataStatus";
import { AppBadge, AppCard, appMutedSurface, SectionHeader } from "../components/ui";

const INDICATOR_ORDER = [
  "US_CPI",
  "US_CORE_CPI",
  "US_PPI_FINAL_DEMAND",
  "US_UNEMPLOYMENT_RATE",
];

const INDICATOR_LABELS: Record<string, string> = {
  US_CPI: "US CPI",
  US_CORE_CPI: "US Core CPI",
  US_PPI_FINAL_DEMAND: "US PPI Final Demand",
  US_UNEMPLOYMENT_RATE: "US Unemployment Rate",
};

const LINK_LABELS: Array<[keyof MacroEvent["links"], string]> = [
  ["statement", "Statement"],
  ["implementationNote", "Implementation Note"],
  ["minutes", "Minutes"],
  ["pressConference", "Press Conference"],
  ["sep", "SEP / Projections"],
];

export function MacroPage() {
  const [macroData, setMacroData] = useState<MacroData | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadMacroData().then((data) => {
      if (!cancelled) {
        setMacroData(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!macroData) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <MacroHeader />
        <AppCard>
          <p className="text-sm text-[var(--app-text-muted)]">總經資料載入中...</p>
        </AppCard>
      </div>
    );
  }

  return <MacroPageContent macroData={macroData} />;
}

export function MacroPageContent({
  macroData,
  now = new Date(),
}: {
  macroData: MacroData;
  now?: Date;
}) {
  const macroStatus = getMacroDataStatus(macroData, now);
  const indicators = macroData.indicators.data?.indicators ?? {};
  const latestCompleted = selectLatestCompletedFomc(macroData.events.data?.events ?? []);
  const nextUpcoming = selectNextUpcomingFomc(macroData.events.data?.events ?? []);

  return (
    <div className="space-y-5 sm:space-y-6">
      <MacroHeader />

      <AppCard>
        <SectionHeader
          title="最新總經數據"
          description="BLS 靜態資料，顯示最新期間、MoM、YoY 與資料狀態。"
        />
        {macroData.indicators.data ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {INDICATOR_ORDER.map((id) => (
              <MacroIndicatorCard
                key={id}
                id={id}
                indicator={indicators[id]}
                generatedAt={macroData.indicators.data?.generatedAt}
              />
            ))}
          </div>
        ) : (
          <UnavailableCard title="總經指標暫時無法載入" errors={macroData.indicators.errors} />
        )}
      </AppCard>

      <AppCard>
        <SectionHeader
          title="重大事件"
          description="FOMC 事件僅呈現官方日期、利率目標區間與官方連結。"
        />
        {macroData.events.data ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <FomcEventCard title="Latest completed FOMC" event={latestCompleted} />
            <FomcEventCard title="Next upcoming FOMC" event={nextUpcoming} />
          </div>
        ) : (
          <UnavailableCard title="FOMC 事件資料暫時無法載入" errors={macroData.events.errors} />
        )}
      </AppCard>

      <AppCard>
        <SectionHeader title="資料新鮮度" description="總經資料由排程產生，瀏覽器只讀取靜態 JSON。" />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatusTile label="整體狀態" value={macroStatus.label} tone={macroStatus.status} />
          <StatusTile
            label="Indicators generatedAt"
            value={formatDateTime(macroStatus.generatedAt.indicators ?? undefined)}
          />
          <StatusTile
            label="FOMC generatedAt"
            value={formatDateTime(macroStatus.generatedAt.events ?? undefined)}
          />
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--app-text-muted)]">
          僅供資訊參考，不代表投資建議、市場預測或買賣訊號。
        </p>
      </AppCard>
    </div>
  );
}

function MacroHeader() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
        Macro Watch
      </p>
      <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
        總經觀察
      </h2>
      <p className="max-w-3xl text-sm leading-6 text-[var(--app-text-muted)]">
        顯示官方總經資料與 FOMC 事件資訊，僅供投資環境參考，不代表投資建議或市場預測。
      </p>
    </div>
  );
}

function MacroIndicatorCard({
  id,
  indicator,
  generatedAt,
}: {
  id: string;
  indicator?: MacroIndicator;
  generatedAt?: string;
}) {
  if (!indicator) {
    return <UnavailableCard title={`${INDICATOR_LABELS[id] ?? id} 暫無資料`} />;
  }

  const isUnemployment = indicator.changeUnit === "percentage_point";

  return (
    <div className={`rounded-2xl p-4 ${appMutedSurface}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--app-text)]">
            {INDICATOR_LABELS[id] ?? indicator.name}
          </h3>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">
            {indicator.period ?? "暫無期間"} · {indicator.source}
          </p>
        </div>
        <AppBadge tone={indicator.status === "ok" ? "success" : "warning"}>
          {indicator.status}
        </AppBadge>
      </div>

      <div className="mt-4">
        <p className="text-xs text-[var(--app-text-subtle)]">Level</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--app-text)]">
          {formatMacroLevel(indicator)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Metric label="MoM" value={formatMacroChange(indicator.mom, indicator.changeUnit)} />
        <Metric label="YoY" value={formatMacroChange(indicator.yoy, indicator.changeUnit)} />
      </div>

      <p className="mt-4 text-xs leading-5 text-[var(--app-text-muted)]">
        {isUnemployment
          ? "MoM / YoY 為百分點變化，不是百分比報酬。"
          : "MoM / YoY 為指數變動率。"}
      </p>
      {generatedAt ? (
        <p className="mt-2 text-xs text-[var(--app-text-subtle)]">
          Updated {formatDateTime(generatedAt)}
        </p>
      ) : null}
    </div>
  );
}

function FomcEventCard({ title, event }: { title: string; event: MacroEvent | null }) {
  if (!event) {
    return <UnavailableCard title={`${title} 暫無資料`} />;
  }

  return (
    <div className={`rounded-2xl p-4 ${appMutedSurface}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--app-text)]">{title}</h3>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            {formatDateRange(event.startDate, event.endDate)}
          </p>
        </div>
        <AppBadge tone={event.status === "upcoming" ? "accent" : "success"}>
          {event.status}
        </AppBadge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric label="Target range" value={formatTargetRange(event)} />
        <Metric label="Change" value={formatChangeBps(event.rateDecision.changeBps)} />
      </div>

      {event.hasSep ? (
        <p className="mt-3 rounded-2xl bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-muted)]">
          SEP / projections associated meeting
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {LINK_LABELS.map(([key, label]) =>
          event.links[key] ? (
            <a
              key={key}
              href={event.links[key] ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface)]"
            >
              {label}
            </a>
          ) : null,
        )}
      </div>
    </div>
  );
}

function UnavailableCard({ title, errors = [] }: { title: string; errors?: string[] }) {
  return (
    <div className={`rounded-2xl p-4 ${appMutedSurface}`}>
      <h3 className="font-semibold text-[var(--app-text)]">{title}</h3>
      {errors.length ? (
        <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">{errors[0]}</p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">暫無資料</p>
      )}
    </div>
  );
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${appMutedSurface}`}>
      <p className="text-xs text-[var(--app-text-subtle)]">{label}</p>
      <p className="mt-1 font-semibold text-[var(--app-text)]">{value}</p>
      {tone === "stale" ? (
        <p className="mt-1 text-xs text-[var(--app-warning-text)]">資料可能已過期</p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--app-text-subtle)]">{label}</p>
      <p className="mt-1 font-semibold text-[var(--app-text)]">{value}</p>
    </div>
  );
}

export function selectLatestCompletedFomc(events: MacroEvent[]) {
  return (
    events
      .filter((event) => ["released", "minutes_pending", "complete"].includes(event.status))
      .sort((left, right) => left.decisionDate.localeCompare(right.decisionDate))
      .at(-1) ?? null
  );
}

export function selectNextUpcomingFomc(events: MacroEvent[]) {
  return (
    events
      .filter((event) => event.status === "upcoming")
      .sort((left, right) => left.decisionDate.localeCompare(right.decisionDate))
      .at(0) ?? null
  );
}

export function formatMacroLevel(indicator: MacroIndicator) {
  if (indicator.level === null) {
    return "—";
  }
  if (indicator.unit === "percent_rate") {
    return `${formatNumber(indicator.level, 1)}%`;
  }
  return formatNumber(indicator.level, 3);
}

export function formatMacroChange(
  value: number | null,
  changeUnit: MacroIndicator["changeUnit"],
) {
  if (value === null) {
    return "—";
  }
  if (changeUnit === "percentage_point") {
    return `${formatSignedNumber(value, 1)} 個百分點`;
  }
  return `${formatSignedNumber(value * 100, 2)}%`;
}

function formatTargetRange(event: MacroEvent) {
  const decision = event.rateDecision;
  if (
    !decision.available ||
    decision.targetRangeLower === null ||
    decision.targetRangeUpper === null
  ) {
    return "—";
  }
  return `${formatNumber(decision.targetRangeLower, 2)}% - ${formatNumber(decision.targetRangeUpper, 2)}%`;
}

function formatChangeBps(value: number | null) {
  if (value === null) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${value} bps`;
}

function formatDateRange(startDate: string, endDate: string) {
  return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
}

function formatNumber(value: number, maximumFractionDigits: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: value % 1 === 0 ? 0 : undefined,
  });
}

function formatSignedNumber(value: number, maximumFractionDigits: number) {
  const formatted = formatNumber(Math.abs(value), maximumFractionDigits);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}
