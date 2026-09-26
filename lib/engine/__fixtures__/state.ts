import { loadContent } from "@/lib/content/load";
import { createInitialState, type Attempt, type State } from "@/lib/store/types";
import { applyAttempt } from "../queue";

export const content = loadContent();

/** 2026-09-21 이 월요일인 주를 기준으로 쓴다. */
export const MON = "2026-09-21";
export const TUE = "2026-09-22";
export const WED = "2026-09-23";
export const THU = "2026-09-24";
export const FRI = "2026-09-25";
export const SAT = "2026-09-26";
export const SUN = "2026-09-27";
export const NEXT_MON = "2026-09-28";

let seq = 0;

type Finish = {
  /** 틀린 대상 단어 */
  wrong?: string[];
  /** 추가로 맞힌 대상 단어 (기본: 장의 퀴즈 대상 중 틀리지 않은 것) */
  right?: string[];
  completed?: boolean;
};

function record(state: State, attempt: Attempt): State {
  return {
    ...state,
    attempts: [...state.attempts, attempt],
    wrongQueue: applyAttempt(state.wrongQueue, attempt),
  };
}

/** 장 하나를 풀고 상태에 반영한다. */
export function doLesson(state: State, lessonId: string, dateKey: string, { wrong = [], right, completed = true }: Finish = {}): State {
  const lesson = content.lessons.find((l) => l.id === lessonId)!;
  const targets = right ?? lesson.quiz.map((q) => q.targetWordId).filter((id) => !wrong.includes(id));
  const answers = [
    ...targets.map((targetWordId) => ({ targetWordId, correct: true })),
    ...wrong.map((targetWordId) => ({ targetWordId, correct: false })),
  ];
  return record(state, {
    id: `a${++seq}`,
    dateKey,
    kind: "lesson",
    lessonId,
    wordIds: lesson.wordIds,
    answers,
    score: answers.filter((a) => a.correct).length,
    startedAt: `${dateKey}T00:00:00.000Z`,
    finishedAt: completed ? `${dateKey}T00:08:00.000Z` : undefined,
    completed,
  });
}

export function doReview(state: State, dateKey: string, answers: { targetWordId: string; correct: boolean }[]): State {
  return record(state, {
    id: `a${++seq}`,
    dateKey,
    kind: "review",
    wordIds: answers.map((a) => a.targetWordId),
    answers,
    score: answers.filter((a) => a.correct).length,
    startedAt: `${dateKey}T00:00:00.000Z`,
    finishedAt: `${dateKey}T00:08:00.000Z`,
    completed: true,
  });
}

export function freshState(): State {
  return createInitialState();
}

export const lessonId = (dayNo: number) => `giyeok-${String(dayNo).padStart(2, "0")}`;
