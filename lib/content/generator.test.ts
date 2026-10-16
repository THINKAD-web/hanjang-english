import { describe, expect, it } from "vitest";
import { evaluate, hasBorrow, hasCarry, parseExpression, verifyProblem } from "./arithmetic";
import { checkContent } from "./check";
import { candidateExpressions, generateProblems } from "./generator";
import { normalizeContent } from "./normalize";
import { GeneratorSchema, type Generator, type Item } from "./schema";

const gen = (over: Partial<Generator>): Generator =>
  GeneratorSchema.parse({ kind: "arithmetic", op: "+", min: 1, max: 9, count: 8, ...over });
const problems = (g: Generator, lessonId = "m-01"): Item[] => {
  const r = generateProblems(g, lessonId);
  if ("error" in r) throw new Error(r.error);
  return r.items;
};
const expr = (it: Item) => parseExpression(it.text)!;

describe("연산 문제 생성기", () => {
  it("모든 정답이 다시 계산해도 맞는다 (+ − × ÷)", () => {
    for (const op of ["+", "-", "×", "÷"] as const) {
      const items = problems(gen({ op, min: 1, max: 12, count: 20 }), `m-${op}`);
      expect(items).toHaveLength(20);
      for (const it of items) {
        expect(evaluate(expr(it))).toBe(Number(it.answer));
        expect(verifyProblem(it)).toBeNull();
        expect(it.kind).toBe("problem");
        expect(it.imageable).toBe(false);
      }
    }
  });

  it("같은 레슨이면 항상 같은 문제, 레슨이 다르면 다른 문제", () => {
    const g = gen({ count: 8 });
    expect(problems(g, "m-01")).toEqual(problems(g, "m-01"));
    expect(problems(g, "m-01").map((i) => i.text)).not.toEqual(problems(g, "m-02").map((i) => i.text));
    expect(problems(gen({ seed: "x" }), "a")).toEqual(problems(gen({ seed: "x" }), "b").map((i, n) => ({ ...i, id: `a-p0${n + 1}` })));
  });

  it("한 레슨 안에서 같은 식(교환 짝 포함)이 두 번 나오지 않는다", () => {
    for (const op of ["+", "×"] as const) {
      const items = problems(gen({ op, min: 1, max: 5, count: 15 }), `u-${op}`);
      const keys = items.map((it) => {
        const { a, b } = expr(it);
        return [a, b].sort().join(",");
      });
      expect(new Set(keys).size).toBe(items.length);
    }
  });

  it("noCarry: 어느 자리도 받아올림이 없다", () => {
    const items = problems(gen({ min: 1, max: 99, count: 30, noCarry: true }));
    for (const it of items) {
      const { a, b } = expr(it);
      expect(hasCarry(a, b)).toBe(false);
      expect(it.tags).not.toContain("carry");
    }
  });

  it("noBorrow: 어느 자리도 받아내림이 없고 답이 음수가 아니다", () => {
    const items = problems(gen({ op: "-", min: 1, max: 99, count: 30, noBorrow: true }));
    for (const it of items) {
      const { a, b } = expr(it);
      expect(a).toBeGreaterThanOrEqual(b);
      expect(hasBorrow(a, b)).toBe(false);
    }
  });

  it("allowNegative=false(기본)면 뺄셈 답이 음수가 아니다, true 면 음수도 나온다", () => {
    expect(problems(gen({ op: "-", min: 1, max: 20, count: 40 })).every((it) => Number(it.answer) >= 0)).toBe(true);
    expect(problems(gen({ op: "-", min: 1, max: 20, count: 100, allowNegative: true })).some((it) => Number(it.answer) < 0)).toBe(true);
  });

  it("받아올림/받아내림이 있는 식에는 약점 태그가 붙는다", () => {
    const add = problems(gen({ min: 5, max: 9, count: 10 }));
    expect(add.every((it) => it.tags.includes("add") && it.tags.includes("carry") === hasCarry(expr(it).a, expr(it).b))).toBe(true);
    const sub = problems(gen({ op: "-", min: 1, max: 30, count: 30 }));
    expect(sub.some((it) => it.tags.includes("borrow"))).toBe(true);
  });

  it("÷ 는 항상 나누어떨어지고 나누는 수는 0 이 아니다", () => {
    for (const it of problems(gen({ op: "÷", min: 0, max: 9, count: 20 }))) {
      const { a, b } = expr(it);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(a % b).toBe(0);
    }
  });

  it("만들 수 있는 식보다 많이 요구하면 에러", () => {
    const r = generateProblems(gen({ min: 1, max: 2, count: 10 }), "tiny");
    expect("error" in r && r.error).toContain("3개뿐");
  });

  it("후보 수 계산: 1~3 덧셈은 교환 짝을 하나로 센다", () => {
    expect(candidateExpressions(gen({ min: 1, max: 3 }))).toHaveLength(6);
  });
});

describe("검산 (content:check)", () => {
  const pack = (rules = {}) => ({
    id: "m",
    subjectId: "math-kid",
    title: "t",
    level: "1",
    levelOrder: 1,
    order: 1,
    ttsLang: "ko-KR",
    status: "soon",
    rules: { itemsPerLesson: 2, sentencesPerLesson: 0, quizPerLesson: 1, allowedQuizTypes: ["fill_blank"], autoQuiz: true, ...rules },
  });
  const lesson = (items: unknown[]) => ({ order: 1, title: "더하기", type: "math", items });

  it("손으로 적은 problem 의 정답이 틀리면 잡는다", () => {
    const bad = lesson([
      { id: "p1", kind: "problem", text: "3 + 4", answer: "7" },
      { id: "p2", kind: "problem", text: "5 + 5", answer: "11" },
    ]);
    expect(checkContent({ pack: pack(), lessons: [bad] }).join("\n")).toContain('"5 + 5" 의 정답은 10 인데');
  });

  it("같은 식이 한 레슨에 두 번 있으면 잡는다", () => {
    const dup = lesson([
      { id: "p1", kind: "problem", text: "3 + 4", answer: "7" },
      { id: "p2", kind: "problem", text: "3+4", answer: "7" },
    ]);
    expect(checkContent({ pack: pack(), lessons: [dup] }).join("\n")).toContain("두 번 나온다");
  });

  it("generator 레슨은 normalize 가 문제를 채우고 통과한다", () => {
    const raw = {
      pack: pack(),
      lessons: [{ order: 1, title: "더하기", type: "math", generator: { kind: "arithmetic", op: "+", min: 1, max: 5, count: 2 } }],
    };
    const r = normalizeContent(raw);
    expect(r.errors).toEqual([]);
    expect(r.content!.items).toHaveLength(2);
    expect(r.content!.lessons[0].quiz).toHaveLength(1);
    expect(checkContent(raw)).toEqual([]);
  });

  it("generator 와 items 를 함께 쓰면 에러", () => {
    const raw = {
      pack: pack(),
      lessons: [
        {
          order: 1,
          title: "x",
          type: "math",
          items: [{ id: "p1", kind: "problem", text: "1 + 1", answer: "2" }],
          generator: { kind: "arithmetic", op: "+", min: 1, max: 5, count: 2 },
        },
      ],
    };
    expect(normalizeContent(raw).errors.join("\n")).toContain("generator 는 items·itemIds 와 함께 쓸 수 없다");
  });
});
