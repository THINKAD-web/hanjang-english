import { addDays, weekRange, type DateKey } from "./date";
import type { State } from "@/lib/store/types";
import { completedLessonIds } from "./today";

/** 완료 Attempt 가 있는 날짜 (프로필 기준, 팩 무관). */
export function studyDays(state: State, profileId: string = state.activeProfileId): Set<DateKey> {
  return new Set(
    state.attempts.filter((a) => a.completed && a.kind === "lesson" && a.profileId === profileId).map((a) => a.dateKey),
  );
}

/**
 * 연속 학습 일수. asOf 기준: 오늘 학습했으면 오늘부터, 아니면 어제부터 거꾸로 센다.
 * 저장하지 않고 Attempt 에서만 계산한다.
 */
export function learningStreak(state: State, asOf: DateKey, profileId: string = state.activeProfileId): number {
  const days = studyDays(state, profileId);
  let cursor = days.has(asOf) ? asOf : addDays(asOf, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** 팩별 마지막 학습일 (완료 Attempt 기준). */
export function lastStudyDate(state: State, packId: string, profileId: string = state.activeProfileId): DateKey | null {
  const keys = state.attempts
    .filter((a) => a.completed && a.packId === packId && a.profileId === profileId)
    .map((a) => a.dateKey)
    .sort();
  return keys.at(-1) ?? null;
}

/** step_time 이벤트 payload 의 ms 합 → 분 (올림 없이 반올림). */
export function studyMinutesFromEvents(
  state: State,
  dateKey: DateKey,
  packId?: string,
  profileId: string = state.activeProfileId,
): number {
  let ms = 0;
  for (const e of state.events) {
    if (e.type !== "step_time" || e.profileId !== profileId || e.dateKey !== dateKey) continue;
    const p = e.payload ?? {};
    if (packId && p.packId !== packId && p.packId != null) continue;
    for (const [k, v] of Object.entries(p)) {
      if (k === "packId" || k === "lessonId") continue;
      if (typeof v === "number" && v > 0) ms += v;
    }
  }
  return Math.max(0, Math.round(ms / 60_000));
}

export type BadgeId = "first_lesson" | "streak_3" | "perfect_lesson" | "week_5";

export const BADGE_LABEL: Record<BadgeId, string> = {
  first_lesson: "첫 장 완료",
  streak_3: "3일 연속",
  perfect_lesson: "오답 0개",
  week_5: "주간 5장",
};

/** 로컬 배지 — State 에 저장하지 않고 매번 계산한다. */
export function earnedBadges(state: State, dateKey: DateKey, packId: string): BadgeId[] {
  const pid = state.activeProfileId;
  const mine = state.attempts.filter((a) => a.completed && a.profileId === pid);
  const out: BadgeId[] = [];
  if (completedLessonIds(state, packId).length > 0) out.push("first_lesson");
  if (learningStreak(state, dateKey, pid) >= 3) out.push("streak_3");
  if (mine.some((a) => a.packId === packId && a.answers.length > 0 && a.answers.every((x) => x.correct))) out.push("perfect_lesson");
  const week = new Set(weekRange(dateKey));
  const weekDone = mine.filter((a) => a.packId === packId && a.kind === "lesson" && week.has(a.dateKey)).length;
  if (weekDone >= 5) out.push("week_5");
  return out;
}

/** 오답을 tagLabel(또는 tags) 기준으로 묶는다. */
export function groupWrongByTag<T extends { tags?: string[] }>(words: readonly T[], fallbackTag: string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const w of words) {
    const tag = w.tags?.[0] ?? fallbackTag;
    const list = map.get(tag) ?? [];
    list.push(w);
    map.set(tag, list);
  }
  return map;
}
