"use client";

import Link from "next/link";
import { LoadFailed, Screen } from "@/components/ui";
import { unitLabelOf } from "@/lib/content/pack-text";
import { useManifest } from "@/lib/content/use-content";
import { useDateParam, withDebugDate } from "@/lib/use-today-key";

/** 내 팩 + 추가 (기획안 v2 6·7-3장). 준비 중 팩은 목록만 보여주고 아직 누를 수 없다. (C9 에서 과목·레벨 선택으로 개편) */
export function PacksScreen() {
  const manifest = useManifest();
  const dateParam = useDateParam();
  if (manifest.status === "error" || manifest.status === "missing") return <LoadFailed />;
  if (manifest.status !== "ready") {
    return (
      <Screen>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }
  const live = manifest.data.packs.filter((p) => p.status === "live");
  const soon = manifest.data.packs.filter((p) => p.status === "soon");

  return (
    <Screen>
      <h1 className="text-3xl font-bold text-slate-900">내 팩</h1>

      <ul className="flex flex-col gap-3">
        {live.map((p) => (
          <li key={p.id}>
            <Link
              href={withDebugDate(`/packs/${p.id}`, dateParam)}
              className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-amber-200"
            >
              <span>
                <span className="block text-xl font-bold text-slate-900">{p.title}</span>
                <span className="block text-base text-slate-600">{p.brandLabel ?? unitLabelOf(p)}</span>
              </span>
              <span className="text-sky-700">진행 중 ›</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-label="준비 중인 팩">
        <h2 className="mb-2 text-lg font-semibold text-slate-700">준비 중</h2>
        <ul className="flex flex-col gap-3">
          {soon.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-slate-500 ring-1 ring-slate-200"
            >
              <span>
                <span className="block text-xl font-semibold">{p.title}</span>
                <span className="block text-base">{p.brandLabel ?? unitLabelOf(p)}</span>
              </span>
              <span className="text-sm">🔒 준비 중</span>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}
