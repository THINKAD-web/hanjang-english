import { z } from "zod";
import { meaningPrompt } from "./josa";
import type { RawContent } from "./load";
import {
  LessonSchema,
  PackSchema,
  QUIZ_TYPES,
  WordsFileSchema,
  type ChoiceQuiz,
  type Lesson,
  type Word,
} from "./schema";

/**
 * content:check 규칙 (지시서 4-4 + 추가 규칙). 순수 함수 — 에러 메시지 목록을 돌려준다. 빈 배열이면 통과.
 */

export const WORDS_PER_LESSON = 8;
export const SENTENCES_PER_LESSON = 2;
export const MIN_WORDS_PER_SENTENCE = 2;

/** 구형 기기에서 렌더되지 않을 수 있는 이모지. 정적 그림 퀴즈의 정답으로 쓰지 않는다. */
export const RISKY_EMOJI = new Set(["🪿"]);

type PairKind = "gr-gl" | "g-k";

/** 장별 최소 대립쌍(minimal pair) 보기 규칙. ox 는 보기가 없어 제외. */
export const PAIR_RULES: Record<string, { kind: PairKind; minQuizzes: number }> = {
  // L4: gr/gl 짝(grass/glass, grow/glow) 최소 2문항
  "giyeok-04": { kind: "gr-gl", minQuizzes: 2 },
  // L7: 보기 있는 4문항 전부 g/k 짝
  "giyeok-07": { kind: "g-k", minQuizzes: 4 },
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
export function sentenceUsesWord(sentence: string, word: string): boolean {
  const tokens = sentence.toLowerCase().match(/[a-z']+/g) ?? [];
  const w = word.toLowerCase();
  return tokens.some((t) => t === w || [`${w}s`, `${w}es`, `${w}ed`, `${w}ing`].includes(t));
}

function formatZodError(where: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${where}${i.path.length ? `.${i.path.join(".")}` : ""}: ${i.message}`);
}

export function checkContent(raw: RawContent): string[] {
  const errors: string[] = [];

  const pack = PackSchema.safeParse(raw.pack);
  if (!pack.success) errors.push(...formatZodError("pack.json", pack.error));
  const wordsParsed = WordsFileSchema.safeParse(raw.words);
  if (!wordsParsed.success) errors.push(...formatZodError("words.json", wordsParsed.error));
  const lessons: Lesson[] = [];
  raw.lessons.forEach((l, i) => {
    const r = LessonSchema.safeParse(l);
    if (r.success) lessons.push(r.data);
    else errors.push(...formatZodError(`lessons[${i}]`, r.error));
  });
  if (!pack.success || !wordsParsed.success || errors.length) return errors;

  const words = wordsParsed.data;
  const byId = new Map<string, Word>();
  const texts = new Set<string>();
  for (const w of words) {
    if (byId.has(w.id)) errors.push(`words.json: id 중복 ${w.id}`);
    if (texts.has(w.text)) errors.push(`words.json: text 중복 ${w.text}`);
    byId.set(w.id, w);
    texts.add(w.text);
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

    // 단어
    const lessonWords = new Set(lesson.wordIds);
    if (lesson.wordIds.length !== WORDS_PER_LESSON)
      errors.push(`${at}: 단어는 정확히 ${WORDS_PER_LESSON}개 (현재 ${lesson.wordIds.length})`);
    if (lessonWords.size !== lesson.wordIds.length) errors.push(`${at}: wordIds 중복`);
    for (const id of lesson.wordIds) {
      referenced.add(id);
      if (!byId.has(id)) errors.push(`${at}: words.json 에 없는 단어 ${id}`);
    }

    // 문장
    if (lesson.sentences.length !== SENTENCES_PER_LESSON)
      errors.push(`${at}: 문장은 정확히 ${SENTENCES_PER_LESSON}개 (현재 ${lesson.sentences.length})`);
    lesson.sentences.forEach((s, i) => {
      const where = `${at}.sentences[${i}]`;
      if (s.wordIds.length < MIN_WORDS_PER_SENTENCE)
        errors.push(`${where}: 이 장 단어를 ${MIN_WORDS_PER_SENTENCE}개 이상 써야 한다 (현재 ${s.wordIds.length})`);
      if (new Set(s.wordIds).size !== s.wordIds.length) errors.push(`${where}: wordIds 중복`);
      for (const id of s.wordIds) {
        if (!lessonWords.has(id)) errors.push(`${where}: ${id} 는 이 장 단어가 아니다`);
        const w = byId.get(id);
        if (w && !sentenceUsesWord(s.en, w.text)) errors.push(`${where}: "${s.en}" 에 ${w.text} 가 없다`);
      }
    });

    // 퀴즈
    if (lesson.quiz.length !== QUIZ_TYPES.length)
      errors.push(`${at}: 퀴즈는 정확히 ${QUIZ_TYPES.length}개 (현재 ${lesson.quiz.length})`);
    for (const type of QUIZ_TYPES) {
      const n = lesson.quiz.filter((q) => q.type === type).length;
      if (n !== 1) errors.push(`${at}: ${type} 유형은 정확히 1번 (현재 ${n})`);
    }
    lesson.quiz.forEach((q, i) => {
      const where = `${at}.quiz[${i}](${q.type})`;
      const target = byId.get(q.targetWordId);
      if (!lessonWords.has(q.targetWordId)) errors.push(`${where}: targetWordId ${q.targetWordId} 는 이 장 단어가 아니다`);
      if (!target) return;

      if (q.type === "ox") {
        const correct = `${target.text} = ${target.meaning}`;
        if (!q.statement.startsWith(`${target.text} = `))
          errors.push(`${where}: statement 는 "${target.text} = …" 형식이어야 한다`);
        else if (q.answer !== (q.statement === correct))
          errors.push(`${where}: answer ${q.answer} 가 statement "${q.statement}" 와 맞지 않는다 (뜻: ${target.meaning})`);
        return;
      }

      checkChoice(q, target, texts, where, errors);
      if (q.type === "picture_choice") {
        if (!target.imageable) errors.push(`${where}: ${target.text} 는 imageable: false 라 그림 문항 불가`);
        if (target.emoji && RISKY_EMOJI.has(target.emoji) && !target.image)
          errors.push(`${where}: ${target.emoji} 는 구형 기기 렌더 위험 — 그림 문항 정답으로 쓰지 않는다`);
      }
      if (q.type === "meaning_choice" && q.prompt !== meaningPrompt(target.meaning))
        errors.push(`${where}: prompt 는 ${meaningPrompt(target.meaning)} 이어야 한다 (현재 ${q.prompt})`);
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

  // words.json 단어 수 = 레슨들이 참조하는 고유 단어 수
  if (words.length !== referenced.size)
    errors.push(`words.json 단어 수 ${words.length} ≠ 레슨이 참조하는 고유 단어 수 ${referenced.size}`);
  for (const w of words) if (!referenced.has(w.id)) errors.push(`words.json: ${w.id} 는 어느 레슨에서도 쓰이지 않는다`);

  return errors;
}

function checkChoice(q: ChoiceQuiz, target: Word, texts: Set<string>, where: string, errors: string[]) {
  if (new Set(q.options).size !== q.options.length) errors.push(`${where}: 보기 중복 ${q.options.join("/")}`);
  if (!q.options.includes(q.answer)) errors.push(`${where}: answer "${q.answer}" 가 보기에 없다`);
  if (q.answer !== target.text) errors.push(`${where}: answer "${q.answer}" ≠ 대상 단어 "${target.text}"`);
  for (const o of q.options) if (!texts.has(o)) errors.push(`${where}: 보기 "${o}" 가 words.json 에 없다`);
}
