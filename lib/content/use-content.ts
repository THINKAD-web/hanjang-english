"use client";

import { useEffect, useState } from "react";
import type { Manifest } from "./bundle";
import { ContentNotFoundError, contentRepository } from "./repository";
import type { Content } from "./schema";

/** 불러오는 중 / 준비됨 / 없음(알 수 없는 팩 등 → 화면이 /packs 로 보낸다) / 실패. */
export type Loadable<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "missing" }
  | { status: "error"; error: Error };

type Tagged<T> = { key: string; value: Loadable<T> };

function settle<T>(key: string, p: Promise<T>, apply: (t: Tagged<T>) => void, alive: () => boolean) {
  p.then(
    (data) => alive() && apply({ key, value: { status: "ready", data } }),
    (err: unknown) =>
      alive() &&
      apply({ key, value: err instanceof ContentNotFoundError ? { status: "missing" } : { status: "error", error: err instanceof Error ? err : new Error(String(err)) } }),
  );
}

export function useManifest(): Loadable<Manifest> {
  const [state, setState] = useState<Tagged<Manifest> | null>(null);
  useEffect(() => {
    let alive = true;
    settle("manifest", contentRepository.getManifest(), setState, () => alive);
    return () => {
      alive = false;
    };
  }, []);
  return state ? state.value : { status: "loading" };
}

/** packId 가 null/undefined 이면 아무것도 하지 않고 loading 을 돌려준다. */
export function usePackContent(packId: string | null | undefined): Loadable<Content> {
  const [state, setState] = useState<Tagged<Content> | null>(null);
  useEffect(() => {
    if (!packId) return;
    let alive = true;
    settle(packId, contentRepository.getPack(packId), setState, () => alive);
    return () => {
      alive = false;
    };
  }, [packId]);
  // 이전 팩의 결과를 새 팩으로 착각하지 않는다
  return packId && state && state.key === packId ? state.value : { status: "loading" };
}
