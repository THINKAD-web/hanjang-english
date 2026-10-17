"use client";

import { useCallback, useEffect, useState } from "react";
import { LocalProgressStore } from "@/lib/store/local";
import type { State } from "@/lib/store/types";

let store: LocalProgressStore | null = null;

/** 한 화면에서 저장하면 같은 기기의 다른 구독자(예: 상단 스킨)도 새 상태를 받는다. */
const listeners = new Set<(s: State) => void>();
const publish = (s: State) => listeners.forEach((l) => l(s));

export function getStore(): LocalProgressStore {
  store ??= new LocalProgressStore();
  return store;
}

/**
 * 기기에 저장된 진행 상태. 처음 렌더(서버 포함)에는 null 이고 클라이언트에서 불러온 뒤 채워진다.
 * update 는 load → fn → save 후 화면 상태도 갱신한다.
 */
export function useProgress() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let alive = true;
    getStore()
      .load()
      .then((s) => {
        if (alive) setState(s);
      });
    listeners.add(setState);
    return () => {
      alive = false;
      listeners.delete(setState);
    };
  }, []);

  const update = useCallback(async (fn: (s: State) => State) => {
    const next = await getStore().update(fn);
    publish(next);
    return next;
  }, []);

  const reset = useCallback(async () => {
    await getStore().reset();
    publish(await getStore().load());
  }, []);

  return { state, update, reset };
}

export function newAttemptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
