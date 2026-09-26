import { QUIZ_TYPES, type Content, type Lesson, type Quiz, type QuizType, type Sentence, type Word } from "@/lib/content/schema";
import { meaningPrompt } from "@/lib/content/josa";
import type { DateKey } from "./date";
import { pick, seededRandom, shuffle, type Rng } from "./rng";

/**
 * 퀴즈 자동 생성 (지시서 6-4). 오답 삽입과 복습장에서 쓴다.
 * seed = dateKey + wordId 로 고정 → 같은 날 다시 열어도 같은 문제.
 */

type Options = [string, string, string];

export type QuizContext = {
  /** fill_blank 문장 후보 (보통 팩 전체 예문) */
  sentences: readonly Sentence[];
};

export function quizSeed(dateKey: DateKey, wordId: string): string {
  return `${dateKey}${wordId}`;
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

/**
 * 오답 보기. 같은 sound 태그 → 철자가 비슷한(편집거리 작은) 순으로 상위 후보를 만들고
 * 그중에서 seed 로 n 개를 고른다 (항상 같은 보기만 나오지 않도록).
 */
export function pickDistractors(word: Word, pool: readonly Word[], rng: Rng, n = 2): Word[] {
  const ranked = pool
    .filter((w) => w.id !== word.id && w.text !== word.text && w.meaning !== word.meaning)
    .map((w) => ({ w, sound: w.sound === word.sound ? 0 : 1, dist: levenshtein(word.text, w.text) }))
    .sort((a, b) => a.sound - b.sound || a.dist - b.dist || a.w.id.localeCompare(b.w.id))
    .map((x) => x.w);
  return shuffle(ranked.slice(0, n + 2), rng).slice(0, n);
}

/** 문장에서 단어가 원형 그대로(변형 아님) 나오는 첫 자리를 ____ 로 바꾼다. 없으면 null. */
export function blankOut(sentence: string, word: string): string | null {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(sentence) ? sentence.replace(re, "____") : null;
}

function fillBlankSentences(word: Word, ctx: QuizContext): string[] {
  const out: string[] = [];
  for (const s of ctx.sentences) {
    const blanked = blankOut(s.en, word.text);
    if (blanked && !out.includes(blanked)) out.push(blanked);
  }
  return out;
}

/** 이 단어로 낼 수 있는 유형. imageable: false 단어는 picture_choice 제외, 원형이 든 예문이 없으면 fill_blank 제외. */
export function allowedTypes(word: Word, ctx: QuizContext): QuizType[] {
  return QUIZ_TYPES.filter((t) => {
    if (t === "picture_choice") return word.imageable;
    if (t === "fill_blank") return fillBlankSentences(word, ctx).length > 0;
    return true;
  });
}

export function generateQuiz(
  word: Word,
  type: QuizType,
  pool: readonly Word[],
  seed: string,
  ctx: QuizContext = { sentences: [] },
): Quiz {
  if (!allowedTypes(word, ctx).includes(type)) {
    throw new Error(`${word.text} 로는 ${type} 문항을 낼 수 없다`);
  }
  const rng = seededRandom(seed);
  const distractors = pickDistractors(word, pool, rng);
  const options = () => shuffle([word.text, ...distractors.map((d) => d.text)], rng) as Options;
  const targetWordId = word.id;

  switch (type) {
    case "picture_choice":
      return { type, targetWordId, options: options(), answer: word.text };
    case "meaning_choice":
      return { type, targetWordId, prompt: meaningPrompt(word.meaning), options: options(), answer: word.text };
    case "fill_blank":
      return { type, targetWordId, sentence: pick(fillBlankSentences(word, ctx), rng), options: options(), answer: word.text };
    case "listen_choice":
      return { type, targetWordId, options: options(), answer: word.text };
    case "ox": {
      // 50% 확률로 틀린 뜻을 제시
      const truthful = rng() < 0.5;
      const meaning = truthful ? word.meaning : distractors[0].meaning;
      return { type, targetWordId, statement: `${word.text} = ${meaning}`, answer: truthful };
    }
  }
}

function contextOf(content: Content): QuizContext {
  return { sentences: content.lessons.flatMap((l) => l.sentences) };
}

/** 오답 삽입 문항 유형: meaning_choice 또는 listen_choice 중 하나 (seed 로 결정). */
export const INJECTED_TYPES = ["meaning_choice", "listen_choice"] as const satisfies readonly QuizType[];

/**
 * 일반 장 퀴즈. injectedWordId 가 있으면 5번째 칸을 그 단어 문항으로 바꾼다.
 */
export function buildLessonQuiz(lesson: Lesson, content: Content, dateKey: DateKey, injectedWordId?: string): Quiz[] {
  const quiz = [...lesson.quiz];
  if (!injectedWordId) return quiz;
  const word = content.wordsById.get(injectedWordId);
  if (!word) return quiz;
  const seed = quizSeed(dateKey, word.id);
  const type = pick(INJECTED_TYPES, seededRandom(`${seed}:type`));
  quiz[quiz.length - 1] = generateQuiz(word, type, content.words, seed, contextOf(content));
  return quiz;
}

export const REVIEW_QUIZ_SIZE = 5;

/**
 * 복습장 5문항. 앞쪽 단어(활성 오답 우선 정렬된 wordIds)부터 대상으로 삼고,
 * 유형은 5종을 섞어 한 번씩 배정하되 그 단어가 낼 수 없는 유형이면 남은 유형 중 가능한 것을 쓴다.
 */
export function buildReviewQuiz(wordIds: readonly string[], content: Content, dateKey: DateKey): Quiz[] {
  const words = wordIds.map((id) => content.wordsById.get(id)).filter((w): w is Word => Boolean(w));
  if (words.length === 0) return [];
  const ctx = contextOf(content);
  const remaining = shuffle(QUIZ_TYPES, seededRandom(`${dateKey}:review`));
  const quiz: Quiz[] = [];
  for (let i = 0; i < REVIEW_QUIZ_SIZE; i++) {
    const word = words[i % words.length];
    const allowed = allowedTypes(word, ctx);
    const idx = remaining.findIndex((t) => allowed.includes(t));
    const type = idx >= 0 ? remaining.splice(idx, 1)[0] : "meaning_choice";
    // 같은 단어가 두 번 나오면(단어가 5개 미만) 칸 번호로 seed 를 구분
    const seed = quizSeed(dateKey, word.id) + (i >= words.length ? `#${i}` : "");
    quiz.push(generateQuiz(word, type, content.words, seed, ctx));
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
