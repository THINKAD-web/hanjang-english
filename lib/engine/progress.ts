import type { Content } from "@/lib/content/schema";
import type { AnswerRecord, Attempt, State, Track } from "@/lib/store/types";
import { weekRange, type DateKey } from "./date";
import { applyAttempt } from "./queue";
import { completedLessonIds, type TodayDecision } from "./today";
import { unitLabelOf } from "@/lib/content/pack-text";

/**
 * 진행 기록 갱신과 홈 화면용 파생 값. 모두 순수 함수 (저장은 호출하는 쪽에서).
 *
 * Attempt 는 "완료했을 때만" 만든다 (PR3 지시서 4장). "시작" 시점엔 sheet_start 이벤트만 남기고
 * 미완료 시도를 별도로 저장하지 않는다 — 그래서 닫기(중단)해도 지울 Attempt 자체가 없다.
 */

export type SheetStartInput = { packId: string; subjectId?: string; lessonId?: string; dateKey: DateKey; at: string };

/**
 * 이 프로필이 이 팩을 처음 시작하면 Track 을 만들고, 마지막으로 연 팩(activePackId)을 갱신한다.
 * 팩을 고르는 화면이 따로 필요 없다 — 시작하는 순간 등록된다.
 */
export function ensureTrack(state: State, packId: string, subjectId?: string): State {
  const has = state.tracks.some((t) => t.profileId === state.activeProfileId && t.packId === packId);
  const track: Track = { profileId: state.activeProfileId, packId, ...(subjectId ? { subjectId } : {}), status: "active" };
  return { ...state, activePackId: packId, tracks: has ? state.tracks : [...state.tracks, track] };
}

/** "시작" 탭: sheet_start 이벤트만 남긴다. Attempt 는 완료 시 recordSheetComplete 가 만든다. */
export function recordSheetStart(base: State, input: SheetStartInput): State {
  const state = ensureTrack(base, input.packId, input.subjectId);
  return {
    ...state,
    events: [
      ...state.events,
      {
        profileId: state.activeProfileId,
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
  subjectId?: string;
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
export function recordSheetComplete(base: State, input: SheetCompleteInput): State {
  const state = ensureTrack(base, input.packId, input.subjectId);
  const score = input.answers.filter((a) => a.correct).length;
  const attempt: Attempt = {
    id: input.attemptId,
    profileId: state.activeProfileId,
    packId: input.packId,
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
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
        profileId: state.activeProfileId,
        type: "sheet_complete",
        dateKey: input.dateKey,
        at: input.finishedAt,
        payload: { attemptId: input.attemptId, packId: input.packId, lessonId: input.lessonId ?? null, score, total: input.answers.length },
      },
    ],
  };
}

export type SheetStep = "sound" | "cards" | "listen" | "sentences" | "practice" | "patterns" | "quiz";

/** 단계별 소요 시간(ms). 거치지 않은 단계는 키가 없다 (예전 장은 sound·cards·listen·sentences·quiz 다섯 개). */
export type StepTimings = Partial<Record<SheetStep, number>>;

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
        profileId: state.activeProfileId,
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
  input: { packId: string; lessonId?: string; dateKey: DateKey; at: string; timings: StepTimings },
): State {
  return {
    ...state,
    events: [
      ...state.events,
      {
        profileId: state.activeProfileId,
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
      { profileId: state.activeProfileId, type: "pack_interest", dateKey: input.dateKey, at: input.at, payload: input.payload },
    ],
  };
}

/** 팩 완료 화면에서 "다음 팩 열어달라고 부모님께 말하기" 클릭 신호. */
export function recordNextPackRequest(state: State, input: { dateKey: DateKey; at: string; payload: Record<string, unknown> }): State {
  return {
    ...state,
    events: [
      ...state.events,
      { profileId: state.activeProfileId, type: "next_pack_request", dateKey: input.dateKey, at: input.at, payload: input.payload },
    ],
  };
}

/** 부모 요약(/parent)이 열렸다는 신호. 가족 테스트 지표(부모 요약 주 3회 열람)를 재는 데 쓴다. */
export function recordParentView(state: State, input: { dateKey: DateKey; at: string; payload: Record<string, unknown> }): State {
  return {
    ...state,
    events: [
      ...state.events,
      { profileId: state.activeProfileId, type: "parent_view", dateKey: input.dateKey, at: input.at, payload: input.payload },
    ],
  };
}

export type StampCell = { dateKey: DateKey; label: string; stamped: boolean; isToday: boolean; isFuture: boolean };

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/**
 * 이번 주 도장 7칸 (월~일). 그날 완료한 장(복습장 포함)이 하나라도 있으면 도장.
 * packId 를 주면 그 팩만, 생략하면 이 프로필의 모든 팩을 합친다 (도장은 "오늘 공부했다" 는 표시라 팩이 달라도 하나).
 */
export function weekStamps(state: State, dateKey: DateKey, packId?: string): StampCell[] {
  const done = new Set(
    state.attempts
      .filter(
        (a) =>
          a.completed &&
          a.kind === "lesson" &&
          a.profileId === state.activeProfileId &&
          (packId === undefined || a.packId === packId),
      )
      .map((a) => a.dateKey),
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
      return { label: "오늘 한 장 시작", sub: lesson ? `${lesson.order}장 · ${lesson.title}` : undefined, enabled: true };
    }
    case "review":
      return { label: "오늘은 복습장", enabled: true };
    case "doneToday":
      return { label: "오늘 장 끝! 잘했어요", enabled: false };
    case "dailyLimit":
      return { label: "내일 또 만나요", enabled: false };
    case "packComplete":
      return { label: `${unitLabelOf(content.pack)} 팩 완료!`, enabled: true };
  }
}
