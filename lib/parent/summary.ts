import type { Content } from "@/lib/content/schema";
import { weekRange, type DateKey } from "@/lib/engine/date";
import { weekStamps, type StampCell } from "@/lib/engine/progress";
import { activeItems } from "@/lib/engine/queue";
import { DEFAULT_PROFILE_ID, type Attempt, type State } from "@/lib/store/types";

/**
 * 부모 요약 계산 (기획안 v2 12장). 진도·점수·오답은 Attempt·WrongQueue 에서 매번 읽어서 계산하고
 * 새로 저장하는 값은 없다. 모두 순수 함수.
 */

function completedAttempts(state: State, packId: string): Attempt[] {
  return state.attempts.filter((a) => a.completed && a.packId === packId && a.profileId === DEFAULT_PROFILE_ID);
}

export type AttemptLine = { kind: Attempt["kind"]; total: number; correct: number };

export type WrongWord = {
  itemId: string;
  text: string;
  meaningKo: string;
  /** "내일 복습에 넣기" 토글 상태 = WrongQueue.active */
  reviewOn: boolean;
};

export type TodaySummary = {
  done: boolean;
  attempts: AttemptLine[];
  /** 오늘 틀린 단어 (처음 틀린 순서, 중복 없음). 토글을 꺼서 큐에서 빠진 단어도 남겨서 다시 켤 수 있게 한다. */
  wrong: WrongWord[];
};

/** 점수 문구. 복습장이면 "복습 4문제 중 3개". */
export function attemptLabel(line: AttemptLine): string {
  return line.kind === "review"
    ? `복습 ${line.total}문제 중 ${line.correct}개`
    : `${line.total}문제 중 ${line.correct}개 맞았어요`;
}

export function wrongWordById(state: State, content: Content, itemId: string): WrongWord | null {
  const item = content.itemsById.get(itemId);
  if (!item) return null;
  const entry = state.wrongQueue.find((w) => w.packId === content.pack.id && w.itemId === itemId && w.profileId === DEFAULT_PROFILE_ID);
  return { itemId, text: item.text, meaningKo: item.meaningKo, reviewOn: entry?.active ?? false };
}

export function todaySummary(state: State, content: Content, dateKey: DateKey): TodaySummary {
  const today = completedAttempts(state, content.pack.id).filter((a) => a.dateKey === dateKey);
  const wrongIds: string[] = [];
  for (const a of today) for (const ans of a.answers) if (!ans.correct && !wrongIds.includes(ans.targetItemId)) wrongIds.push(ans.targetItemId);
  return {
    done: today.length > 0,
    attempts: today.map((a) => ({ kind: a.kind, total: a.answers.length, correct: a.answers.filter((x) => x.correct).length })),
    wrong: wrongIds.map((id) => wrongWordById(state, content, id)).filter((w): w is WrongWord => w !== null),
  };
}

/** 현재 활성 오답 (오래된 순). 토글을 끄면 여기서 빠진다. */
export function currentWrong(state: State, content: Content): WrongWord[] {
  return activeItems(state.wrongQueue, content.pack.id)
    .map((w) => wrongWordById(state, content, w.itemId))
    .filter((w): w is WrongWord => w !== null);
}

/**
 * "현재 오답" 목록에 보여줄 id 순서. 방금 토글을 끈 단어는 활성 목록에서 빠지지만, 같은 화면에서
 * 되돌릴 수 있도록 원래 자리에 남겨 둔다 (`pinned` = 이 화면에서 이미 보여준 순서).
 * 새로 활성이 된 id 는 뒤에 붙인다. 화면을 다시 열면 pinned 가 비어 활성 오답만 나온다.
 */
export function listedWrongIds(activeIds: readonly string[], pinned: readonly string[]): string[] {
  return [...pinned, ...activeIds.filter((id) => !pinned.includes(id))];
}

export const MAX_TRICKY_TAGS = 2;

/**
 * 이번 주 가장 많이 틀린 소리: 틀린 답의 아이템 tags 를 세어 많은 순 상위 MAX_TRICKY_TAGS 개.
 * 같은 개수면 태그 문자열 오름차순 — 새로고침해도 결과가 흔들리지 않는다.
 */
export function trickyTags(state: State, content: Content, dateKey: DateKey): string[] {
  const week = new Set(weekRange(dateKey));
  const counts = new Map<string, number>();
  for (const a of completedAttempts(state, content.pack.id)) {
    if (!week.has(a.dateKey)) continue;
    for (const ans of a.answers) {
      if (ans.correct) continue;
      for (const tag of content.itemsById.get(ans.targetItemId)?.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
    .slice(0, MAX_TRICKY_TAGS)
    .map(([tag]) => tag);
}

export type WeekSummary = { stamps: StampCell[]; doneCount: number; trickySounds: string[] };

export function weekSummary(state: State, content: Content, dateKey: DateKey): WeekSummary {
  const week = new Set(weekRange(dateKey));
  return {
    // 홈의 도장 칸과 같은 함수 — 계산을 복사하지 않는다.
    stamps: weekStamps(state, dateKey, content.pack.id),
    doneCount: completedAttempts(state, content.pack.id).filter((a) => week.has(a.dateKey)).length,
    trickySounds: trickyTags(state, content, dateKey),
  };
}
