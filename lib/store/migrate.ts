import { z } from "zod";
import {
  AttemptSchema,
  EventSchema,
  ProfileSchema,
  StateSchema,
  STATE_VERSION,
  TrackSchema,
  WrongItemSchema,
  DEFAULT_PROFILE_ID,
  type State,
} from "./types";

/**
 * 저장된 진행 상태를 현재 형식으로 올린다. 기록(Attempt · 오답 큐 · 이벤트 · 계정)은 한 글자도 바꾸지 않고
 * 새 필드만 보탠다 — 도장·진도·오답이 마이그레이션 전후로 똑같이 계산되는 것이 이 모듈의 계약이다.
 *
 * 옛 형식: `schemaVersion: 2` (프로필 하나, 팩 하나를 전제로 한 모양). 새 형식: `stateVersion: 2`.
 */

const LegacyStateSchema = z.object({
  schemaVersion: z.literal(2),
  account: z.object({ pinHash: z.string().nullable() }),
  profiles: z.array(ProfileSchema),
  tracks: z.array(TrackSchema),
  attempts: z.array(AttemptSchema),
  wrongQueue: z.array(WrongItemSchema),
  events: z.array(EventSchema),
});

/** 옛 기록에는 과목이 없었다. 그 시절 존재한 팩은 이것뿐이다. */
const LEGACY_PACK_SUBJECT: Record<string, string> = { "en-kid-giyeok": "en-kid" };

export type MigrationResult = { state: State; migrated: boolean };

/** 알아볼 수 없는 값이면 null (호출한 쪽이 원본을 백업한 뒤 초기 상태로 시작한다). */
export function migrateState(value: unknown): MigrationResult | null {
  const current = StateSchema.safeParse(value);
  if (current.success) return { state: current.data, migrated: false };

  const legacy = LegacyStateSchema.safeParse(value);
  if (!legacy.success) return null;
  const l = legacy.data;

  const activeProfileId = l.profiles.find((p) => p.id === DEFAULT_PROFILE_ID)?.id ?? l.profiles[0]?.id ?? DEFAULT_PROFILE_ID;
  const activeTrack = l.tracks.find((t) => t.profileId === activeProfileId);
  const withSubject = <T extends { packId: string; subjectId?: string }>(x: T): T => {
    const subjectId = x.subjectId ?? LEGACY_PACK_SUBJECT[x.packId];
    return subjectId ? { ...x, subjectId } : x;
  };

  return {
    migrated: true,
    state: {
      stateVersion: STATE_VERSION,
      account: l.account,
      profiles: l.profiles.length > 0 ? l.profiles : [{ id: DEFAULT_PROFILE_ID, type: "child", grade: 3 }],
      activeProfileId,
      activePackId: activeTrack?.packId ?? null,
      tracks: l.tracks.map(withSubject),
      attempts: l.attempts.map(withSubject),
      wrongQueue: l.wrongQueue,
      events: l.events,
    },
  };
}
