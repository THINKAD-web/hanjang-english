import type { Attempt, WrongItem } from "@/lib/store/types";
import { addDays, type DateKey } from "./date";

/**
 * 오답 큐 (지시서 6-3).
 * - 틀린 단어: 없으면 추가, 있으면 wrongCount+1. nextReviewDate = 다음 날, active = true (졸업했던 단어도 다시 활성).
 * - 맞힌 단어: 큐에 있고 lastWrongDate 가 오늘이 아니면 active = false (다른 날 한 번 맞히면 졸업).
 * - 한 시도에서 같은 단어를 틀리고 맞히기도 했으면 틀린 쪽이 우선.
 * - 완료되지 않은 시도는 반영하지 않는다 (이탈 후 처음부터 다시 하므로 중복 집계 방지).
 */
export function applyAttempt(queue: readonly WrongItem[], attempt: Attempt): WrongItem[] {
  if (!attempt.completed) return [...queue];
  const today = attempt.dateKey;
  const wrong = new Set(attempt.answers.filter((a) => !a.correct).map((a) => a.targetWordId));
  const right = new Set(attempt.answers.filter((a) => a.correct && !wrong.has(a.targetWordId)).map((a) => a.targetWordId));

  const next = queue.map((item): WrongItem => {
    if (wrong.has(item.wordId)) {
      return {
        ...item,
        wrongCount: item.wrongCount + 1,
        lastWrongDate: today,
        nextReviewDate: addDays(today, 1),
        active: true,
      };
    }
    if (right.has(item.wordId) && item.active && item.lastWrongDate !== today) {
      return { ...item, active: false };
    }
    return item;
  });

  const known = new Set(queue.map((i) => i.wordId));
  for (const wordId of wrong) {
    if (known.has(wordId)) continue;
    next.push({
      wordId,
      wrongCount: 1,
      firstWrongDate: today,
      lastWrongDate: today,
      nextReviewDate: addDays(today, 1),
      active: true,
    });
  }
  return next;
}

/** 부모 "내일 복습에 넣을까요?" 토글. OFF 면 active = false, 다시 ON 이면 active = true. */
export function setReviewEnabled(queue: readonly WrongItem[], wordId: string, on: boolean): WrongItem[] {
  return queue.map((item) => (item.wordId === wordId ? { ...item, active: on } : item));
}

/** 오래된 순: nextReviewDate → firstWrongDate → wordId */
function byOldest(a: WrongItem, b: WrongItem): number {
  return (
    a.nextReviewDate.localeCompare(b.nextReviewDate) ||
    a.firstWrongDate.localeCompare(b.firstWrongDate) ||
    a.wordId.localeCompare(b.wordId)
  );
}

export function activeItems(queue: readonly WrongItem[]): WrongItem[] {
  return queue.filter((i) => i.active).sort(byOldest);
}

/** 오늘 복습할 때가 된 활성 오답 (nextReviewDate ≤ 오늘), 오래된 순. */
export function dueItems(queue: readonly WrongItem[], dateKey: DateKey): WrongItem[] {
  return activeItems(queue).filter((i) => i.nextReviewDate <= dateKey);
}
