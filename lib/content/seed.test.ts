import { describe, expect, it } from "vitest";
import { buildAll } from "./node";
import { applyPlan } from "./tools/plan";
import { planSeed } from "./tools/seed";
import { contentRoot } from "./node";
import { publicLessonCount } from "./visibility";

const SEEDS = {
  "math-kid-add-1": { lessons: 20, perLesson: 8 },
  "math-kid-sub-1": { lessons: 20, perLesson: 8 },
  "en-kid-animals": { lessons: 4, perLesson: 8 },
  "en-adult-travel": { lessons: 8, perLesson: 8 },
  "ja-adult-hiragana-1": { lessons: 10, perLesson: 5 },
} as const;

describe("시드 팩 5개", () => {
  const { contents, errors } = buildAll();
  const byId = new Map(contents.map((c) => [c.pack.id, c]));

  it("content:check 규칙을 모두 통과한다", () => {
    expect(errors).toEqual([]);
  });

  it.each(Object.entries(SEEDS))("%s: 레슨·아이템 수가 지시서대로이다", (id, spec) => {
    const c = byId.get(id)!;
    expect(c.lessons).toHaveLength(spec.lessons);
    expect(c.lessons.every((l) => l.itemIds.length === spec.perLesson)).toBe(true);
  });

  it("시드 팩 중 아직 베타 공개 전 레슨은 testOnly · 검수 전", () => {
    for (const [id, spec] of Object.entries(SEEDS)) {
      const c = byId.get(id)!;
      const sorted = [...c.lessons].sort((a, b) => a.order - b.order);
      const openHead =
        id === "math-kid-add-1"
          ? 10
          : id === "en-adult-travel"
            ? 5
            : id === "ja-adult-hiragana-1"
              ? 5
              : id === "en-kid-animals"
                ? 3
                : id === "math-kid-sub-1"
                  ? 3
                  : 0;
      if (openHead > 0) {
        expect(sorted.slice(0, openHead).every((l) => l.reviewed && !l.testOnly)).toBe(true);
        expect(sorted.slice(openHead).every((l) => !l.reviewed && l.testOnly)).toBe(true);
      } else {
        expect(sorted.every((l) => l.testOnly && !l.reviewed)).toBe(true);
      }
      expect(spec.lessons).toBeGreaterThan(0);
    }
  });

  it("math-kid-add-1: 앞 10장만 베타 공개(reviewed · testOnly 아님)", () => {
    const c = byId.get("math-kid-add-1")!;
    const sorted = [...c.lessons].sort((a, b) => a.order - b.order);
    expect(sorted.slice(0, 10).every((l) => l.reviewed && !l.testOnly)).toBe(true);
    expect(sorted.slice(10).every((l) => !l.reviewed && l.testOnly)).toBe(true);
    expect(publicLessonCount(c.pack, c.lessons)).toBe(10);
  });

  it("Production 에 공개되는 시드 레슨 수", () => {
    const expected: Record<string, number> = {
      "math-kid-add-1": 10,
      "en-adult-travel": 5,
      "ja-adult-hiragana-1": 5,
      "math-kid-sub-1": 3,
      "en-kid-animals": 3,
    };
    for (const id of Object.keys(SEEDS)) {
      expect(publicLessonCount(byId.get(id)!.pack, byId.get(id)!.lessons)).toBe(expected[id]);
    }
  });

  it("영어 단어 팩 32개 · 히라가나 46자 + 낱말 4개", () => {
    expect(byId.get("en-kid-animals")!.items).toHaveLength(32);
    const hira = byId.get("ja-adult-hiragana-1")!;
    expect(hira.items.filter((i) => i.kind === "kana")).toHaveLength(46);
    expect(hira.items.filter((i) => i.kind === "word")).toHaveLength(4);
    expect(hira.items.filter((i) => i.kind === "kana").every((i) => i.reading)).toBe(true);
    expect(hira.pack.ttsLang).toBe("ja-JP");
  });

  it("수학 시드: 모든 문제 정답이 맞고 받아올림/내림 조건을 지킨다", () => {
    for (const id of ["math-kid-add-1", "math-kid-sub-1"]) {
      for (const it of byId.get(id)!.items) {
        const m = /^(\d+) ([+-]) (\d+)$/.exec(it.text)!;
        const [a, b] = [Number(m[1]), Number(m[3])];
        expect(Number(it.answer)).toBe(m[2] === "+" ? a + b : a - b);
        expect(Number(it.answer)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("content:seed 는 멱등 — 이미 만들어진 파일은 바뀌지 않는다", () => {
    const plan = planSeed(contentRoot());
    expect(plan.errors.length).toBeGreaterThan(0);
    expect(plan.errors.every((e) => e.includes("검수 완료(reviewed: true)"))).toBe(true);
    expect(applyPlan(plan, contentRoot(), { dryRun: true }).written).toEqual([]);
  });
});
