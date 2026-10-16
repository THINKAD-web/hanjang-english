import type { z } from "zod";
import { buildAutoQuiz } from "./auto-quiz";
import { generateProblems } from "./generator";
import { resolveSteps } from "./lesson-steps";
import {
  ItemsFileSchema,
  RawLessonSchema,
  RawPackSchema,
  type Content,
  type Item,
  type Lesson,
  type RawLesson,
} from "./schema";

/**
 * 저작용(raw) 콘텐츠 → 앱용(normalized) Content.
 * 순수 함수다 (파일을 읽지 않는다). 파일 읽기는 lib/content/node.ts / scripts 가 맡는다.
 *
 * 하는 일
 * - zod 로 모양 검증 (pack.json / items.json / 레슨)
 * - 레슨의 인라인 items 를 팩 공용 아이템 뱅크에 합치고 itemIds 로 통일
 * - id·packId 기본값, steps 기본값(타입별 + intro/문장 없으면 건너뜀)
 * - 레슨의 generator 로 연산 문제 아이템 생성, 퀴즈를 적지 않은 레슨은 pack.rules.autoQuiz 로 자동 생성
 * - pack.lessonCount 를 실제 레슨 수로 계산 (적혀 있으면 일치해야 한다)
 */

export type RawContent = { pack: unknown; items?: unknown; lessons: unknown[] };

export type NormalizeResult = { content: Content | null; errors: string[] };

export function zodErrors(where: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${where}${i.path.length ? `.${i.path.join(".")}` : ""}: ${i.message}`);
}

export const lessonIdFor = (packId: string, order: number) => `${packId}-${String(order).padStart(2, "0")}`;

export function normalizeContent(raw: RawContent): NormalizeResult {
  const errors: string[] = [];

  const pack = RawPackSchema.safeParse(raw.pack);
  if (!pack.success) errors.push(...zodErrors("pack.json", pack.error));

  const bank = raw.items === undefined ? { success: true as const, data: [] as Item[] } : ItemsFileSchema.safeParse(raw.items);
  if (!bank.success) errors.push(...zodErrors("items.json", bank.error));

  const rawLessons: RawLesson[] = [];
  raw.lessons.forEach((l, i) => {
    const r = RawLessonSchema.safeParse(l);
    if (r.success) rawLessons.push(r.data);
    else errors.push(...zodErrors(`lessons[${i}]`, r.error));
  });
  if (!pack.success || !bank.success || errors.length) return { content: null, errors };

  const packData = pack.data;
  const items: Item[] = [...bank.data];
  const byId = new Map<string, Item>();
  for (const it of items) {
    if (byId.has(it.id)) errors.push(`items.json: id 중복 ${it.id}`);
    byId.set(it.id, it);
  }

  const lessons: Lesson[] = rawLessons.map((l) => {
    const id = l.id ?? lessonIdFor(packData.id, l.order);
    if (l.items && l.itemIds) errors.push(`${id}: items 와 itemIds 는 함께 쓸 수 없다`);
    if (l.generator && (l.items || l.itemIds)) errors.push(`${id}: generator 는 items·itemIds 와 함께 쓸 수 없다`);

    let inline = l.items;
    if (l.generator) {
      const made = generateProblems(l.generator, id);
      if ("error" in made) errors.push(made.error);
      else inline = made.items;
    }

    let itemIds: string[];
    if (inline) {
      itemIds = inline.map((it) => it.id);
      for (const it of inline) {
        const existing = byId.get(it.id);
        if (!existing) {
          items.push(it);
          byId.set(it.id, it);
        } else if (JSON.stringify(existing) !== JSON.stringify(it)) {
          errors.push(`${id}: 인라인 아이템 ${it.id} 가 다른 정의와 충돌한다`);
        }
      }
    } else if (l.itemIds) {
      itemIds = l.itemIds;
    } else {
      itemIds = [];
      if (!l.generator) errors.push(`${id}: items, itemIds 또는 generator 가 필요하다`);
    }

    // 퀴즈는 아이템이 모두 합쳐진 뒤에 만든다 (보기 후보가 팩 전체 아이템이다)
    return {
      id,
      packId: l.packId ?? packData.id,
      order: l.order,
      title: l.title,
      type: l.type,
      ...(l.intro ? { intro: l.intro } : {}),
      itemIds,
      sentences: l.sentences,
      steps: resolveSteps({ type: l.type, steps: l.steps, intro: l.intro, sentences: l.sentences }),
      quiz: l.quiz ?? [],
      reviewed: l.reviewed,
      testOnly: l.testOnly,
    };
  });
  lessons.sort((a, b) => a.order - b.order);

  const needQuiz = new Set(rawLessons.filter((l) => !l.quiz).map((l) => l.id ?? lessonIdFor(packData.id, l.order)));
  for (const lesson of lessons) {
    if (!needQuiz.has(lesson.id)) continue;
    if (!packData.rules.autoQuiz) {
      errors.push(`${lesson.id}: quiz 가 없다 (이 팩은 rules.autoQuiz 가 꺼져 있다)`);
      continue;
    }
    const made = buildAutoQuiz({
      lessonId: lesson.id,
      items: lesson.itemIds.map((id) => byId.get(id)).filter((it): it is Item => Boolean(it)),
      pool: items,
      sentences: lesson.sentences,
      rules: packData.rules,
    });
    if ("error" in made) errors.push(made.error);
    else lesson.quiz = made.quiz;
  }

  if (packData.lessonCount !== undefined && packData.lessonCount !== lessons.length)
    errors.push(`레슨 수 ${lessons.length} ≠ pack.lessonCount ${packData.lessonCount}`);

  if (errors.length) return { content: null, errors };

  return {
    content: {
      pack: { ...packData, lessonCount: lessons.length },
      items,
      itemsById: new Map(items.map((it) => [it.id, it])),
      lessons,
    },
    errors,
  };
}
