import { describe, expect, it } from "vitest";
import type { Manifest, ManifestPack } from "./bundle";
import type { Content, Lesson, Pack } from "./schema";
import { isPreRelease, isPublicLesson, publicLessonCount, visibleContent, visibleLessons, visibleManifest } from "./visibility";

const PROD = { debug: false };
const DEBUG = { debug: true };

const lesson = (order: number, reviewed: boolean, testOnly: boolean) => ({ order, reviewed, testOnly });

describe("공개 조건 (live × reviewed × testOnly)", () => {
  // status × reviewed × testOnly 8칸 중 Production 에서 공개되는 것은 live·reviewed·!testOnly 하나뿐
  const cases: [string, "live" | "soon", boolean, boolean, boolean][] = [
    ["live reviewed 정식", "live", true, false, true],
    ["live reviewed testOnly", "live", true, true, false],
    ["live 검수전 정식", "live", false, false, false],
    ["live 검수전 testOnly", "live", false, true, false],
    ["soon reviewed 정식", "soon", true, false, false],
    ["soon reviewed testOnly", "soon", true, true, false],
    ["soon 검수전 정식", "soon", false, false, false],
    ["soon 검수전 testOnly", "soon", false, true, false],
  ];
  it.each(cases)("%s → Production 공개 %s", (_n, status, reviewed, testOnly, expected) => {
    const pack = { status };
    const l = lesson(1, reviewed, testOnly);
    expect(isPublicLesson(pack, l)).toBe(expected);
    expect(visibleLessons(pack, [l], PROD)).toHaveLength(expected ? 1 : 0);
    expect(isPreRelease(pack, l)).toBe(!expected);
  });

  it.each(cases)("%s → Debug 는 항상 열린다", (_n, status, reviewed, testOnly) => {
    expect(visibleLessons({ status }, [lesson(1, reviewed, testOnly)], DEBUG)).toHaveLength(1);
  });
});

describe("일부만 검수된 팩", () => {
  const pack = { status: "live" as const };
  const lessons = [lesson(1, true, false), lesson(2, true, false), lesson(3, true, false), lesson(4, false, false), lesson(5, true, false)];

  it("Production: 처음부터 이어지는 공개 레슨(1~3장)까지만 연다 — 5장이 검수돼 있어도 4장이 막히면 못 간다", () => {
    expect(visibleLessons(pack, lessons, PROD).map((l) => l.order)).toEqual([1, 2, 3]);
    expect(publicLessonCount(pack, lessons)).toBe(3);
  });

  it("1장이 비공개면 뒤가 공개여도 하나도 열리지 않는다", () => {
    expect(visibleLessons(pack, [lesson(1, false, false), lesson(2, true, false)], PROD)).toEqual([]);
  });

  it("order 가 섞여 들어와도 order 순서로 판단한다", () => {
    expect(visibleLessons(pack, [...lessons].reverse(), PROD).map((l) => l.order)).toEqual([1, 2, 3]);
  });

  it("Debug: 전부 열린다", () => {
    expect(visibleLessons(pack, lessons, DEBUG)).toHaveLength(5);
  });
});

const basePack = (over: Partial<Pack>): Pack => ({
  id: "p",
  subjectId: "s",
  title: "t",
  level: "1",
  levelOrder: 1,
  order: 1,
  tagLabel: "소리",
  ttsLang: "en-US",
  status: "live",
  access: "free",
  rules: { itemsPerLesson: 8, sentencesPerLesson: 2, minItemsPerSentence: 2, quizPerLesson: 5, allowedQuizTypes: ["meaning_choice"], allowQuizTypeSubstitution: false, autoQuiz: false },
  lessonCount: 0,
  ...over,
});
const fullLesson = (order: number, reviewed: boolean, testOnly: boolean): Lesson => ({
  id: `p-${order}`,
  packId: "p",
  order,
  title: `l${order}`,
  type: "vocab",
  itemIds: [],
  sentences: [],
  steps: ["quiz"],
  quiz: [],
  reviewed,
  testOnly,
});
const content = (status: "live" | "soon", lessons: Lesson[]): Content => ({
  pack: basePack({ status, lessonCount: lessons.length }),
  items: [],
  itemsById: new Map(),
  lessons,
});

describe("팩 본문", () => {
  it("공개 레슨이 없으면 null (= 없는 팩 취급)", () => {
    expect(visibleContent(content("live", [fullLesson(1, false, true)]), PROD)).toBeNull();
    expect(visibleContent(content("soon", [fullLesson(1, true, false)]), PROD)).toBeNull();
  });

  it("일부만 공개면 레슨을 자르고 lessonCount 도 공개된 수로 맞춘다", () => {
    const c = visibleContent(content("live", [fullLesson(1, true, false), fullLesson(2, false, false)]), PROD)!;
    expect(c.lessons.map((l) => l.order)).toEqual([1]);
    expect(c.pack.lessonCount).toBe(1);
  });

  it("Debug 는 그대로", () => {
    const original = content("live", [fullLesson(1, false, true)]);
    expect(visibleContent(original, DEBUG)).toBe(original);
  });
});

describe("목록(manifest)", () => {
  const mp = (id: string, status: "live" | "soon", lessons: ManifestPack["lessons"]): ManifestPack => ({
    ...basePack({ id, status, lessonCount: lessons.length }),
    lessons,
  });
  const ml = (order: number, reviewed: boolean, testOnly: boolean) => ({ id: `x-${order}`, order, title: "t", type: "vocab" as const, reviewed, testOnly });
  const manifest: Manifest = {
    version: 1,
    subjects: [],
    packs: [
      mp("public", "live", [ml(1, true, false), ml(2, true, false)]),
      mp("seed", "live", [ml(1, false, true)]),
      mp("partial", "live", [ml(1, true, false), ml(2, false, false)]),
      mp("coming", "soon", []),
      mp("coming-with-lessons", "soon", [ml(1, false, true)]),
    ],
  };

  it("Production: 시드(공개 레슨 0)는 목록에서 빠지고, soon 은 준비 중으로 남고, 일부 공개는 공개 수만큼", () => {
    const v = visibleManifest(manifest, PROD);
    expect(v.packs.map((p) => p.id)).toEqual(["public", "partial", "coming", "coming-with-lessons"]);
    expect(v.packs.find((p) => p.id === "partial")!.lessonCount).toBe(1);
    expect(v.packs.find((p) => p.id === "coming-with-lessons")!.lessons).toEqual([]);
  });

  it("Debug: 전부", () => {
    expect(visibleManifest(manifest, DEBUG)).toBe(manifest);
  });
});
