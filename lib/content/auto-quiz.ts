import { allowedTypes, generateQuiz } from "@/lib/engine/quizgen";
import { seededRandom, shuffle } from "@/lib/engine/rng";
import { SUBSTITUTE_FOR_PICTURE, type Item, type PackRules, type Quiz, type QuizType, type Sentence } from "./schema";

/**
 * 퀴즈를 적지 않은 레슨의 퀴즈를 빌드가 만든다 (pack.rules.autoQuiz). 순수 함수·seed 고정 — 같은 입력이면 항상 같은 문제.
 * 문항 하나하나는 화면이 오답 삽입·복습장에서 쓰는 generateQuiz 를 그대로 쓰므로 보기 규칙이 같다.
 *
 * 규칙
 * - 문항 수는 rules.quizPerLesson. 유형은 requiredQuizTypes(있으면)를 먼저 하나씩, 남는 칸은 allowedQuizTypes 를 돌려 채운다.
 * - 대상 아이템은 레슨 아이템을 seed 로 섞은 순서대로, 아직 대상이 아닌 아이템을 우선한다.
 * - imageable: false 아이템은 picture_choice 대상이 되지 않는다. 그림 가능한 아이템이 장에 없고 rules.allowQuizTypeSubstitution 이면
 *   picture_choice 자리를 fill_blank·listen_choice 로 바꾼다 (check.ts 의 구성 규칙과 같다).
 */

export type AutoQuizInput = {
  lessonId: string;
  /** 이 레슨의 아이템 (순서 유지) */
  items: readonly Item[];
  /** 보기 후보 — 팩의 모든 아이템 */
  pool: readonly Item[];
  /** fill_blank 문장 후보 — 이 레슨의 예문 */
  sentences: readonly Sentence[];
  rules: PackRules;
};

export type AutoQuizResult = { quiz: Quiz[] } | { error: string };

function wantedTypes(rules: PackRules, hasImageable: boolean): QuizType[] {
  const required = rules.requiredQuizTypes ?? [];
  // 필수 유형을 따로 정하지 않았다면, 그림 가능한 아이템이 없는 장에서는 그림 문항을 빼고 나머지로 채운다
  let base: QuizType[] = required.length ? [...required] : rules.allowedQuizTypes.filter((t) => hasImageable || t !== "picture_choice");
  if (rules.allowQuizTypeSubstitution && !hasImageable && base.includes("picture_choice")) {
    // picture_choice 한 자리를 fill_blank 나 listen_choice 로 바꾼다. 이미 필수로 들어 있는 두 유형과 합쳐 3칸(각각 1개 이상)이 된다.
    const sub = SUBSTITUTE_FOR_PICTURE.find((t) => rules.allowedQuizTypes.includes(t));
    if (sub) base = base.map((t) => (t === "picture_choice" ? sub : t));
  }
  const out = base.slice(0, rules.quizPerLesson);
  const cycle = rules.allowedQuizTypes.filter((t) => !(t === "picture_choice" && !hasImageable));
  for (let i = 0; out.length < rules.quizPerLesson; i++) out.push(cycle[i % cycle.length]);
  return out;
}

export function buildAutoQuiz(input: AutoQuizInput): AutoQuizResult {
  const { lessonId, items, pool, sentences, rules } = input;
  if (items.length === 0) return { error: `${lessonId}: 아이템이 없어 퀴즈를 만들 수 없다` };
  if (rules.allowedQuizTypes.length === 0) return { error: `${lessonId}: 허용된 퀴즈 유형이 없다` };

  const ctx = { sentences };
  const order = shuffle(items, seededRandom(`${lessonId}:auto-quiz:order`));
  const types = wantedTypes(rules, items.some((it) => it.imageable));
  const used = new Set<string>();
  const quiz: Quiz[] = [];

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const canHost = (it: Item) => allowedTypes(it, ctx, rules).includes(type);
    const host = order.find((it) => !used.has(it.id) && canHost(it)) ?? order.find(canHost);
    if (!host) {
      return { error: `${lessonId}: ${type} 문항을 낼 수 있는 아이템이 이 레슨에 없다 (자동 퀴즈 ${i + 1}번째 칸)` };
    }
    used.add(host.id);
    try {
      quiz.push(generateQuiz(host, type, pool, `${lessonId}:auto-quiz:${i}`, ctx));
    } catch (e) {
      return { error: `${lessonId}: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return { quiz };
}
