import type { Manifest, ManifestPack } from "@/lib/content/bundle";
import { DEFAULT_PACK_ID } from "@/lib/content/defaults";
import type { Audience, Subject } from "@/lib/content/schema";
import { completedLessonIds } from "@/lib/engine/today";
import type { Profile, State } from "@/lib/store/types";

/**
 * 팩 목록·진행·잠금 계산 (순수 함수). /packs 와 홈의 "내 팩" 이 같은 함수를 쓴다.
 * 입력 manifest 는 이미 공개 게이트(visibility)를 거친 것이다 — 여기서 다시 판단하지 않는다.
 */

/** 아이 프로필은 어린이 과목, 본인 프로필은 성인 과목을 먼저 보여준다. */
export const audienceOf = (profile: Pick<Profile, "type">): Audience => (profile.type === "child" ? "kid" : "adult");

export function activeProfile(state: State): Profile {
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
}

export function subjectsOf(manifest: Manifest, audience: Audience): Subject[] {
  const withPacks = new Set(manifest.packs.map((p) => p.subjectId));
  return manifest.subjects.filter((s) => s.audience === audience && withPacks.has(s.id)).sort((a, b) => a.order - b.order);
}

export type LevelChip = { level: string; levelOrder: number };

/** 한 과목의 레벨 칩 (levelOrder 오름차순, 같은 레벨은 하나). */
export function levelsOf(manifest: Manifest, subjectId: string): LevelChip[] {
  const seen = new Map<number, LevelChip>();
  for (const p of manifest.packs) if (p.subjectId === subjectId && !seen.has(p.levelOrder)) seen.set(p.levelOrder, { level: p.level, levelOrder: p.levelOrder });
  return [...seen.values()].sort((a, b) => a.levelOrder - b.levelOrder);
}

export function packsOf(manifest: Manifest, subjectId: string, levelOrder: number): ManifestPack[] {
  return manifest.packs.filter((p) => p.subjectId === subjectId && p.levelOrder === levelOrder).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function packProgressOf(state: State, pack: Pick<ManifestPack, "id" | "lessons">): { done: number; total: number } {
  const ids = new Set(pack.lessons.map((l) => l.id));
  return { done: completedLessonIds(state, pack.id).filter((id) => ids.has(id)).length, total: pack.lessons.length };
}

export function isPackComplete(state: State, pack: Pick<ManifestPack, "id" | "lessons">): boolean {
  const { done, total } = packProgressOf(state, pack);
  return total > 0 && done >= total;
}

/** 앞 팩(pack.unlock.afterPackId)을 끝내야 열린다. 앞 팩이 목록에 없으면(비공개 등) 열리지 않는다. */
export function isUnlocked(state: State, pack: Pick<ManifestPack, "unlock">, manifest: Manifest): boolean {
  if (!pack.unlock) return true;
  const before = manifest.packs.find((p) => p.id === pack.unlock!.afterPackId);
  return before ? isPackComplete(state, before) : false;
}

/** 이 프로필이 시작해서 아직 안 끝낸 live 팩, 최근에 한 순서. 시작 전(기록 없는) 트랙은 뒤로. */
export function inProgressPacks(state: State, manifest: Manifest, max = 3): ManifestPack[] {
  const live = new Map(manifest.packs.filter((p) => p.status === "live" && p.lessons.length > 0).map((p) => [p.id, p]));
  const last = new Map<string, string>();
  for (const a of state.attempts) {
    if (a.profileId !== state.activeProfileId || !a.completed) continue;
    const at = a.finishedAt ?? a.startedAt;
    if (!last.has(a.packId) || at > last.get(a.packId)!) last.set(a.packId, at);
  }
  const candidates = state.tracks
    .filter((t) => t.profileId === state.activeProfileId)
    .map((t, i) => ({ pack: live.get(t.packId), i, at: last.get(t.packId) ?? "" }))
    .filter((c): c is { pack: ManifestPack; i: number; at: string } => Boolean(c.pack) && !isPackComplete(state, c.pack!));
  candidates.sort((a, b) => (a.at === b.at ? a.i - b.i : a.at < b.at ? 1 : -1));
  return candidates.slice(0, max).map((c) => c.pack);
}

/** 홈 "이어서" 카드가 가리킬 팩: 마지막으로 연 팩 → 진행 중인 팩 → (아이 프로필이면) 기본 팩. 없으면 null. */
export function continuePackId(state: State, manifest: Manifest): string | null {
  const live = (id: string | null | undefined) => (id && manifest.packs.some((p) => p.id === id && p.status === "live" && p.lessons.length > 0) ? id : null);
  const owned = (id: string) => state.tracks.some((t) => t.profileId === state.activeProfileId && t.packId === id);
  if (state.activePackId && owned(state.activePackId) && live(state.activePackId)) return state.activePackId;
  const progress = inProgressPacks(state, manifest, 1)[0];
  if (progress) return progress.id;
  return audienceOf(activeProfile(state)) === "kid" ? live(DEFAULT_PACK_ID) : null;
}
