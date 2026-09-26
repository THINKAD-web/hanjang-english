import { describe, expect, it } from "vitest";
import { QUIZ_TYPES } from "@/lib/content/schema";
import { allowedTypes, blankOut, buildReviewQuiz, generateQuiz, pickDistractors, quizSeed } from "./quizgen";
import { seededRandom } from "./rng";
import { content } from "./__fixtures__/state";

const w = (text: string) => content.words.find((x) => x.text === text)!;
const ctx = { sentences: content.lessons.flatMap((l) => l.sentences) };

describe("generateQuiz", () => {
  it("같은 seed 면 같은 문제", () => {
    const seed = quizSeed("2026-09-26", "g-grass");
    for (const type of allowedTypes(w("grass"), ctx)) {
      expect(generateQuiz(w("grass"), type, content.words, seed, ctx)).toEqual(
        generateQuiz(w("grass"), type, content.words, seed, ctx),
      );
    }
  });

  it("보기 3개, 중복 없음, 정답 포함", () => {
    for (const word of content.words) {
      for (const type of allowedTypes(word, ctx)) {
        const q = generateQuiz(word, type, content.words, quizSeed("2026-09-26", word.id), ctx);
        expect(q.targetWordId).toBe(word.id);
        if (q.type === "ox") continue;
        expect(q.options).toHaveLength(3);
        expect(new Set(q.options).size).toBe(3);
        expect(q.options).toContain(q.answer);
        expect(q.answer).toBe(word.text);
      }
    }
  });

  it("imageable: false 단어와 🪿 는 그림 문항 불가", () => {
    expect(allowedTypes(w("ground"), ctx)).not.toContain("picture_choice");
    expect(allowedTypes(w("goose"), ctx)).not.toContain("picture_choice");
    expect(() => generateQuiz(w("ground"), "picture_choice", content.words, "s", ctx)).toThrow();
  });

  it("원형이 든 예문이 없으면 빈칸 문항 불가 (gate), 변형만 있어도 불가 (greet ← greets)", () => {
    expect(allowedTypes(w("gate"), ctx)).not.toContain("fill_blank");
    expect(allowedTypes(w("greet"), ctx)).not.toContain("fill_blank");
    expect(allowedTypes(w("grass"), ctx)).toContain("fill_blank");
  });

  it("빈칸 문장은 원형 자리만 비운다", () => {
    expect(blankOut("The grass is green.", "grass")).toBe("The ____ is green.");
    expect(blankOut("A gray grasshopper jumps on the grass.", "grass")).toBe("A gray grasshopper jumps on the ____.");
    expect(blankOut("I need glasses.", "glass")).toBeNull();
  });

  it("ox 는 대략 50% 확률로 틀린 뜻을 제시하고, 정답이 statement 와 맞다", () => {
    let falseCount = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const word = content.words[i % content.words.length];
      const q = generateQuiz(word, "ox", content.words, `seed${i}`, ctx);
      if (q.type !== "ox") throw new Error();
      expect(q.answer).toBe(q.statement === `${word.text} = ${word.meaning}`);
      if (!q.answer) falseCount++;
    }
    expect(falseCount / N).toBeGreaterThan(0.4);
    expect(falseCount / N).toBeLessThan(0.6);
  });
});

describe("pickDistractors", () => {
  it("같은 sound 태그 + 비슷한 철자를 우선한다", () => {
    const grass = w("grass");
    const picked = pickDistractors(grass, content.words, seededRandom("x"), 2);
    expect(picked).toHaveLength(2);
    for (const d of picked) expect(d.sound).toBe("gr");
  });
});

describe("buildReviewQuiz", () => {
  it("5문항, 유형을 골고루 섞는다", () => {
    const ids = content.lessons[0].wordIds;
    const quiz = buildReviewQuiz(ids, content, "2026-09-26");
    expect(quiz).toHaveLength(5);
    expect(new Set(quiz.map((q) => q.type)).size).toBe(QUIZ_TYPES.length);
    expect(quiz.map((q) => q.targetWordId)).toEqual(ids.slice(0, 5));
  });

  it("그림 불가 단어만 있어도 그림 문항을 내지 않는다", () => {
    const quiz = buildReviewQuiz(["g-ground", "g-group", "g-great", "g-get", "g-give"], content, "2026-09-26");
    expect(quiz.map((q) => q.type)).not.toContain("picture_choice");
  });

  it("단어가 5개 미만이면 돌려가며 5문항", () => {
    const quiz = buildReviewQuiz(["g-grow"], content, "2026-09-26");
    expect(quiz).toHaveLength(5);
    expect(quiz.every((q) => q.targetWordId === "g-grow")).toBe(true);
  });

  it("같은 날이면 같은 문제", () => {
    const ids = ["g-grow", "g-glass", "g-dog"];
    expect(buildReviewQuiz(ids, content, "2026-09-26")).toEqual(buildReviewQuiz(ids, content, "2026-09-26"));
  });
});
