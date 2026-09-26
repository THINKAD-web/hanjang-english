import type { Content } from "@/lib/content/schema";
import type { AnswerRecord, Attempt, State } from "@/lib/store/types";
import { weekRange, type DateKey } from "./date";
import { applyAttempt } from "./queue";
import { completedLessonIds, type TodayDecision } from "./today";

/**
 * 진행 기록 갱신과 홈 화면용 파생 값. 모두 순수 함수 (저장은 호출하는 쪽에서).
 */

export type SheetStartInput = {
  attemptId: string;
  dateKey: DateKey;
  kind: Attempt["kind"];
  lessonId?: string;
  wordIds: string[];
  /** ISO 시각 */
  at: string;
};

/** "시작" 탭: 미완료 시도를 만들고 sheet_start 이벤트를 남긴다. 이탈하면 completed: false 로 남는다. */
export function recordSheetStart(state: State, input: SheetStartInput): State {
  const attempt: Attempt = {
    id: input.attemptId,
    dateKey: input.dateKey,
    kind: input.kind,
    ...(input.lessonId ? { lessonId: input.lessonId } : {}),
    wordIds: input.wordIds,
    answers: [],
    score: 0,
    startedAt: input.at,
    completed: false,
  };
  return {
    ...state,
    attempts: [...state.attempts, attempt],
    events: [
      ...state.events,
      { type: "sheet_start", dateKey: input.dateKey, at: input.at, payload: { attemptId: input.attemptId, lessonId: input.lessonId ?? null } },
    ],
  };
}

/** 퀴즈까지 끝냄: 시도를 완료로 바꾸고 오답 큐에 반영, sheet_complete 이벤트를 남긴다. */
export function recordSheetComplete(state: State, attemptId: string, answers: AnswerRecord[], at: string): State {
  const prev = state.attempts.find((a) => a.id === attemptId);
  if (!prev || prev.completed) return state;
  const done: Attempt = {
    ...prev,
    answers,
    score: answers.filter((a) => a.correct).length,
    finishedAt: at,
    completed: true,
  };
  return {
    ...state,
    attempts: state.attempts.map((a) => (a.id === attemptId ? done : a)),
    wrongQueue: applyAttempt(state.wrongQueue, done),
    events: [
      ...state.events,
      {
        type: "sheet_complete",
        dateKey: done.dateKey,
        at,
        payload: { attemptId, lessonId: done.lessonId ?? null, score: done.score, total: answers.length },
      },
    ],
  };
}

export type StampCell = { dateKey: DateKey; label: string; stamped: boolean; isToday: boolean; isFuture: boolean };

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/** 이번 주 도장 7칸 (월~일). 그날 완료한 장(복습장 포함)이 하나라도 있으면 도장. */
export function weekStamps(state: State, dateKey: DateKey): StampCell[] {
  const done = new Set(state.attempts.filter((a) => a.completed).map((a) => a.dateKey));
  return weekRange(dateKey).map((d, i) => ({
    dateKey: d,
    label: DAY_LABELS[i],
    stamped: done.has(d),
    isToday: d === dateKey,
    isFuture: d > dateKey,
  }));
}

/** "ㄱ · 3/8장" 용: 완료한 장 수 */
export function packProgress(state: State, content: Content): { done: number; total: number } {
  const ids = new Set(content.lessons.map((l) => l.id));
  return { done: completedLessonIds(state).filter((id) => ids.has(id)).length, total: content.lessons.length };
}

export type HomeCta = { label: string; sub?: string; enabled: boolean };

/**
 * 홈의 큰 버튼 문구. PR3 에서는 일반 장만 실행한다.
 * 복습장·한 장 더·팩 완료 화면은 PR4 에서 연결한다.
 */
export function homeCta(decision: TodayDecision, content: Content): HomeCta {
  switch (decision.kind) {
    case "lesson": {
      const lesson = content.lessons.find((l) => l.id === decision.lessonId);
      return { label: "오늘 한 장 시작", sub: lesson ? `${lesson.dayNo}장 · ${lesson.title}` : undefined, enabled: true };
    }
    case "doneToday":
    case "dailyLimit":
      return { label: "오늘 끝! 내일 또 만나요", enabled: false };
    case "review":
      return { label: "복습장", sub: "곧 열려요", enabled: false };
    case "packComplete":
      return { label: "ㄱ 팩 완료!", sub: "다음 자음은 준비 중이에요", enabled: false };
  }
}
