import { describe, expect, it } from "vitest";
import { readSubjects } from "./node";
import { buildAll, contentRoot } from "./node";
import { publicLessonCount } from "./visibility";

/** 베타 UI 테스트용 — Production 에서 열리는 팩이 어린이·성인 각각 충분한지 */
describe("베타 카탈로그 (Production 공개)", () => {
  const { contents } = buildAll();
  const subjects = readSubjects(contentRoot());
  const kidSubjectIds = new Set(subjects.filter((s) => s.audience === "kid").map((s) => s.id));
  const adultSubjectIds = new Set(subjects.filter((s) => s.audience === "adult").map((s) => s.id));

  const openPacks = contents
    .map((c) => ({ id: c.pack.id, subjectId: c.pack.subjectId, n: publicLessonCount(c.pack, c.lessons) }))
    .filter((p) => p.n > 0);

  it("어린이·성인 각각 10개 내외 팩이 Production 에서 열린다", () => {
    const kid = openPacks.filter((p) => kidSubjectIds.has(p.subjectId));
    const adult = openPacks.filter((p) => adultSubjectIds.has(p.subjectId));
    expect(kid.length).toBeGreaterThanOrEqual(10);
    expect(adult.length).toBeGreaterThanOrEqual(10);
  });

  it("en-kid-giyeok 공개 8장은 유지", () => {
    expect(openPacks.find((p) => p.id === "en-kid-giyeok")?.n).toBe(8);
  });
});
