import type { Manifest, ManifestPack } from "./bundle";
import type { Content } from "./schema";

/**
 * 공개 여부를 판단하는 단 하나의 장소. 화면·라우트·리포지토리는 이 모듈의 결과만 믿는다.
 *
 * Production (기본)
 *  - 레슨은 pack.status 가 live 이고, reviewed 이고, testOnly 가 아닐 때만 공개다.
 *  - 일부만 검수된 팩은 "처음부터 이어지는 공개 레슨"까지만 연다 (1·2·3장이 공개, 4장이 비공개면 5장이 공개여도 3장까지).
 *    장은 순서대로 진행하므로 중간이 비어 있으면 그 뒤는 어차피 도달할 수 없다.
 *  - 공개 레슨이 하나도 없는 live 팩은 목록에서도 빠진다. status 가 soon 인 팩은 "준비 중" 으로만 보인다.
 * Debug (NEXT_PUBLIC_DEBUG=true)
 *  - 모든 팩·레슨이 열린다. 화면은 공개 전 레슨에 "검수 전" 표시를 붙인다 (isPreRelease).
 */

export type Visibility = { debug: boolean };

/** 빌드 시점에 정해지는 기본값 (NEXT_PUBLIC_DEBUG 는 클라이언트 번들에도 인라인된다). */
export const defaultVisibility = (): Visibility => ({ debug: process.env.NEXT_PUBLIC_DEBUG === "true" });

type PackLike = { status: "live" | "soon" };
type LessonLike = { order: number; reviewed: boolean; testOnly: boolean };

/** 공개 조건 한 줄 (연속 규칙은 적용하기 전). */
export function isPublicLesson(pack: PackLike, lesson: LessonLike): boolean {
  return pack.status === "live" && lesson.reviewed && !lesson.testOnly;
}

/** 공개 전(검수 전·테스트용·준비 중 팩)인 레슨인가 — Debug 화면의 "검수 전" 표시용. */
export const isPreRelease = (pack: PackLike, lesson: LessonLike): boolean => !isPublicLesson(pack, lesson);

/** 이 방문자에게 열리는 레슨 (order 순서 유지). */
export function visibleLessons<L extends LessonLike>(pack: PackLike, lessons: readonly L[], v: Visibility): L[] {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  if (v.debug) return sorted;
  const out: L[] = [];
  for (const l of sorted) {
    if (!isPublicLesson(pack, l)) break;
    out.push(l);
  }
  return out;
}

/** Production 에서 공개되는 레슨 수 (content:check 가 팩마다 보여 준다). */
export const publicLessonCount = (pack: PackLike, lessons: readonly LessonLike[]): number =>
  visibleLessons(pack, lessons, { debug: false }).length;

/** 팩 본문을 방문자에게 맞게 자른다. 열 수 있는 레슨이 없으면 null (= 없는 팩 취급). */
export function visibleContent(content: Content, v: Visibility): Content | null {
  const lessons = visibleLessons(content.pack, content.lessons, v);
  if (lessons.length === 0) return null;
  if (lessons.length === content.lessons.length) return content;
  return { ...content, pack: { ...content.pack, lessonCount: lessons.length }, lessons };
}

/**
 * 목록(manifest)을 방문자에게 맞게 자른다.
 * - Production: soon 팩은 그대로(준비 중), live 팩은 공개 레슨 수만큼만, 공개 레슨이 없으면 빠진다.
 * - Debug: 전부.
 */
export function visibleManifest(manifest: Manifest, v: Visibility): Manifest {
  if (v.debug) return manifest;
  const packs: ManifestPack[] = [];
  for (const p of manifest.packs) {
    if (p.status === "soon") {
      packs.push({ ...p, lessons: [], lessonCount: 0 });
      continue;
    }
    const lessons = visibleLessons(p, p.lessons, v);
    if (lessons.length > 0) packs.push({ ...p, lessons, lessonCount: lessons.length });
  }
  return { ...manifest, packs };
}
