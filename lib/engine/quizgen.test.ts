import { describe, expect, it } from "vitest";
import { QUIZ_TYPES } from "@/lib/content/schema";
import { addDays } from "./date";
import {
  allowedTypes,
  blankOut,
  buildLessonQuiz,
  buildReviewQuiz,
  generateQuiz,
  pickDistractors,
  quizSeed,
  shuffleSheetOptions,
} from "./quizgen";
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

describe("meaning_choice 조사", () => {
  it.each([
    ["gate", '"대문"은?'],
    ["cold", '"추운"은?'],
    ["gift", '"선물"은?'],
    ["give", '"주다"는?'],
    ["group", '"무리, 모둠"은?'],
    ["glue", '"풀(접착제)"은?'],
  ])("%s → %s", (text, prompt) => {
    const q = generateQuiz(w(text), "meaning_choice", content.words, "s", ctx);
    expect(q.type === "meaning_choice" && q.prompt).toBe(prompt);
  });
});

describe("shuffleSheetOptions (정답 위치)", () => {
  const choiceAnswerIndexes = (dateKey: string) =>
    content.lessons.flatMap((l) =>
      shuffleSheetOptions(l.quiz, dateKey, l.id).flatMap((q) => (q.type === "ox" ? [] : [q.options.indexOf(q.answer)])),
    );

  it("콘텐츠 JSON 은 정답이 늘 첫 보기다 (그래서 셔플이 필요)", () => {
    for (const l of content.lessons)
      for (const q of l.quiz) if (q.type !== "ox") expect(q.options[0]).toBe(q.answer);
  });

  it("정답 위치가 고정되지 않는다: 하루치 32문항에서 세 자리 모두 나온다", () => {
    const idx = choiceAnswerIndexes("2026-09-28");
    expect(idx).toHaveLength(32);
    expect(new Set(idx)).toEqual(new Set([0, 1, 2]));
    // 한 자리에 쏠리지 않는다
    for (const pos of [0, 1, 2]) expect(idx.filter((i) => i === pos).length).toBeLessThan(20);
  });

  it("같은 문항도 날짜가 바뀌면 정답 위치가 바뀐다", () => {
    const l1 = content.lessons[0];
    for (let i = 0; i < 4; i++) {
      const positions = new Set(
        Array.from({ length: 14 }, (_, d) => {
          const q = shuffleSheetOptions(l1.quiz, addDays("2026-09-28", d), l1.id)[i];
          return q.type === "ox" ? -1 : q.options.indexOf(q.answer);
        }),
      );
      expect(positions.size).toBeGreaterThan(1);
    }
  });

  it("같은 날·같은 장이면 같은 순서, 보기 구성과 정답은 그대로", () => {
    const l = content.lessons[3];
    const a = shuffleSheetOptions(l.quiz, "2026-09-28", l.id);
    expect(a).toEqual(shuffleSheetOptions(l.quiz, "2026-09-28", l.id));
    a.forEach((q, i) => {
      const orig = l.quiz[i];
      expect(q.answer).toBe(orig.answer);
      if (q.type !== "ox" && orig.type !== "ox") expect([...q.options].sort()).toEqual([...orig.options].sort());
    });
  });

  it("오답 삽입 문항에도 적용된다", () => {
    const quiz = shuffleSheetOptions(buildLessonQuiz(content.lessons[1], content, "2026-09-28", "g-grow"), "2026-09-28", "giyeok-02");
    expect(quiz[4].targetWordId).toBe("g-grow");
    expect(quiz[4].type !== "ox" && quiz[4].options).toContain("grow");
  });
});
