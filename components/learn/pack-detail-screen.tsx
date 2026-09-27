"use client";

import Link from "next/link";
import { ConsonantRow } from "@/components/consonant-row";
import { ProgressBar, Screen } from "@/components/ui";
import { loadContent } from "@/lib/content/load";
import { packProgress } from "@/lib/engine/progress";
import { completedLessonIds } from "@/lib/engine/today";
import { useProgress } from "@/lib/use-progress";
import { useDateParam, withDebugDate } from "@/lib/use-today-key";

/** `/packs/[packId]` — 팩 안 목차 (기획안 v2 7-2). */
export function PackDetailScreen({ packId }: { packId: string }) {
  const { state } = useProgress();
  const dateParam = useDateParam();
  const content = loadContent(packId);

  if (!state) {
    return (
      <Screen>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }

  const progress = packProgress(state, content);
  const done = new Set(completedLessonIds(state, packId));

  return (
    <Screen>
      <header>
        <h1 className="text-3xl font-bold text-slate-900">{content.pack.title}</h1>
        <p className="text-lg text-slate-600">{content.pack.brandLabel}</p>
      </header>

      <ProgressBar label={`${content.pack.unitLabel} ${progress.done}/${progress.total}장`} ratio={progress.done / progress.total} />
      <ConsonantRow active={content.pack.unitLabel} />

      <section aria-label="다시 보기">
        <h2 className="mb-2 text-lg font-semibold text-slate-700">끝낸 장</h2>
        {content.lessons.some((l) => done.has(l.id)) ? (
          <ul className="flex flex-wrap gap-2">
            {content.lessons
              .filter((l) => done.has(l.id))
              .map((l) => (
                <li key={l.id}>
                  <Link
                    href={withDebugDate(`/learn/${packId}/${l.id}`, dateParam)}
                    className="flex min-h-12 items-center rounded-xl bg-white px-4 text-lg font-semibold text-sky-800 ring-1 ring-amber-200"
                  >
                    {String(l.dayNo).padStart(2, "0")}
                  </Link>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-base text-slate-500">아직 끝낸 장이 없어요.</p>
        )}
      </section>

      <Link
        href={withDebugDate(`/learn/${packId}`, dateParam)}
        className="mt-auto flex min-h-16 items-center justify-center rounded-2xl bg-sky-700 text-2xl font-bold text-white"
      >
        오늘 한 장 시작
      </Link>
    </Screen>
  );
}
