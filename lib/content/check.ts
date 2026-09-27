import { z } from "zod";
import { meaningPrompt } from "./josa";
import type { RawContent } from "./load";
import { ItemsFileSchema, LessonSchema, PackSchema, QUIZ_TYPES, type ChoiceQuiz, type Item, type Lesson } from "./schema";

/**
 * content:check 규칙 (지시서 4-4 + 기획안 v2 5-5 예외). 순수 함수 — 에러 메시지 목록을 돌려준다. 빈 배열이면 통과.
 */

export const ITEMS_PER_LESSON = 8;
export const SENTENCES_PER_LESSON = 2;
export const MIN_ITEMS_PER_SENTENCE = 2;

type PairKind = "gr-gl" | "g-k";

/** 장별 최소 대립쌍(minimal pair) 보기 규칙. ox 는 보기가 없어 제외. lessonId 기준. */
export const PAIR_RULES: Record<string, { kind: PairKind; minQuizzes: number }> = {
  // L4: gr/gl 짝(grass/glass, grow/glow) 최소 2문항
  "en-kid-giyeok-04": { kind: "gr-gl", minQuizzes: 2 },
  // L7: 보기 있는 4문항 전부 g/k 짝
  "en-kid-giyeok-07": { kind: "g-k", minQuizzes: 4 },
};

export function isPair(kind: PairKind, a: string, b: string): boolean {
  const test = (x: string, y: string) => {
    if (kind === "gr-gl") return x.startsWith("gr") && y === `gl${x.slice(2)}`;
    // g/k: 첫소리 g↔c (goat/coat, glass/class) 또는 끝소리 g↔ck (bag/back)
    return (x.startsWith("g") && y === `c${x.slice(1)}`) || (x.endsWith("g") && y === `${x.slice(0, -1)}ck`);
  };
  return test(a, b) || test(b, a);
}

function hasPair(kind: PairKind, options: readonly string[]): boolean {
  return options.some((a, i) => options.slice(i + 1).some((b) => isPair(kind, a, b)));
}

/** 문장에 단어가 (s/es/ed/ing 변형 포함) 토큰으로 들어 있는가. grows→grow, greets→greet. */
export function sentenceUsesText(sentence: string, text: string): boolean {
  const tokens = sentence.toLowerCase().match(/[a-z']+/g) ?? [];
  const w = text.toLowerCase();
  return tokens.some((t) => t === w || [`${w}s`, `${w}es`, `${w}ed`, `${w}ing`].includes(t));
}

function formatZodError(where: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${where}${i.path.length ? `.${i.path.join(".")}` : ""}: ${i.message}`);
}

/**
 * 5유형 규칙 (기획안 5-5): 기본은 5유형 1개씩.
 * 장 안에 imageable 아이템이 하나도 없으면(성인·문장 팩에 흔함) picture_choice 자리를
 * listen_choice 또는 fill_blank 로 대체할 수 있다 — 둘 중 하나가 2번, 나머지 유형은 그대로 1번씩.
 * (팩의 audience·아이템의 kind 로 이런 장이 나오는지가 결정되지만, 판정 자체는 imageable 유무로 한다.)
 */
function checkQuizComposition(at: string, quiz: Lesson["quiz"], hasImageableItem: boolean, errors: string[]) {
  if (quiz.length !== QUIZ_TYPES.length) errors.push(`${at}: 퀴즈는 정확히 ${QUIZ_TYPES.length}개 (현재 ${quiz.length})`);

  const count = (t: (typeof QUIZ_TYPES)[number]) => quiz.filter((q) => q.type === t).length;

  for (const type of ["meaning_choice", "ox"] as const) {
    const n = count(type);
    if (n !== 1) errors.push(`${at}: ${type} 유형은 정확히 1번 (현재 ${n})`);
  }

  if (hasImageableItem) {
    for (const type of ["picture_choice", "fill_blank", "listen_choice"] as const) {
      const n = count(type);
      if (n !== 1) errors.push(`${at}: ${type} 유형은 정확히 1번 (현재 ${n})`);
    }
  } else {
    const picture = count("picture_choice");
    if (picture !== 0) errors.push(`${at}: imageable 아이템이 없는 장은 picture_choice 를 낼 수 없다 (현재 ${picture})`);
    const fill = count("fill_blank");
    const listen = count("listen_choice");
    if (fill < 1 || listen < 1)
      errors.push(`${at}: picture_choice 없는 장은 fill_blank·listen_choice 가 각각 1번 이상이어야 한다 (현재 fill_blank ${fill}, listen_choice ${listen})`);
    if (fill + listen !== 3) errors.push(`${at}: fill_blank + listen_choice 합이 3이어야 한다 (현재 ${fill + listen})`);
  }
}

export function checkContent(raw: RawContent): string[] {
  const errors: string[] = [];

  const pack = PackSchema.safeParse(raw.pack);
  if (!pack.success) errors.push(...formatZodError("pack.json", pack.error));
  const itemsParsed = ItemsFileSchema.safeParse(raw.items);
  if (!itemsParsed.success) errors.push(...formatZodError("items.json", itemsParsed.error));
  const lessons: Lesson[] = [];
  raw.lessons.forEach((l, i) => {
    const r = LessonSchema.safeParse(l);
    if (r.success) lessons.push(r.data);
    else errors.push(...formatZodError(`lessons[${i}]`, r.error));
  });
  if (!pack.success || !itemsParsed.success || errors.length) return errors;

  const items = itemsParsed.data;
  const byId = new Map<string, Item>();
  const texts = new Set<string>();
  for (const it of items) {
    if (byId.has(it.id)) errors.push(`items.json: id 중복 ${it.id}`);
    if (texts.has(it.text)) errors.push(`items.json: text 중복 ${it.text}`);
    byId.set(it.id, it);
    texts.add(it.text);
  }

  // 장 구성
  if (lessons.length !== pack.data.lessonCount)
    errors.push(`레슨 수 ${lessons.length} ≠ pack.lessonCount ${pack.data.lessonCount}`);
  const dayNos = lessons.map((l) => l.dayNo).sort((a, b) => a - b);
  dayNos.forEach((d, i) => {
    if (d !== i + 1) errors.push(`dayNo 는 1..${lessons.length} 연속이어야 한다 (현재 ${dayNos.join(",")})`);
  });

  const referenced = new Set<string>();

  for (const lesson of lessons) {
    const at = lesson.id;
    const expectedId = `${pack.data.id}-${String(lesson.dayNo).padStart(2, "0")}`;
    if (lesson.id !== expectedId) errors.push(`${at}: id 는 ${expectedId} 이어야 한다`);
    if (lesson.packId !== pack.data.id) errors.push(`${at}: packId ${lesson.packId} ≠ ${pack.data.id}`);

    // 아이템
    const lessonItems = new Set(lesson.itemIds);
    if (lesson.itemIds.length !== ITEMS_PER_LESSON)
      errors.push(`${at}: 아이템은 정확히 ${ITEMS_PER_LESSON}개 (현재 ${lesson.itemIds.length})`);
    if (lessonItems.size !== lesson.itemIds.length) errors.push(`${at}: itemIds 중복`);
    let hasImageableItem = false;
    for (const id of lesson.itemIds) {
      referenced.add(id);
      const it = byId.get(id);
      if (!it) errors.push(`${at}: items.json 에 없는 아이템 ${id}`);
      else if (it.imageable) hasImageableItem = true;
    }

    // 문장
    if (lesson.sentences.length !== SENTENCES_PER_LESSON)
      errors.push(`${at}: 문장은 정확히 ${SENTENCES_PER_LESSON}개 (현재 ${lesson.sentences.length})`);
    lesson.sentences.forEach((s, i) => {
      const where = `${at}.sentences[${i}]`;
      if (s.itemIds.length < MIN_ITEMS_PER_SENTENCE)
        errors.push(`${where}: 이 장 아이템을 ${MIN_ITEMS_PER_SENTENCE}개 이상 써야 한다 (현재 ${s.itemIds.length})`);
      if (new Set(s.itemIds).size !== s.itemIds.length) errors.push(`${where}: itemIds 중복`);
      for (const id of s.itemIds) {
        if (!lessonItems.has(id)) errors.push(`${where}: ${id} 는 이 장 아이템이 아니다`);
        const it = byId.get(id);
        if (it && it.kind === "word" && !sentenceUsesText(s.text, it.text))
          errors.push(`${where}: "${s.text}" 에 ${it.text} 가 없다`);
      }
    });

    // 퀴즈
    checkQuizComposition(at, lesson.quiz, hasImageableItem, errors);
    lesson.quiz.forEach((q, i) => {
      const where = `${at}.quiz[${i}](${q.type})`;
      const target = byId.get(q.targetItemId);
      if (!lessonItems.has(q.targetItemId)) errors.push(`${where}: targetItemId ${q.targetItemId} 는 이 장 아이템이 아니다`);
      if (!target) return;

      if (q.type === "ox") {
        const correct = `${target.text} = ${target.meaningKo}`;
        if (!q.statement.startsWith(`${target.text} = `))
          errors.push(`${where}: statement 는 "${target.text} = …" 형식이어야 한다`);
        else if (q.answer !== (q.statement === correct))
          errors.push(`${where}: answer ${q.answer} 가 statement "${q.statement}" 와 맞지 않는다 (뜻: ${target.meaningKo})`);
        return;
      }

      checkChoice(q, target, texts, where, errors);
      if (q.type === "picture_choice" && !target.imageable)
        errors.push(`${where}: ${target.text} 는 imageable: false 라 그림 문항 불가`);
      if (q.type === "meaning_choice" && q.prompt !== meaningPrompt(target.meaningKo))
        errors.push(`${where}: prompt 는 ${meaningPrompt(target.meaningKo)} 이어야 한다 (현재 ${q.prompt})`);
      if (q.type === "fill_blank" && q.sentence.split("____").length !== 2)
        errors.push(`${where}: sentence 에 ____ 는 정확히 1개`);
    });

    const pairRule = PAIR_RULES[lesson.id];
    if (pairRule) {
      const n = lesson.quiz.filter((q) => q.type !== "ox" && hasPair(pairRule.kind, q.options)).length;
      if (n < pairRule.minQuizzes)
        errors.push(`${at}: ${pairRule.kind} 짝 보기 문항이 ${pairRule.minQuizzes}개 이상이어야 한다 (현재 ${n})`);
    }
  }

  // items.json 아이템 수 = 레슨들이 참조하는 고유 아이템 수
  if (items.length !== referenced.size)
    errors.push(`items.json 아이템 수 ${items.length} ≠ 레슨이 참조하는 고유 아이템 수 ${referenced.size}`);
  for (const it of items) if (!referenced.has(it.id)) errors.push(`items.json: ${it.id} 는 어느 레슨에서도 쓰이지 않는다`);

  return errors;
}

function checkChoice(q: ChoiceQuiz, target: Item, texts: Set<string>, where: string, errors: string[]) {
  if (new Set(q.options).size !== q.options.length) errors.push(`${where}: 보기 중복 ${q.options.join("/")}`);
  if (!q.options.includes(q.answer)) errors.push(`${where}: answer "${q.answer}" 가 보기에 없다`);
  if (q.answer !== target.text) errors.push(`${where}: answer "${q.answer}" ≠ 대상 아이템 "${target.text}"`);
  for (const o of q.options) if (!texts.has(o)) errors.push(`${where}: 보기 "${o}" 가 items.json 에 없다`);
}
