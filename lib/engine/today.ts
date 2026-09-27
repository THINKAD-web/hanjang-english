import type { Content, Lesson, Sentence } from "@/lib/content/schema";
import { DEFAULT_PROFILE_ID, type State } from "@/lib/store/types";
import { isWeekend, prevWeekday, weekRange, type DateKey } from "./date";
import { activeItems, dueItems } from "./queue";

/**
 * "오늘 무엇을 할까" 판단 (지시서 6-2 + 기획안 v2). 팩별 하루 한도 — packId 는 content.pack.id 에서 얻는다.
 */

export type TodayDecision =
  | { kind: "lesson"; lessonId: string; injectedItemId?: string }
  | { kind: "review"; itemIds: string[] }
  | { kind: "doneToday"; canDoExtra: boolean }
  | { kind: "dailyLimit" }
  | { kind: "packComplete" };

/** 판단 1·2 단계 없이 바로 풀 수 있는 장 (doneToday 의 "한 장 더" 에서 사용). */
export type SheetDecision = Extract<TodayDecision, { kind: "lesson" | "review" | "packComplete" }>;

export const DAILY_LIMIT = 2;
export const WEEKDAY_REVIEW_THRESHOLD = 3;
export const REVIEW_MIN_ITEMS = 5;
export const REVIEW_MAX_ITEMS = 8;

export function completedAttemptsOn(state: State, dateKey: DateKey, packId: string) {
  return state.attempts.filter(
    (a) => a.completed && a.dateKey === dateKey && a.packId === packId && a.profileId === DEFAULT_PROFILE_ID,
  );
}

/** 이 팩에서 완료한 장 id (완료 순서). 장은 달력이 아니라 완료한 순서로 진행한다. */
export function completedLessonIds(state: State, packId: string): string[] {
  const out: string[] = [];
  for (const a of state.attempts) {
    if (
      a.completed &&
      a.kind === "lesson" &&
      a.lessonId &&
      a.packId === packId &&
      a.profileId === DEFAULT_PROFILE_ID &&
      !out.includes(a.lessonId)
    )
      out.push(a.lessonId);
  }
  return out;
}

/** dayNo 순서로 아직 완료하지 않은 첫 장. 중간 이탈(completed: false)한 장도 여기서 다시 나온다. */
export function nextLesson(state: State, content: Content): Lesson | undefined {
  const done = new Set(completedLessonIds(state, content.pack.id));
  return content.lessons.find((l) => !done.has(l.id));
}

/** 이 팩에서 첫 사용일 = 가장 이른 시도 날짜 (완료 여부 무관). */
function firstUseDate(state: State, packId: string): DateKey | undefined {
  let first: DateKey | undefined;
  for (const a of state.attempts) if (a.packId === packId && (!first || a.dateKey < first)) first = a.dateKey;
  return first;
}

/**
 * 밀린 날 따라잡기 허용 여부: 직전 평일에 완료 기록이 없을 때만.
 * 단, 첫 사용일 이전의 평일은 "밀린 날" 로 치지 않는다 (첫날에는 false).
 */
export function canCatchUp(state: State, dateKey: DateKey, packId: string): boolean {
  const first = firstUseDate(state, packId);
  const prev = prevWeekday(dateKey);
  if (!first || prev < first) return false;
  return completedAttemptsOn(state, prev, packId).length === 0;
}

/**
 * 복습장 아이템. 활성 오답(오래된 순)을 우선하고, 5개가 안 되면
 * 이번 주 배운 아이템 → 그 이전에 배운 아이템(최근 순)으로 채운다. 최대 8개.
 * 채울 때 큐에 비활성으로 남은 아이템(부모가 복습 OFF 한 아이템, 졸업한 아이템)은 넣지 않는다.
 */
export function buildReviewItemIds(state: State, dateKey: DateKey, content: Content): string[] {
  const packId = content.pack.id;
  const out = activeItems(state.wrongQueue, packId)
    .map((i) => i.itemId)
    .slice(0, REVIEW_MAX_ITEMS);
  if (out.length >= REVIEW_MIN_ITEMS) return out;

  const inactive = new Set(state.wrongQueue.filter((i) => i.packId === packId && !i.active).map((i) => i.itemId));
  const week = new Set(weekRange(dateKey).filter((d) => d <= dateKey));
  const lessonsById = new Map(content.lessons.map((l) => [l.id, l]));
  const learned = state.attempts.filter(
    (a) => a.completed && a.kind === "lesson" && a.lessonId && a.packId === packId && a.dateKey <= dateKey,
  );
  const thisWeek = learned.filter((a) => week.has(a.dateKey));
  const earlier = learned.filter((a) => !week.has(a.dateKey)).reverse();

  for (const a of [...thisWeek, ...earlier]) {
    for (const id of lessonsById.get(a.lessonId!)?.itemIds ?? []) {
      if (out.length >= REVIEW_MAX_ITEMS) return out;
      if (!out.includes(id) && !inactive.has(id)) out.push(id);
    }
  }
  return out;
}

/** 판단 3~6 단계. */
export function decideSheet(state: State, dateKey: DateKey, content: Content): SheetDecision {
  const packId = content.pack.id;
  const active = activeItems(state.wrongQueue, packId);
  const next = nextLesson(state, content);

  // 3. 주말이면 복습장. 복습할 아이템이 하나도 없으면(아직 배운 게 없음) 다음 장으로.
  // 4. 평일인데 활성 오답이 3개 이상이면 복습장.
  if (isWeekend(dateKey) || active.length >= WEEKDAY_REVIEW_THRESHOLD) {
    const itemIds = buildReviewItemIds(state, dateKey, content);
    if (itemIds.length > 0) return { kind: "review", itemIds };
  }

  // 5. 다음 장. 복습할 때가 된 오답 중 가장 오래된 1개를 5번 문항에 삽입.
  if (next) {
    const due = dueItems(state.wrongQueue, dateKey, packId)[0];
    return due ? { kind: "lesson", lessonId: next.id, injectedItemId: due.itemId } : { kind: "lesson", lessonId: next.id };
  }

  // 6. 8장을 다 끝냈으면 packComplete. 단 활성 오답이 있으면 복습이 먼저.
  if (active.length > 0) return { kind: "review", itemIds: buildReviewItemIds(state, dateKey, content) };
  return { kind: "packComplete" };
}

export function decideToday(state: State, dateKey: DateKey, content: Content): TodayDecision {
  const packId = content.pack.id;
  const done = completedAttemptsOn(state, dateKey, packId).length;
  // 1. 오늘 이 팩에서 2장 이상 완료
  if (done >= DAILY_LIMIT) return { kind: "dailyLimit" };
  // 2. 오늘 1장 완료 — 직전 평일을 밀렸을 때만 한 장 더
  if (done === 1) return { kind: "doneToday", canDoExtra: canCatchUp(state, dateKey, packId) };
  return decideSheet(state, dateKey, content);
}

/** 복습장 예문: 복습 아이템을 가장 많이 포함한 팩 예문 최대 2개 (하나도 안 겹치면 제외). */
export function pickReviewSentences(itemIds: readonly string[], content: Content, max = 2): Sentence[] {
  const set = new Set(itemIds);
  return content.lessons
    .flatMap((l) => l.sentences)
    .map((s, i) => ({ s, i, hits: s.itemIds.filter((id) => set.has(id)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.i - b.i)
    .slice(0, max)
    .map((x) => x.s);
}
