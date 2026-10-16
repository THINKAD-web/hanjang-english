"use client";

import Link from "next/link";
import { ConsonantRow } from "@/components/consonant-row";
import { LoadFailed, ProgressBar, Screen } from "@/components/ui";
import { usePackContent } from "@/lib/content/use-content";
import { activeItems } from "@/lib/engine/queue";
import { packProgress, recordPackInterest } from "@/lib/engine/progress";
import { completedLessonIds } from "@/lib/engine/today";
import { useProgress } from "@/lib/use-progress";
import { useRedirect } from "@/lib/use-redirect";
import { useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";
import { unitLabelOf } from "@/lib/content/pack-text";

/** `/packs/[packId]` — 팩 안 목차 (기획안 v2 7-2). */
export function PackDetailScreen({ packId }: { packId: string }) {
  const { state, update } = useProgress();
  const dateKey = useTodayKey();
  const dateParam = useDateParam();
  const pack = usePackContent(packId);
  // 알 수 없는 팩 · 준비 중(soon) 팩 · 레슨이 없는 팩은 /packs 로 보낸다.
  const unavailable = pack.status === "missing" || (pack.status === "ready" && (pack.data.pack.status !== "live" || pack.data.lessons.length === 0));
  useRedirect(unavailable, withDebugDate("/packs", dateParam));

  if (pack.status === "error") return <LoadFailed />;
  if (!state || pack.status !== "ready" || unavailable) {
    return (
      <Screen>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }
  const content = pack.data;

  const progress = packProgress(state, content);
  const done = new Set(completedLessonIds(state, packId));
  const wrongCount = activeItems(state.wrongQueue, packId).length;

  const onLockedConsonantClick = (consonant: string) => {
    const today = dateKey ?? new Date().toISOString().slice(0, 10);
    void update((s) => recordPackInterest(s, { dateKey: today, at: new Date().toISOString(), payload: { packId, unit: consonant } }));
  };

  return (
    <Screen>
      <header>
        <h1 className="text-3xl font-bold text-slate-900">{content.pack.title}</h1>
        <p className="text-lg text-slate-600">{content.pack.brandLabel}</p>
      </header>

      <ProgressBar label={`${unitLabelOf(content.pack)} ${progress.done}/${progress.total}장`} ratio={progress.done / progress.total} />
      {wrongCount > 0 ? <p className="text-base font-semibold text-amber-800">오답 {wrongCount}개 복습 예정</p> : null}
      <ConsonantRow active={unitLabelOf(content.pack)} onLockedClick={onLockedConsonantClick} />

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
                    {String(l.order).padStart(2, "0")}
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
