"use client";

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { isDateKey, resolveDateKey, type DateKey } from "@/lib/engine/date";

const isDebug = process.env.NEXT_PUBLIC_DEBUG === "true";

const noopSubscribe = () => () => {};

/**
 * 클라이언트에서만 오늘 날짜 키를 계산한다 (서버에서는 null).
 * 서버/클라이언트 시각 차이로 인한 hydration 불일치를 막기 위함.
 * useSearchParams 를 쓰므로 호출 컴포넌트는 <Suspense> 안에 있어야 한다.
 */
export function useTodayKey(): DateKey | null {
  const dateParam = useSearchParams().get("date");
  return useSyncExternalStore(
    noopSubscribe,
    () => resolveDateKey(dateParam, { debug: isDebug }),
    () => null,
  );
}

/**
 * 디버그 모드에서 ?date= 를 다른 화면으로 넘길 때 쓴다. 디버그가 아니면 경로 그대로.
 * 예: withDebugDate("/sheet", "2026-09-28") → "/sheet?date=2026-09-28"
 */
export function withDebugDate(path: string, dateParam: string | null): string {
  if (!isDebug || !dateParam || !isDateKey(dateParam)) return path;
  return `${path}?date=${dateParam}`;
}

/** 현재 URL 의 ?date= 값 (디버그 링크 전달용) */
export function useDateParam(): string | null {
  return useSearchParams().get("date");
}

export { isDebug };
