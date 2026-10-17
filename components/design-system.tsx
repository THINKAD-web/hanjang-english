"use client";

import { useEffect, type ReactNode } from "react";
import { dayOfMonth, formatDateLabel, formatDateLong, type DateKey } from "@/lib/engine/date";
import type { StampCell } from "@/lib/engine/progress";
import { BigButton } from "@/components/ui";

/** 오늘 날짜 표시 — DateKey(Seoul)만 사용 */
export function TodayDateBadge({
  dateKey,
  variant = "headline",
}: {
  dateKey: DateKey;
  variant?: "headline" | "compact" | "parent";
}) {
  if (variant === "compact") {
    return (
      <time dateTime={dateKey} className="text-sm font-bold tracking-tight text-slate-600">
        {formatDateLabel(dateKey)}
      </time>
    );
  }
  if (variant === "parent") {
    return (
      <p className="text-base font-bold text-slate-800">
        오늘 · <time dateTime={dateKey}>{formatDateLabel(dateKey)}</time>
      </p>
    );
  }
  return (
    <time
      dateTime={dateKey}
      className="inline-flex items-center rounded-full bg-[var(--color-accent-soft)] px-3.5 py-1.5 text-base font-bold text-[var(--color-accent)] shadow-sm ring-1 ring-[var(--color-accent)]/25"
    >
      {formatDateLong(dateKey)}
    </time>
  );
}

/** 도장 셀 — scale + fade */
export function StampBadge({
  stamped,
  label,
  dateKey,
  isToday,
  isFuture,
}: Pick<StampCell, "stamped" | "label" | "dateKey" | "isToday" | "isFuture">) {
  const dom = dayOfMonth(dateKey);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-[var(--color-accent)]" : "text-slate-500"}`}>
        {label}
      </span>
      <span
        className={`relative flex aspect-square w-full max-w-[3rem] flex-col items-center justify-center rounded-[var(--radius-card)] transition ${
          stamped
            ? "bg-rose-100 shadow-[var(--shadow-card)] ring-2 ring-rose-400"
            : isToday
              ? "bg-white shadow-sm ring-2 ring-[var(--color-accent)]"
              : isFuture
                ? "bg-slate-50 ring-1 ring-slate-200 opacity-55"
                : "bg-white ring-1 ring-amber-200/90"
        }`}
        role="img"
        aria-label={`${label} ${dom}일 ${stamped ? "도장 있음" : "도장 없음"}`}
      >
        <span className={`text-sm font-bold leading-none ${isToday ? "text-[var(--color-accent)]" : "text-slate-500"}`}>{dom}</span>
        {stamped ? (
          <span className="stamp-badge-pop mt-0.5 text-xl leading-none" aria-hidden>
            💮
          </span>
        ) : isToday ? (
          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" aria-hidden />
        ) : null}
      </span>
    </div>
  );
}

export function WeekCalendar({ cells, title = "이번 주 도장", emphasized }: { cells: StampCell[]; title?: string; emphasized?: boolean }) {
  return (
    <section
      aria-label={title}
      className={`rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] ${
        emphasized ? "ring-2 ring-amber-300/80 shadow-md" : "ring-1 ring-[var(--color-ring)]"
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className={`font-bold text-slate-900 ${emphasized ? "text-xl" : "text-lg"}`}>{title}</h2>
        <p className="text-sm font-medium text-slate-500">월 → 일</p>
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {cells.map((c) => (
          <li key={c.dateKey}>
            <StampBadge {...c} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ProgressRing({ ratio, label }: { ratio: number; label: string }) {
  const pct = Math.min(1, Math.max(0, ratio));
  const deg = pct * 360;
  return (
    <div className="flex flex-col items-center gap-2" aria-label={label}>
      <div
        className="relative flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(var(--color-accent) ${deg}deg, var(--color-amber-100) 0)` }}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface)] text-lg font-bold text-slate-800">
          {Math.round(pct * 100)}%
        </span>
      </div>
      <p className="text-center text-sm font-semibold text-slate-700">{label}</p>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-panel)] bg-[var(--color-surface)] px-6 py-10 text-center shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-ring)]">
      <div className="text-5xl" aria-hidden>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{title}</p>
      {body ? <p className="text-lg text-slate-600">{body}</p> : null}
      {action}
    </div>
  );
}

export function LoadingSkeleton({ variant = "home" }: { variant?: "home" | "packs" | "learn" }) {
  const blocks =
    variant === "packs" ? 4 : variant === "learn" ? 2 : 3;
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="불러오는 중">
      <div className="h-10 w-2/3 animate-pulse rounded-xl bg-amber-100" />
      {Array.from({ length: blocks }, (_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-[var(--radius-panel)] bg-amber-100" />
      ))}
    </div>
  );
}

export function CelebrationOverlay({ show, onDone }: { show: boolean; onDone: () => void }) {
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onDone]);

  if (!show) return null;
  return (
    <div
      className="celebration-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="장 완료"
    >
      <div className="celebration-pop relative flex max-w-sm flex-col items-center gap-3 rounded-[var(--radius-panel)] bg-[var(--color-surface)] px-8 py-9 text-center shadow-[var(--shadow-card)] ring-1 ring-[var(--color-ring)]">
        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <p className="text-2xl font-bold text-slate-900">잘했어요!</p>
        <p className="text-base text-slate-600">오늘 한 장을 끝냈어요</p>
        {!reducedMotion ? <div className="confetti" aria-hidden /> : null}
        <BigButton autoFocus onClick={onDone}>
          도장 받기
        </BigButton>
      </div>
    </div>
  );
}

export function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex justify-center gap-1.5" aria-label={`단계 ${current + 1} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all ${i === current ? "w-7 bg-[var(--color-accent)] shadow-sm" : i < current ? "w-2 bg-amber-400" : "w-2 bg-amber-100"}`}
        />
      ))}
    </div>
  );
}

export function StreakPill({ days, large }: { days: number; large?: boolean }) {
  if (days < 1) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-orange-100 font-bold text-orange-900 ring-2 ring-orange-300/70 ${
        large ? "px-4 py-1.5 text-lg shadow-sm" : "px-3 py-1 text-base ring-1 ring-orange-200"
      }`}
    >
      <span aria-hidden className={large ? "text-xl" : undefined}>
        🔥
      </span>
      {days}일 연속
    </span>
  );
}

export function ProfileAvatar({ name, type }: { name?: string; type: "child" | "self" }) {
  const initial = (name?.trim()[0] ?? (type === "child" ? "아" : "나")).toUpperCase();
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${
        type === "child" ? "bg-sky-600" : "bg-slate-600"
      }`}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function BadgeChip({ label }: { label: string }) {
  return <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-900 ring-1 ring-violet-200">{label}</span>;
}

export function ReviewModeBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-sm font-bold text-slate-800">기록에 반영되지 않아요</span>
  );
}

/** subjectId → 간단 아이콘 (이모지, 외부 에셋 없음) */
export function subjectIcon(subjectId: string): string {
  if (subjectId.startsWith("math")) return "➕";
  if (subjectId.startsWith("ja")) return "あ";
  if (subjectId.startsWith("en")) return "Aa";
  return "📘";
}

export function subjectAccent(subjectId: string): { tile: string; chip: string } {
  if (subjectId.startsWith("math")) return { tile: "bg-emerald-100 ring-emerald-300/80", chip: "from-emerald-50 to-white ring-emerald-300" };
  if (subjectId.startsWith("ja")) return { tile: "bg-rose-100 ring-rose-300/80", chip: "from-rose-50 to-white ring-rose-300" };
  if (subjectId.startsWith("en")) return { tile: "bg-sky-100 ring-sky-300/80", chip: "from-sky-50 to-white ring-sky-300" };
  return { tile: "bg-amber-100 ring-amber-300/80", chip: "from-amber-50 to-white ring-amber-300" };
}

export function PackIconTile({ subjectId, size = "md" }: { subjectId: string; size?: "md" | "lg" }) {
  const accent = subjectAccent(subjectId);
  const dims = size === "lg" ? "h-[4.25rem] w-[4.25rem] text-[1.75rem]" : "h-14 w-14 text-2xl";
  return (
    <span
      className={`flex shrink-0 ${dims} items-center justify-center rounded-2xl shadow-[var(--shadow-soft)] ring-2 ${accent.tile}`}
      aria-hidden
    >
      {subjectIcon(subjectId)}
    </span>
  );
}

const AUDIENCE_TAB: Record<"kid" | "adult", string> = { kid: "어린이", adult: "성인" };

export function AudienceSegment({
  value,
  onChange,
}: {
  value: "kid" | "adult";
  onChange: (v: "kid" | "adult") => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="대상"
      className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1 shadow-inner ring-1 ring-slate-300/50"
    >
      {(["kid", "adult"] as const).map((a) => (
        <button
          key={a}
          type="button"
          role="tab"
          aria-selected={value === a}
          onClick={() => onChange(a)}
          className={`min-h-[3.5rem] rounded-xl text-lg font-bold transition active:scale-[0.98] ${
            value === a ? "bg-white text-slate-900 shadow-md ring-1 ring-slate-200/90" : "text-slate-600 hover:text-slate-800"
          }`}
        >
          {AUDIENCE_TAB[a]}
        </button>
      ))}
    </div>
  );
}
