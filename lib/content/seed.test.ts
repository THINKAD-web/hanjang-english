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

  it.each(Object.entries(SEEDS))("%s: 레슨·아이템 수가 지시서대로이고 전부 testOnly · 검수 전", (id, spec) => {
    const c = byId.get(id)!;
    expect(c.lessons).toHaveLength(spec.lessons);
    expect(c.lessons.every((l) => l.itemIds.length === spec.perLesson)).toBe(true);
    expect(c.lessons.every((l) => l.testOnly && !l.reviewed)).toBe(true);
  });

  it("Production 에 공개되는 시드 레슨은 0장이다", () => {
    for (const id of Object.keys(SEEDS)) expect(publicLessonCount(byId.get(id)!.pack, byId.get(id)!.lessons)).toBe(0);
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
    expect(plan.errors).toEqual([]);
    expect(plan.files.size).toBeGreaterThan(0);
    expect(applyPlan(plan, contentRoot(), { dryRun: true }).written).toEqual([]);
  });
});
