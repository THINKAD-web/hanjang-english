"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BigButton, Screen } from "@/components/ui";
import { loadContent } from "@/lib/content/load";
import type { DateKey } from "@/lib/engine/date";
import { recordSheetComplete, recordSheetStart } from "@/lib/engine/progress";
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
 * PR3 는 일반 장만 실행한다. 복습장·팩 완료 화면은 PR4.
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
  const [attemptId] = useState(() => newAttemptId());
  const goHome = useCallback(() => router.push(withDebugDate("/", dateParam)), [router, dateParam]);

  const lesson = decision.kind === "lesson" ? content.lessons.find((l) => l.id === decision.lessonId) : undefined;
  if (!lesson) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-3xl font-bold text-slate-900">
            {decision.kind === "packComplete" ? `${content.pack.unitLabel} 완료! 다음 단위는 준비 중이에요` : "오늘 할 장이 없어요"}
          </p>
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
      onStart={() =>
        void update((s) =>
          recordSheetStart(s, { attemptId, packId, dateKey, kind: "lesson", lessonId: lesson.id, itemIds: lesson.itemIds, at: new Date().toISOString() }),
        )
      }
      onComplete={(answers) => void update((s) => recordSheetComplete(s, attemptId, answers, new Date().toISOString()))}
      onHome={goHome}
    />
  );
}
