import type { Content } from "@/lib/content/schema";
import { DEFAULT_PROFILE_ID, type AnswerRecord, type Attempt, type State } from "@/lib/store/types";
import { weekRange, type DateKey } from "./date";
import { applyAttempt } from "./queue";
import { completedLessonIds, type TodayDecision } from "./today";

/**
 * 진행 기록 갱신과 홈 화면용 파생 값. 모두 순수 함수 (저장은 호출하는 쪽에서).
 *
 * Attempt 는 "완료했을 때만" 만든다 (PR3 지시서 4장). "시작" 시점엔 sheet_start 이벤트만 남기고
 * 미완료 시도를 별도로 저장하지 않는다 — 그래서 닫기(중단)해도 지울 Attempt 자체가 없다.
 */

export type SheetStartInput = { packId: string; lessonId?: string; dateKey: DateKey; at: string };

/** "시작" 탭: sheet_start 이벤트만 남긴다. Attempt 는 완료 시 recordSheetComplete 가 만든다. */
export function recordSheetStart(state: State, input: SheetStartInput): State {
  return {
    ...state,
    events: [
      ...state.events,
      {
        profileId: DEFAULT_PROFILE_ID,
        type: "sheet_start",
        dateKey: input.dateKey,
        at: input.at,
        payload: { packId: input.packId, lessonId: input.lessonId ?? null },
      },
    ],
  };
}

export type SheetCompleteInput = {
  attemptId: string;
  packId: string;
  dateKey: DateKey;
  kind: Attempt["kind"];
  lessonId?: string;
  itemIds: string[];
  answers: AnswerRecord[];
  /** ISO 시각 */
  startedAt: string;
  /** ISO 시각 */
  finishedAt: string;
};

/** 퀴즈까지 끝냄: 완료된 Attempt 를 만들고 오답 큐에 반영, sheet_complete 이벤트를 남긴다. */
export function recordSheetComplete(state: State, input: SheetCompleteInput): State {
  const score = input.answers.filter((a) => a.correct).length;
  const attempt: Attempt = {
    id: input.attemptId,
    profileId: DEFAULT_PROFILE_ID,
    packId: input.packId,
    dateKey: input.dateKey,
    kind: input.kind,
    ...(input.lessonId ? { lessonId: input.lessonId } : {}),
    itemIds: input.itemIds,
    answers: input.answers,
    score,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    completed: true,
  };
  return {
    ...state,
    attempts: [...state.attempts, attempt],
    wrongQueue: applyAttempt(state.wrongQueue, attempt),
    events: [
      ...state.events,
      {
        profileId: DEFAULT_PROFILE_ID,
        type: "sheet_complete",
        dateKey: input.dateKey,
        at: input.finishedAt,
        payload: { attemptId: input.attemptId, packId: input.packId, lessonId: input.lessonId ?? null, score, total: input.answers.length },
      },
    ],
  };
}

export type SheetStep = "sound" | "cards" | "listen" | "sentences" | "quiz";

/** 닫기(중단) 확인: Attempt 는 만들지 않고 sheet_abort 이벤트만 남긴다. */
export function recordSheetAbort(
  state: State,
  input: { packId: string; lessonId?: string; dateKey: DateKey; at: string; step: SheetStep; elapsedMs: number },
): State {
  return {
    ...state,
    events: [
      ...state.events,
      {
        profileId: DEFAULT_PROFILE_ID,
        type: "sheet_abort",
        dateKey: input.dateKey,
        at: input.at,
        payload: { packId: input.packId, lessonId: input.lessonId ?? null, step: input.step, elapsedMs: input.elapsedMs },
      },
    ],
  };
}

/** 완료 시 단계별 소요 시간(ms) 기록 — 화면엔 보여주지 않고 데이터만 쌓는다 (8분 초과 여부 실측용). */
export function recordStepTime(
  state: State,
  input: { packId: string; lessonId?: string; dateKey: DateKey; at: string; timings: Record<SheetStep, number> },
): State {
  return {
    ...state,
    events: [
      ...state.events,
      {
        profileId: DEFAULT_PROFILE_ID,
        type: "step_time",
        dateKey: input.dateKey,
        at: input.at,
        payload: { packId: input.packId, lessonId: input.lessonId ?? null, ...input.timings },
      },
    ],
  };
}

/** 잠긴 팩·다음 단위를 눌러봤다는 신호. 2호 팩 순서를 정하는 근거로 쓴다. */
export function recordPackInterest(state: State, input: { dateKey: DateKey; at: string; payload: Record<string, unknown> }): State {
  return {
    ...state,
    events: [
      ...state.events,
      { profileId: DEFAULT_PROFILE_ID, type: "pack_interest", dateKey: input.dateKey, at: input.at, payload: input.payload },
    ],
  };
}

/** 팩 완료 화면에서 "다음 팩 열어달라고 부모님께 말하기" 클릭 신호. */
export function recordNextPackRequest(state: State, input: { dateKey: DateKey; at: string; payload: Record<string, unknown> }): State {
  return {
    ...state,
    events: [
      ...state.events,
      { profileId: DEFAULT_PROFILE_ID, type: "next_pack_request", dateKey: input.dateKey, at: input.at, payload: input.payload },
    ],
  };
}

export type StampCell = { dateKey: DateKey; label: string; stamped: boolean; isToday: boolean; isFuture: boolean };

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/** 이번 주 도장 7칸 (월~일). 그 팩에서 그날 완료한 장(복습장 포함)이 하나라도 있으면 도장. */
export function weekStamps(state: State, dateKey: DateKey, packId: string): StampCell[] {
  const done = new Set(
    state.attempts.filter((a) => a.completed && a.packId === packId && a.profileId === DEFAULT_PROFILE_ID).map((a) => a.dateKey),
  );
  return weekRange(dateKey).map((d, i) => ({
    dateKey: d,
    label: DAY_LABELS[i],
    stamped: done.has(d),
    isToday: d === dateKey,
    isFuture: d > dateKey,
  }));
}

/** "ㄱ · 3/8장" 용: 이 팩에서 완료한 장 수. 진행도·도장은 저장하지 않고 매번 Attempt 에서 계산한다 (기획안 13장). */
export function packProgress(state: State, content: Content): { done: number; total: number } {
  const ids = new Set(content.lessons.map((l) => l.id));
  return { done: completedLessonIds(state, content.pack.id).filter((id) => ids.has(id)).length, total: content.lessons.length };
}

export type HomeCta = { label: string; sub?: string; enabled: boolean };

/** 홈의 큰 버튼 문구 (기획안 v2 7장, PR4 지시서 6장). */
export function homeCta(decision: TodayDecision, content: Content): HomeCta {
  switch (decision.kind) {
    case "lesson": {
      const lesson = content.lessons.find((l) => l.id === decision.lessonId);
      return { label: "오늘 한 장 시작", sub: lesson ? `${lesson.dayNo}장 · ${lesson.title}` : undefined, enabled: true };
    }
    case "review":
      return { label: "오늘은 복습장", enabled: true };
    case "doneToday":
      return { label: "오늘 장 끝! 잘했어요", enabled: false };
    case "dailyLimit":
      return { label: "내일 또 만나요", enabled: false };
    case "packComplete":
      return { label: `${content.pack.unitLabel} 팩 완료!`, enabled: true };
  }
}
