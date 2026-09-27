"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Screen } from "@/components/ui";
import { loadContent } from "@/lib/content/load";
import { completedLessonIds } from "@/lib/engine/today";
import { useProgress } from "@/lib/use-progress";
import { useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";
import { LessonRunner } from "./lesson-runner";

/**
 * `/learn/[packId]/[lessonId]` — 이미 끝낸 장만 다시 볼 수 있다. 진도·도장에는 반영하지 않는다.
 * 아직 끝내지 않은(잠긴) 장으로 들어오면 `/learn/[packId]` 로 되돌린다 (기획안 v2 6장).
 */
export function ReviewScreen({ packId, lessonId }: { packId: string; lessonId: string }) {
  const dateKey = useTodayKey();
  const dateParam = useDateParam();
  const { state } = useProgress();
  const router = useRouter();
  const content = loadContent(packId);
  const lesson = content.lessons.find((l) => l.id === lessonId);
  const locked = Boolean(state) && !completedLessonIds(state!, packId).includes(lessonId);

  useEffect(() => {
    if (state && (locked || !lesson)) router.replace(withDebugDate(`/learn/${packId}`, dateParam));
  }, [state, locked, lesson, router, packId, dateParam]);

  if (!dateKey || !state || !lesson || locked) {
    return (
      <Screen>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }

  return (
    <LessonRunner
      content={content}
      lesson={lesson}
      dateKey={dateKey}
      sheetId={`${lesson.id}-review`}
      onHome={() => router.push(withDebugDate(`/packs/${packId}`, dateParam))}
    />
  );
}
