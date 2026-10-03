"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Screen } from "@/components/ui";
import { loadContent } from "@/lib/content/load";
import type { DateKey } from "@/lib/engine/date";
import { recordNextPackRequest, recordSheetAbort, recordSheetComplete, recordSheetStart, recordStepTime } from "@/lib/engine/progress";
import { decideSheet, decideToday, type TodayDecision } from "@/lib/engine/today";
import type { State } from "@/lib/store/types";
import { newAttemptId, useProgress } from "@/lib/use-progress";
import { useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";
import { DailyLimitScreen, DoneTodayScreen, PackCompleteScreen } from "./decision-screens";
import { LessonRunner } from "./lesson-runner";
import { ReviewRunner } from "./review-runner";

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
 * 들어온 순간의 상태로 오늘 할 일을 한 번만 정한다.
 * (진행 중에 기록이 바뀌어도 화면이 다른 장으로 바뀌지 않도록)
 *
 * decideToday 의 5가지 결과를 모두 화면에 연결한다 (PR4 지시서 1장):
 * lesson → LessonRunner(PR3), review → ReviewRunner(복습장), doneToday/dailyLimit/packComplete →
 * 각각의 안내 화면. doneToday 의 "하나 더 하기" 는 decideSheet 로 판단 1·2 단계(하루 한도 체크)를
 * 건너뛰고 바로 다음 장/복습장/팩 완료를 구한다 (today.ts 의 SheetDecision 주석 참고).
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
  const [extra, setExtra] = useState<TodayDecision | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const goHome = useCallback(() => router.push(withDebugDate("/", dateParam)), [router, dateParam]);

  const effective = extra ?? decision;

  if (effective.kind === "dailyLimit") {
    return <DailyLimitScreen onHome={goHome} />;
  }

  if (effective.kind === "doneToday") {
    return (
      <DoneTodayScreen
        canDoExtra={effective.canDoExtra}
        onExtra={() => setExtra(decideSheet(initialState, dateKey, content))}
        onHome={goHome}
      />
    );
  }

  if (effective.kind === "packComplete") {
    return (
      <PackCompleteScreen
        unitLabel={content.pack.unitLabel}
        wordCount={content.items.length}
        onRequestNextPack={() =>
          void update((s) =>
            recordNextPackRequest(s, {
              dateKey,
              at: new Date().toISOString(),
              payload: { packId, completedUnit: content.pack.unitKey },
            }),
          )
        }
      />
    );
  }

  if (effective.kind === "review") {
    const itemIds = effective.itemIds;
    return (
      <ReviewRunner
        content={content}
        itemIds={itemIds}
        dateKey={dateKey}
        onStart={() => {
          startedAtRef.current = new Date().toISOString();
          void update((s) => recordSheetStart(s, { packId, dateKey, at: startedAtRef.current! }));
        }}
        onComplete={(answers, timings) => {
          const finishedAt = new Date().toISOString();
          void update((s) => {
            const withAttempt = recordSheetComplete(s, {
              attemptId: newAttemptId(),
              packId,
              dateKey,
              kind: "review",
              itemIds,
              answers,
              startedAt: startedAtRef.current ?? finishedAt,
              finishedAt,
            });
            return recordStepTime(withAttempt, { packId, dateKey, at: finishedAt, timings });
          });
        }}
        onAbort={(step, elapsedMs) =>
          void update((s) => recordSheetAbort(s, { packId, dateKey, at: new Date().toISOString(), step, elapsedMs }))
        }
        onHome={goHome}
      />
    );
  }

  const lesson = content.lessons.find((l) => l.id === effective.lessonId);
  if (!lesson) {
    // 데이터 정합성이 깨진 예외 상황(존재하지 않는 lessonId)에서만 나온다.
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-3xl font-bold text-slate-900">오늘 학습 준비 중이에요</p>
        </div>
      </Screen>
    );
  }

  return (
    <LessonRunner
      content={content}
      lesson={lesson}
      dateKey={dateKey}
      injectedItemId={effective.injectedItemId}
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
