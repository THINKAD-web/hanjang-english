"use client";

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { resolveDateKey, type DateKey } from "@/lib/engine/date";

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

export { isDebug };
