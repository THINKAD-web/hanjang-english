import { z } from "zod";

/**
 * 진행 상태 (기획안 v2 13장 데이터 모델). MVP 는 기기 localStorage 에만 저장한다.
 * Account 1 · Profile 1(child) · Track 1 로 시작하지만, 구조는 나중에 Prisma 로 옮길 때
 * 키 이름만 바꾸면 되도록 이 모델 그대로 둔다.
 */

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** 처음 만들어지는 프로필의 id. 이후에는 `state.activeProfileId` 가 지금 쓰는 프로필을 가리킨다. */
export const DEFAULT_PROFILE_ID = "child";

export const ProfileSchema = z.object({
  id: z.string(),
  type: z.enum(["child", "self"]),
  name: z.string().optional(),
  grade: z.union([z.literal(3), z.literal(4)]).optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const TrackSchema = z.object({
  profileId: z.string(),
  packId: z.string(),
  /** 과목 (없으면 옛 기록 — 팩에서 알아낸다) */
  subjectId: z.string().optional(),
  status: z.enum(["active"]),
});
export type Track = z.infer<typeof TrackSchema>;

export const AnswerSchema = z.object({ targetItemId: z.string(), correct: z.boolean() });
export type AnswerRecord = z.infer<typeof AnswerSchema>;

export const AttemptSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  packId: z.string(),
  /** 과목 (옛 기록은 마이그레이션이 채운다. 없어도 읽을 수 있다) */
  subjectId: z.string().optional(),
  dateKey,
  kind: z.enum(["lesson", "review"]),
  lessonId: z.string().optional(),
  itemIds: z.array(z.string()),
  answers: z.array(AnswerSchema),
  /** 맞은 문항 수 */
  score: z.number().int().min(0),
  /** ISO 시각 */
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  completed: z.boolean(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const WrongItemSchema = z.object({
  profileId: z.string(),
  packId: z.string(),
  itemId: z.string(),
  wrongCount: z.number().int().min(1),
  firstWrongDate: dateKey,
  lastWrongDate: dateKey,
  nextReviewDate: dateKey,
  active: z.boolean(),
});
export type WrongItem = z.infer<typeof WrongItemSchema>;

export const EVENT_TYPES = [
  "sheet_start",
  "sheet_complete",
  "sheet_abort",
  "step_time",
  "parent_view",
  "next_pack_request",
  "pack_interest",
] as const;
export const EventSchema = z.object({
  profileId: z.string(),
  type: z.enum(EVENT_TYPES),
  dateKey,
  /** ISO 시각 */
  at: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type AppEvent = z.infer<typeof EventSchema>;

/** 저장 형식 버전. 옛 형식(`schemaVersion: 2`)은 lib/store/migrate.ts 가 읽어서 올린다. */
export const STATE_VERSION = 2;

export const StateSchema = z.object({
  stateVersion: z.literal(STATE_VERSION),
  account: z.object({ pinHash: z.string().nullable() }),
  profiles: z.array(ProfileSchema),
  /** 지금 쓰는 프로필 (한 기기에서 아이/어른 전환) */
  activeProfileId: z.string(),
  /** 마지막으로 연 팩 (홈이 어느 팩을 먼저 보여줄지) */
  activePackId: z.string().nullable(),
  tracks: z.array(TrackSchema),
  attempts: z.array(AttemptSchema),
  wrongQueue: z.array(WrongItemSchema),
  events: z.array(EventSchema),
});
export type State = z.infer<typeof StateSchema>;

export function createInitialState(defaultPackId: string): State {
  return {
    stateVersion: STATE_VERSION,
    account: { pinHash: null },
    profiles: [{ id: DEFAULT_PROFILE_ID, type: "child", grade: 3 }],
    activeProfileId: DEFAULT_PROFILE_ID,
    activePackId: defaultPackId,
    tracks: [{ profileId: DEFAULT_PROFILE_ID, packId: defaultPackId, status: "active" }],
    attempts: [],
    wrongQueue: [],
    events: [],
  };
}

export interface ProgressStore {
  load(): Promise<State>;
  save(state: State): Promise<void>;
  /** load → fn → save 를 한 번에. 저장된 새 상태를 돌려준다. */
  update(fn: (state: State) => State): Promise<State>;
  /** 전체 초기화 */
  reset(): Promise<void>;
  /** "사용 기록 내보내기" 용 JSON 문자열 */
  exportJson(): Promise<string>;
}
