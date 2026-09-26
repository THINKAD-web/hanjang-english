import { z } from "zod";

/**
 * 진행 상태 (지시서 6-1). MVP 는 기기 localStorage 에만 저장한다.
 * 나중에 Prisma+Neon 으로 옮길 때 ProgressStore 구현체만 바꾼다.
 */

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const AnswerSchema = z.object({ targetWordId: z.string(), correct: z.boolean() });
export type AnswerRecord = z.infer<typeof AnswerSchema>;

export const AttemptSchema = z.object({
  id: z.string(),
  dateKey,
  kind: z.enum(["lesson", "review"]),
  lessonId: z.string().optional(),
  wordIds: z.array(z.string()),
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
  wordId: z.string(),
  wrongCount: z.number().int().min(1),
  firstWrongDate: dateKey,
  lastWrongDate: dateKey,
  nextReviewDate: dateKey,
  active: z.boolean(),
});
export type WrongItem = z.infer<typeof WrongItemSchema>;

export const EVENT_TYPES = ["sheet_start", "sheet_complete", "parent_view", "next_pack_request"] as const;
export const EventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  dateKey,
  /** ISO 시각 */
  at: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type AppEvent = z.infer<typeof EventSchema>;

export const STATE_SCHEMA_VERSION = 1;

export const StateSchema = z.object({
  schemaVersion: z.literal(STATE_SCHEMA_VERSION),
  childGrade: z.union([z.literal(3), z.literal(4)]),
  /** 부모 PIN 의 SHA-256 hex. null 이면 아직 설정 전 (첫 실행 온보딩 대상). */
  parentPinHash: z.string().nullable(),
  attempts: z.array(AttemptSchema),
  wrongQueue: z.array(WrongItemSchema),
  events: z.array(EventSchema),
});
export type State = z.infer<typeof StateSchema>;

export function createInitialState(): State {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    childGrade: 3,
    parentPinHash: null,
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
