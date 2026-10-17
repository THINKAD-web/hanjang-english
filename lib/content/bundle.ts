import type { Content, Item, Lesson, Pack, Subject } from "./schema";

/**
 * 빌드 산출물의 모양 (public/content/…). JSON 으로 직렬화 가능한 순수 데이터와, 그것을 앱용 Content 로 되돌리는 함수.
 * - manifest.json: 작게 유지 (과목, 팩 메타 + 계산된 lessonCount, 레슨 목록 요약)
 * - packs/{packId}.json: 레슨 본문 전체 (팩 하나가 한 파일)
 */

export type ManifestLesson = Pick<Lesson, "id" | "order" | "title" | "type" | "reviewed" | "testOnly">;
export type ManifestPack = Pack & { lessons: ManifestLesson[] };
export type Manifest = { version: 1; subjects: Subject[]; packs: ManifestPack[] };
export type PackBundle = { pack: Pack; items: Item[]; lessons: Lesson[] };

export function bundleOf(content: Content): PackBundle {
  return { pack: content.pack, items: content.items, lessons: content.lessons };
}

export function contentOf(bundle: PackBundle): Content {
  return { pack: bundle.pack, items: bundle.items, itemsById: new Map(bundle.items.map((it) => [it.id, it])), lessons: bundle.lessons };
}

export function manifestLessonsOf(lessons: readonly Lesson[]): ManifestLesson[] {
  return lessons.map((l) => ({ id: l.id, order: l.order, title: l.title, type: l.type, reviewed: l.reviewed, testOnly: l.testOnly }));
}

/** 과목 순서 → 레벨 순서 → 팩 순서 → id 로 정렬한 팩 목록. 같은 입력이면 항상 같은 출력. */
export function manifestOf(subjects: readonly Subject[], contents: readonly Content[]): Manifest {
  const subjectOrder = new Map(subjects.map((s) => [s.id, s.order]));
  const packs: ManifestPack[] = contents.map((c) => ({ ...c.pack, lessons: manifestLessonsOf(c.lessons) }));
  packs.sort(
    (a, b) =>
      (subjectOrder.get(a.subjectId) ?? 0) - (subjectOrder.get(b.subjectId) ?? 0) ||
      a.levelOrder - b.levelOrder ||
      a.order - b.order ||
      a.id.localeCompare(b.id),
  );
  return { version: 1, subjects: [...subjects].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)), packs };
}
