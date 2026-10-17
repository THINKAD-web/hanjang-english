import { describe, expect, it } from "vitest";
import { checkContent } from "./check";
import { DEFAULT_STEPS, resolveSteps } from "./lesson-steps";
import { meaningChoicePrompt, meaningOf, quizAnswerOf } from "./item-text";
import { normalizeContent, type RawContent } from "./normalize";
import { ItemSchema, PackRulesSchema, RawPackSchema } from "./schema";

const word = (id: string, text: string, meaningKo: string) => ({ id, kind: "word", text, meaningKo, imageable: false, tags: ["t"] });

function miniPack(over: Record<string, unknown> = {}, lessonOver: Record<string, unknown> = {}): RawContent {
  return {
    pack: {
      id: "mini",
      subjectId: "en-kid",
      title: "미니",
      level: "초급",
      levelOrder: 1,
      order: 1,
      ttsLang: "en-US",
      status: "live",
      rules: { itemsPerLesson: 3, sentencesPerLesson: 0, quizPerLesson: 1, allowedQuizTypes: ["meaning_choice"] },
      ...over,
    },
    lessons: [
      {
        order: 1,
        title: "하나",
        type: "vocab",
        items: [word("w1", "apple", "사과"), word("w2", "bee", "벌"), word("w3", "cat", "고양이")],
        quiz: [{ type: "meaning_choice", targetItemId: "w1", prompt: '"사과"는?', options: ["apple", "bee", "cat"], answer: "apple" }],
        ...lessonOver,
      },
    ],
  };
}

describe("normalizeContent", () => {
  it("인라인 items 를 팩 뱅크로 합치고 itemIds·id·steps 를 채운다 (items.json 없이)", () => {
    const { content, errors } = normalizeContent(miniPack());
    expect(errors).toEqual([]);
    expect(content!.items.map((i) => i.id)).toEqual(["w1", "w2", "w3"]);
    const l = content!.lessons[0];
    expect(l.id).toBe("mini-01");
    expect(l.packId).toBe("mini");
    expect(l.itemIds).toEqual(["w1", "w2", "w3"]);
    expect(l.testOnly).toBe(false);
    expect(l.reviewed).toBe(false);
    // intro·문장이 없으니 vocab 기본 steps 에서 건너뛴다
    expect(l.steps).toEqual(["cards", "listen", "quiz"]);
  });

  it("pack.lessonCount 는 계산되고, 적혀 있으면 실제 수와 맞아야 한다", () => {
    expect(normalizeContent(miniPack()).content!.pack.lessonCount).toBe(1);
    expect(normalizeContent(miniPack({ lessonCount: 1 })).errors).toEqual([]);
    expect(normalizeContent(miniPack({ lessonCount: 5 })).errors.join()).toMatch(/레슨 수 1 ≠ pack.lessonCount 5/);
  });

  it("items 와 itemIds 를 같이 쓰면 에러", () => {
    const { errors } = normalizeContent(miniPack({}, { itemIds: ["w1"] }));
    expect(errors.join()).toMatch(/함께 쓸 수 없다/);
  });

  it("같은 id 의 인라인 아이템이 다르게 정의되면 에러, 같으면 합쳐진다", () => {
    const raw = miniPack();
    (raw.lessons as Array<Record<string, unknown>>).push({
      order: 2,
      title: "둘",
      type: "vocab",
      items: [word("w1", "apple", "사과"), word("w2", "bee", "꿀벌"), word("w4", "dog", "개")],
      quiz: [],
    });
    const { errors } = normalizeContent(raw);
    expect(errors.join()).toMatch(/w2 가 다른 정의와 충돌/);
  });

  it("quiz 가 없고 autoQuiz 도 아니면 에러", () => {
    const raw = miniPack({}, { quiz: undefined });
    expect(normalizeContent(raw).errors.join()).toMatch(/quiz 가 없다/);
  });

  it("레슨은 order 순으로 정렬된다", () => {
    const raw = miniPack();
    (raw.lessons as Array<Record<string, unknown>>).unshift({ ...(raw.lessons[0] as object), order: 2, title: "둘" });
    expect(normalizeContent(raw).content!.lessons.map((l) => l.order)).toEqual([1, 2]);
  });
});

describe("checkContent — pack.rules 를 읽는다 (코드에 박힌 숫자 없음)", () => {
  it("rules 를 맞춘 작은 팩은 통과", () => {
    expect(checkContent(miniPack())).toEqual([]);
  });

  it("itemsPerLesson 이 다르면 그 숫자로 에러가 난다", () => {
    const raw = miniPack({ rules: { itemsPerLesson: 4, sentencesPerLesson: 0, quizPerLesson: 1, allowedQuizTypes: ["meaning_choice"] } });
    expect(checkContent(raw).join()).toMatch(/아이템은 정확히 4개 \(현재 3\)/);
  });

  it("allowedQuizTypes 밖의 유형은 거부", () => {
    const raw = miniPack({}, { quiz: [{ type: "ox", targetItemId: "w1", statement: "apple = 사과", answer: true }] });
    expect(checkContent(raw).join()).toMatch(/ox 유형은 이 팩에서 허용되지 않는다/);
  });

  it("quizPerLesson 개수 규칙", () => {
    const raw = miniPack({ rules: { itemsPerLesson: 3, sentencesPerLesson: 0, quizPerLesson: 2, allowedQuizTypes: ["meaning_choice"] } });
    expect(checkContent(raw).join()).toMatch(/퀴즈는 정확히 2개 \(현재 1\)/);
  });

  it("requiredQuizTypes 는 1개씩 요구한다", () => {
    const raw = miniPack({
      rules: { itemsPerLesson: 3, sentencesPerLesson: 0, quizPerLesson: 1, allowedQuizTypes: ["meaning_choice", "ox"], requiredQuizTypes: ["ox"] },
    });
    expect(checkContent(raw).join()).toMatch(/ox 유형은 정확히 1번 \(현재 0\)/);
  });

  it("존재하지 않는 itemId", () => {
    const raw = miniPack({}, { items: undefined, itemIds: ["w1", "w2", "nope"] });
    // 아이템 뱅크(items.json)도 없으므로 전부 없다고 나온다
    expect(checkContent(raw).join()).toMatch(/items.json 에 없는 아이템 nope/);
  });
});

describe("스키마", () => {
  it("rules 기본값 = 예전에 코드에 박혀 있던 숫자 (8단어·문장 2·퀴즈 5)", () => {
    const r = PackRulesSchema.parse({});
    expect(r).toMatchObject({ itemsPerLesson: 8, sentencesPerLesson: 2, quizPerLesson: 5, autoQuiz: false, allowQuizTypeSubstitution: false });
    expect(r.allowedQuizTypes).toHaveLength(5);
  });

  it("pack 은 알 수 없는 필드를 거부하고 access 기본은 free", () => {
    const base = { id: "p", subjectId: "s", title: "t", level: "초급", levelOrder: 1, order: 1, ttsLang: "en-US", status: "live" };
    expect(RawPackSchema.parse(base).access).toBe("free");
    expect(RawPackSchema.safeParse({ ...base, language: "en" }).success).toBe(false);
    expect(RawPackSchema.safeParse({ ...base, ttsLang: "fr-FR" }).success).toBe(false);
  });

  it("아이템 종류별 필수 필드", () => {
    const ok = (x: object) => ItemSchema.safeParse(x).success;
    expect(ok({ id: "a", kind: "word", text: "a" })).toBe(false); // meaningKo 없음
    expect(ok({ id: "a", kind: "word", text: "a", meaningKo: "에이" })).toBe(true);
    expect(ok({ id: "k", kind: "kana", text: "あ" })).toBe(false); // reading 없음
    expect(ok({ id: "k", kind: "kana", text: "あ", reading: "a" })).toBe(true);
    expect(ok({ id: "p", kind: "problem", text: "7 + 5" })).toBe(false); // answer 없음
    expect(ok({ id: "p", kind: "problem", text: "7 + 5", answer: "12" })).toBe(true);
    expect(ok({ id: "i", kind: "word", text: "a", meaningKo: "에이", imageable: true })).toBe(false);
  });
});

describe("아이템 종류별 뜻·정답 헬퍼", () => {
  const w = ItemSchema.parse({ id: "a", kind: "word", text: "dog", meaningKo: "개" });
  const k = ItemSchema.parse({ id: "k", kind: "kana", text: "あ", reading: "a" });
  const p = ItemSchema.parse({ id: "p", kind: "problem", text: "7 + 5", answer: "12" });

  it("meaningOf / quizAnswerOf", () => {
    expect([meaningOf(w), meaningOf(k), meaningOf(p)]).toEqual(["개", "a", "12"]);
    expect([quizAnswerOf(w), quizAnswerOf(k), quizAnswerOf(p)]).toEqual(["dog", "あ", "12"]);
  });

  it("meaning_choice 문구: 한국어 뜻은 조사, 가나는 소리 설명", () => {
    expect(meaningChoicePrompt(w)).toBe('"개"는?');
    expect(meaningChoicePrompt(k)).toBe('"a" 소리가 나는 글자는?');
  });
});

describe("레슨 스텝", () => {
  it("타입별 기본 순서", () => {
    expect(DEFAULT_STEPS.phonics).toEqual(["intro", "cards", "listen", "sentences", "quiz"]);
    expect(DEFAULT_STEPS.math).toEqual(["intro", "practice", "quiz"]);
    expect(DEFAULT_STEPS.grammar).toEqual(["intro", "patterns", "quiz"]);
    expect(DEFAULT_STEPS.listening).toEqual(["intro", "listen", "quiz"]);
  });

  it("intro 가 없으면 intro 를, 문장이 없으면 sentences 를 건너뛴다", () => {
    const intro = { title: "t", content: "c" };
    expect(resolveSteps({ type: "phonics", intro, sentences: [{}] })).toEqual(["intro", "cards", "listen", "sentences", "quiz"]);
    expect(resolveSteps({ type: "phonics", sentences: [{}] })).toEqual(["cards", "listen", "sentences", "quiz"]);
    expect(resolveSteps({ type: "phonics", intro, sentences: [] })).toEqual(["intro", "cards", "listen", "quiz"]);
  });

  it("레슨에 steps 가 있으면 그것을 따른다 (건너뛰기 규칙은 그대로)", () => {
    expect(resolveSteps({ type: "vocab", steps: ["cards", "quiz"], sentences: [] })).toEqual(["cards", "quiz"]);
  });
});
