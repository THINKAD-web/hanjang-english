import { DEFAULT_PROFILE_ID, type Attempt, type WrongItem } from "@/lib/store/types";
import { addDays, type DateKey } from "./date";

/**
 * 오답 큐 (지시서 6-3 + 기획안 v2). 아이템 id 는 팩 안에서만 고유하므로 항상 (packId, itemId) 로 맞춰본다.
 * - 틀린 아이템: 없으면 추가, 있으면 wrongCount+1. nextReviewDate = 다음 날, active = true (졸업했던 아이템도 다시 활성).
 * - 맞힌 아이템: 큐에 있고 lastWrongDate 가 오늘이 아니면 active = false (다른 날 한 번 맞히면 졸업).
 * - 한 시도에서 같은 아이템을 틀리고 맞히기도 했으면 틀린 쪽이 우선.
 * - 완료되지 않은 시도는 반영하지 않는다 (이탈 후 처음부터 다시 하므로 중복 집계 방지).
 */
export function applyAttempt(queue: readonly WrongItem[], attempt: Attempt): WrongItem[] {
  if (!attempt.completed) return [...queue];
  const today = attempt.dateKey;
  const { packId, profileId } = attempt;
  const wrong = new Set(attempt.answers.filter((a) => !a.correct).map((a) => a.targetItemId));
  const right = new Set(attempt.answers.filter((a) => a.correct && !wrong.has(a.targetItemId)).map((a) => a.targetItemId));

  const next = queue.map((item): WrongItem => {
    if (item.packId !== packId || item.profileId !== profileId) return item;
    if (wrong.has(item.itemId)) {
      return {
        ...item,
        wrongCount: item.wrongCount + 1,
        lastWrongDate: today,
        nextReviewDate: addDays(today, 1),
        active: true,
      };
    }
    if (right.has(item.itemId) && item.active && item.lastWrongDate !== today) {
      return { ...item, active: false };
    }
    return item;
  });

  const known = new Set(queue.filter((i) => i.packId === packId && i.profileId === profileId).map((i) => i.itemId));
  for (const itemId of wrong) {
    if (known.has(itemId)) continue;
    next.push({
      profileId,
      packId,
      itemId,
      wrongCount: 1,
      firstWrongDate: today,
      lastWrongDate: today,
      nextReviewDate: addDays(today, 1),
      active: true,
    });
  }
  return next;
}

/**
 * 부모 "내일 복습에 넣을까요?" 토글. OFF 면 active = false, 다시 ON 이면 active = true.
 * ON 으로 되돌릴 때 `today` 를 넘기면 nextReviewDate 를 다음 날로 둔다 (OFF 였던 동안 지나간 날짜가
 * 남아 있어도 "내일부터 복습" 이 되도록).
 */
export function setReviewEnabled(
  queue: readonly WrongItem[],
  packId: string,
  itemId: string,
  on: boolean,
  today?: DateKey,
): WrongItem[] {
  return queue.map((item) => {
    if (item.packId !== packId || item.itemId !== itemId) return item;
    return on && today ? { ...item, active: true, nextReviewDate: addDays(today, 1) } : { ...item, active: on };
  });
}

/** 오래된 순: nextReviewDate → firstWrongDate → itemId */
function byOldest(a: WrongItem, b: WrongItem): number {
  return (
    a.nextReviewDate.localeCompare(b.nextReviewDate) ||
    a.firstWrongDate.localeCompare(b.firstWrongDate) ||
    a.itemId.localeCompare(b.itemId)
  );
}

/** 이 팩(+ 프로필)의 활성 오답, 오래된 순. */
export function activeItems(queue: readonly WrongItem[], packId: string, profileId: string = DEFAULT_PROFILE_ID): WrongItem[] {
  return queue.filter((i) => i.active && i.packId === packId && i.profileId === profileId).sort(byOldest);
}

/** 오늘 복습할 때가 된 활성 오답 (nextReviewDate ≤ 오늘), 오래된 순. */
export function dueItems(
  queue: readonly WrongItem[],
  dateKey: DateKey,
  packId: string,
  profileId: string = DEFAULT_PROFILE_ID,
): WrongItem[] {
  return activeItems(queue, packId, profileId).filter((i) => i.nextReviewDate <= dateKey);
}
