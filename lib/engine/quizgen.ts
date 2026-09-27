import { QUIZ_TYPES, type Content, type Item, type Lesson, type Quiz, type QuizType, type Sentence } from "@/lib/content/schema";
import { meaningPrompt } from "@/lib/content/josa";
import type { DateKey } from "./date";
import { pick, seededRandom, shuffle, type Rng } from "./rng";

/**
 * 퀴즈 자동 생성 (지시서 6-4). 오답 삽입과 복습장에서 쓴다.
 * seed = dateKey + itemId 로 고정 → 같은 날 다시 열어도 같은 문제.
 */

type Options = [string, string, string];

export type QuizContext = {
  /** fill_blank 문장 후보 (보통 팩 전체 예문) */
  sentences: readonly Sentence[];
};

export function quizSeed(dateKey: DateKey, itemId: string): string {
  return `${dateKey}${itemId}`;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function shareTag(a: Item, b: Item): boolean {
  return a.tags.some((t) => b.tags.includes(t));
}

/**
 * 오답 보기. 태그가 겹치는 아이템 → 철자가 비슷한(편집거리 작은) 순으로 상위 후보를 만들고
 * 그중에서 seed 로 n 개를 고른다 (항상 같은 보기만 나오지 않도록).
 */
export function pickDistractors(item: Item, pool: readonly Item[], rng: Rng, n = 2): Item[] {
  const ranked = pool
    .filter((it) => it.id !== item.id && it.text !== item.text && it.meaningKo !== item.meaningKo)
    .map((it) => ({ it, tag: shareTag(it, item) ? 0 : 1, dist: levenshtein(item.text, it.text) }))
    .sort((a, b) => a.tag - b.tag || a.dist - b.dist || a.it.id.localeCompare(b.it.id))
    .map((x) => x.it);
  return shuffle(ranked.slice(0, n + 2), rng).slice(0, n);
}

/** 문장에서 아이템 원형이 그대로(변형 아님) 나오는 첫 자리를 ____ 로 바꾼다. 없으면 null. */
export function blankOut(sentence: string, text: string): string | null {
  const re = new RegExp(`\\b${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(sentence) ? sentence.replace(re, "____") : null;
}

function fillBlankSentences(item: Item, ctx: QuizContext): string[] {
  const out: string[] = [];
  for (const s of ctx.sentences) {
    const blanked = blankOut(s.text, item.text);
    if (blanked && !out.includes(blanked)) out.push(blanked);
  }
  return out;
}

/** 이 아이템으로 낼 수 있는 유형. imageable: false 아이템은 picture_choice 제외, 원형이 든 예문이 없으면 fill_blank 제외. */
export function allowedTypes(item: Item, ctx: QuizContext): QuizType[] {
  return QUIZ_TYPES.filter((t) => {
    if (t === "picture_choice") return item.imageable;
    if (t === "fill_blank") return fillBlankSentences(item, ctx).length > 0;
    return true;
  });
}

export function generateQuiz(
  item: Item,
  type: QuizType,
  pool: readonly Item[],
  seed: string,
  ctx: QuizContext = { sentences: [] },
): Quiz {
  if (!allowedTypes(item, ctx).includes(type)) {
    throw new Error(`${item.text} 로는 ${type} 문항을 낼 수 없다`);
  }
  const rng = seededRandom(seed);
  const distractors = pickDistractors(item, pool, rng);
  const options = () => shuffle([item.text, ...distractors.map((d) => d.text)], rng) as Options;
  const targetItemId = item.id;

  switch (type) {
    case "picture_choice":
      return { type, targetItemId, options: options(), answer: item.text };
    case "meaning_choice":
      return { type, targetItemId, prompt: meaningPrompt(item.meaningKo), options: options(), answer: item.text };
    case "fill_blank":
      return { type, targetItemId, sentence: pick(fillBlankSentences(item, ctx), rng), options: options(), answer: item.text };
    case "listen_choice":
      return { type, targetItemId, options: options(), answer: item.text };
    case "ox": {
      // 50% 확률로 틀린 뜻을 제시
      const truthful = rng() < 0.5;
      const meaningKo = truthful ? item.meaningKo : distractors[0].meaningKo;
      return { type, targetItemId, statement: `${item.text} = ${meaningKo}`, answer: truthful };
    }
  }
}

function contextOf(content: Content): QuizContext {
  return { sentences: content.lessons.flatMap((l) => l.sentences) };
}

/** 오답 삽입 문항 유형: meaning_choice 또는 listen_choice 중 하나 (seed 로 결정). */
export const INJECTED_TYPES = ["meaning_choice", "listen_choice"] as const satisfies readonly QuizType[];

/**
 * 일반 장 퀴즈. injectedItemId 가 있으면 5번째 칸을 그 아이템 문항으로 바꾼다.
 */
export function buildLessonQuiz(lesson: Lesson, content: Content, dateKey: DateKey, injectedItemId?: string): Quiz[] {
  const quiz = [...lesson.quiz];
  if (!injectedItemId) return quiz;
  const item = content.itemsById.get(injectedItemId);
  if (!item) return quiz;
  const seed = quizSeed(dateKey, item.id);
  const type = pick(INJECTED_TYPES, seededRandom(`${seed}:type`));
  quiz[quiz.length - 1] = generateQuiz(item, type, content.items, seed, contextOf(content));
  return quiz;
}

export const REVIEW_QUIZ_SIZE = 5;

/**
 * 복습장 5문항. 앞쪽 아이템(활성 오답 우선 정렬된 itemIds)부터 대상으로 삼고,
 * 유형은 5종을 섞어 한 번씩 배정하되 그 아이템이 낼 수 없는 유형이면 남은 유형 중 가능한 것을 쓴다.
 */
export function buildReviewQuiz(itemIds: readonly string[], content: Content, dateKey: DateKey): Quiz[] {
  const items = itemIds.map((id) => content.itemsById.get(id)).filter((it): it is Item => Boolean(it));
  if (items.length === 0) return [];
  const ctx = contextOf(content);
  const remaining = shuffle(QUIZ_TYPES, seededRandom(`${dateKey}:review`));
  const quiz: Quiz[] = [];
  for (let i = 0; i < REVIEW_QUIZ_SIZE; i++) {
    const item = items[i % items.length];
    const allowed = allowedTypes(item, ctx);
    const idx = remaining.findIndex((t) => allowed.includes(t));
    const type = idx >= 0 ? remaining.splice(idx, 1)[0] : "meaning_choice";
    // 같은 아이템이 두 번 나오면(아이템이 5개 미만) 칸 번호로 seed 를 구분
    const seed = quizSeed(dateKey, item.id) + (i >= items.length ? `#${i}` : "");
    quiz.push(generateQuiz(item, type, content.items, seed, ctx));
  }
  return quiz;
}

/** 보기 셔플 seed = dateKey + 장 id(복습장은 "review") + 문항 번호 */
export function optionSeed(dateKey: DateKey, sheetId: string, index: number): string {
  return `${dateKey}${sheetId}${index}`;
}

/**
 * 화면에 낼 때 보기 순서를 섞는다. 콘텐츠 JSON 은 정답이 늘 첫 보기이므로 UI 는 반드시 이걸 거친다.
 * 같은 날 같은 장을 다시 열면 같은 순서. ox 는 그대로.
 */
export function shuffleSheetOptions(quiz: readonly Quiz[], dateKey: DateKey, sheetId: string): Quiz[] {
  return quiz.map((q, i) =>
    q.type === "ox" ? q : { ...q, options: shuffle(q.options, seededRandom(optionSeed(dateKey, sheetId, i))) as Options },
  );
}
