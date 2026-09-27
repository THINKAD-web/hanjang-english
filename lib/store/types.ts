import { z } from "zod";

/**
 * 진행 상태 (기획안 v2 13장 데이터 모델). MVP 는 기기 localStorage 에만 저장한다.
 * Account 1 · Profile 1(child) · Track 1 로 시작하지만, 구조는 나중에 Prisma 로 옮길 때
 * 키 이름만 바꾸면 되도록 이 모델 그대로 둔다.
 */

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** MVP 는 프로필이 하나뿐이라 이 id 를 고정으로 쓴다. */
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
  status: z.enum(["active"]),
});
export type Track = z.infer<typeof TrackSchema>;

export const AnswerSchema = z.object({ targetItemId: z.string(), correct: z.boolean() });
export type AnswerRecord = z.infer<typeof AnswerSchema>;

export const AttemptSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  packId: z.string(),
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

export const STATE_SCHEMA_VERSION = 2;

export const StateSchema = z.object({
  schemaVersion: z.literal(STATE_SCHEMA_VERSION),
  account: z.object({ pinHash: z.string().nullable() }),
  profiles: z.array(ProfileSchema),
  tracks: z.array(TrackSchema),
  attempts: z.array(AttemptSchema),
  wrongQueue: z.array(WrongItemSchema),
  events: z.array(EventSchema),
});
export type State = z.infer<typeof StateSchema>;

export function createInitialState(defaultPackId: string): State {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    account: { pinHash: null },
    profiles: [{ id: DEFAULT_PROFILE_ID, type: "child", grade: 3 }],
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
