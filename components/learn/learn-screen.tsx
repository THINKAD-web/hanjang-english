"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { BigButton, Screen } from "@/components/ui";
import { loadContent } from "@/lib/content/load";
import type { DateKey } from "@/lib/engine/date";
import { recordSheetAbort, recordSheetComplete, recordSheetStart, recordStepTime } from "@/lib/engine/progress";
import { decideToday } from "@/lib/engine/today";
import type { State } from "@/lib/store/types";
import { newAttemptId, useProgress } from "@/lib/use-progress";
import { useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";
import { LessonRunner } from "./lesson-runner";

/**
 * `/learn/[packId]` — 오늘 할 일은 항상 엔진(decideToday)이 정한다. URL 로 장을 건너뛸 수 없다
 * (기획안 v2 3장 원칙 8, 6장 라우팅).
 */
export function LearnScreen({ packId }: { packId: string }) {
  const dateKey = useTodayKey();
  const { state, update } = useProgress();
  if (!dateKey || !state) {
    return (
      <Screen>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }
  return <LearnGate packId={packId} initialState={state} dateKey={dateKey} update={update} />;
}

/**
 * 들어온 순간의 상태로 오늘 할 장을 한 번만 정한다.
 * (진행 중에 기록이 바뀌어도 화면이 다른 장으로 바뀌지 않도록)
 * decideToday 가 lesson 을 반환할 때만 처리한다. 그 외(복습장·하루 한도 등)는
 * "오늘 학습 준비 중" 임시 화면만 보여준다 — PR4 에서 해당 화면으로 교체한다.
 */
function LearnGate({
  packId,
  initialState,
  dateKey,
  update,
}: {
  packId: string;
  initialState: State;
  dateKey: DateKey;
  update: (fn: (s: State) => State) => Promise<State>;
}) {
  const router = useRouter();
  const dateParam = useDateParam();
  const content = loadContent(packId);
  const [decision] = useState(() => decideToday(initialState, dateKey, content));
  const startedAtRef = useRef<string | null>(null);
  const goHome = useCallback(() => router.push(withDebugDate("/", dateParam)), [router, dateParam]);

  const lesson = decision.kind === "lesson" ? content.lessons.find((l) => l.id === decision.lessonId) : undefined;
  if (!lesson) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-3xl font-bold text-slate-900">오늘 학습 준비 중이에요</p>
          <BigButton onClick={goHome}>홈으로</BigButton>
        </div>
      </Screen>
    );
  }

  return (
    <LessonRunner
      content={content}
      lesson={lesson}
      dateKey={dateKey}
      injectedItemId={decision.kind === "lesson" ? decision.injectedItemId : undefined}
      onStart={() => {
        startedAtRef.current = new Date().toISOString();
        void update((s) => recordSheetStart(s, { packId, lessonId: lesson.id, dateKey, at: startedAtRef.current! }));
      }}
      onComplete={(answers, timings) => {
        const finishedAt = new Date().toISOString();
        void update((s) => {
          const withAttempt = recordSheetComplete(s, {
            attemptId: newAttemptId(),
            packId,
            dateKey,
            kind: "lesson",
            lessonId: lesson.id,
            itemIds: lesson.itemIds,
            answers,
            startedAt: startedAtRef.current ?? finishedAt,
            finishedAt,
          });
          return recordStepTime(withAttempt, { packId, lessonId: lesson.id, dateKey, at: finishedAt, timings });
        });
      }}
      onAbort={(step, elapsedMs) =>
        void update((s) => recordSheetAbort(s, { packId, lessonId: lesson.id, dateKey, at: new Date().toISOString(), step, elapsedMs }))
      }
      onHome={goHome}
    />
  );
}
