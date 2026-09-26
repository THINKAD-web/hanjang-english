"use client";

import { formatDateLabel } from "@/lib/engine/date";
import { isDebug, useTodayKey } from "@/lib/use-today-key";

export function TodayLabel() {
  const key = useTodayKey();
  if (!key) return <TodayLabelFallback />;
  return (
    <p className="text-xl font-semibold text-slate-600">
      {formatDateLabel(key)}
      {isDebug && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-sm text-amber-800">DEBUG {key}</span>}
    </p>
  );
}

export function TodayLabelFallback() {
  return <p className="h-7 text-xl" aria-hidden />;
}
