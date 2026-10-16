import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAll, contentRoot } from "../node";
import { renderReviewMarkdown } from "../review";
import { itemIdFor, parseCsv, planCsv } from "./csv";
import { planImport } from "./import-bundle";
import { applyPlan } from "./plan";
import { planNewPack } from "./scaffold";

function tempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "content-tools-"));
  cpSync(path.join(contentRoot(), "subjects.json"), path.join(root, "subjects.json"));
  mkdirSync(path.join(root, "packs"), { recursive: true });
  return root;
}
const apply = (plan: ReturnType<typeof planCsv>, root: string, dryRun = false) => {
  expect(plan.errors).toEqual([]);
  return applyPlan(plan, root, { dryRun });
};
const lessonFiles = (root: string, packId: string) => readdirSync(path.join(root, "packs", packId, "lessons")).sort();

const csvOf = (n: number, withEmoji = true) =>
  ["text,meaningKo,emoji,tags,imageable,reading", ...Array.from({ length: n }, (_, i) => `word${i + 1},뜻${i + 1},${withEmoji ? "🐶" : ""},t${i % 3}|extra,,`)].join("\n");

function newPack(root: string, id = "en-kid-test") {
  apply(planNewPack(root, { packId: id, subjectId: "en-kid", title: "테스트 팩" }), root);
}
const csvOpts = (over = {}) => ({ packId: "en-kid-test", size: 8, lessonType: "vocab" as const, kind: "word" as const, testOnly: true, forceReviewed: false, ...over });

describe("content:new", () => {
  it("pack.json(soon) 과 빈 items.json 을 만든다", () => {
    const root = tempRoot();
    newPack(root);
    const pack = JSON.parse(readFileSync(path.join(root, "packs/en-kid-test/pack.json"), "utf8"));
    expect(pack).toMatchObject({ id: "en-kid-test", subjectId: "en-kid", status: "soon", ttsLang: "en-US" });
    expect(JSON.parse(readFileSync(path.join(root, "packs/en-kid-test/items.json"), "utf8"))).toEqual([]);
  });

  it("이미 있으면 아무것도 쓰지 않는다 (멱등·덮어쓰기 금지)", () => {
    const root = tempRoot();
    newPack(root);
    const before = readFileSync(path.join(root, "packs/en-kid-test/pack.json"), "utf8");
    const again = planNewPack(root, { packId: "en-kid-test", subjectId: "en-kid", title: "다른 이름" });
    expect(again.files.size).toBe(0);
    expect(again.warnings.join()).toContain("이미 있어");
    expect(readFileSync(path.join(root, "packs/en-kid-test/pack.json"), "utf8")).toBe(before);
  });

  it("없는 과목·나쁜 id 는 에러, --dry-run 은 쓰지 않는다", () => {
    const root = tempRoot();
    expect(planNewPack(root, { packId: "en-kid-test", subjectId: "nope", title: "x" }).errors.join()).toContain("nope");
    expect(planNewPack(root, { packId: "Bad_Id", subjectId: "en-kid", title: "x" }).errors.join()).toContain("소문자");
    const dry = applyPlan(planNewPack(root, { packId: "en-kid-test", subjectId: "en-kid", title: "x" }), root, { dryRun: true });
    expect(dry.written).toHaveLength(2);
    expect(existsSync(path.join(root, "packs/en-kid-test"))).toBe(false);
  });
});

describe("content:csv", () => {
  it("단어 100개 → 레슨 13개 (8×12 + 4), 마지막 레슨 경고 + 규칙 위반", () => {
    const root = tempRoot();
    newPack(root);
    const plan = planCsv(root, csvOf(100), csvOpts());
    expect(plan.errors).toEqual([]);
    expect(plan.warnings.join("\n")).toContain("마지막 레슨(13번)이 아이템 4개뿐");
    expect(plan.warnings.join("\n")).toContain("규칙: ");
    apply(plan, root);
    expect(lessonFiles(root, "en-kid-test")).toHaveLength(13);
    const built = buildAll(root);
    expect(built.errors.some((e) => e.includes("en-kid-test-13: 아이템은 정확히 8개 (현재 4)"))).toBe(true);
    // 마지막 레슨 말고는 규칙 위반이 없다
    expect(built.errors.filter((e) => !e.includes("en-kid-test-13"))).toEqual([]);
  });

  it("단어 96개 → 레슨 12개, content:check 통과 (퀴즈는 자동 생성)", () => {
    const root = tempRoot();
    newPack(root);
    apply(planCsv(root, csvOf(96), csvOpts()), root);
    const built = buildAll(root);
    expect(built.errors).toEqual([]);
    const content = built.contents[0];
    expect(content.pack.lessonCount).toBe(12);
    expect(content.lessons.every((l) => l.testOnly && !l.reviewed && l.quiz.length === 5)).toBe(true);
  });

  it("그림 없는 단어(emoji 열 비움)도 퀴즈가 만들어진다", () => {
    const root = tempRoot();
    newPack(root);
    apply(planCsv(root, csvOf(16, false), csvOpts()), root);
    const built = buildAll(root);
    expect(built.errors).toEqual([]);
    expect(built.contents[0].lessons.flatMap((l) => l.quiz).some((q) => q.type === "picture_choice")).toBe(false);
  });

  it("멱등: 같은 CSV 를 다시 돌리면 바뀌는 파일이 없다", () => {
    const root = tempRoot();
    newPack(root);
    const first = apply(planCsv(root, csvOf(24), csvOpts()), root);
    expect(first.written).toHaveLength(3);
    const second = apply(planCsv(root, csvOf(24), csvOpts()), root);
    expect(second.written).toEqual([]);
    expect(second.unchanged).toHaveLength(3);
  });

  it("--dry-run 은 아무것도 쓰지 않는다", () => {
    const root = tempRoot();
    newPack(root);
    const r = apply(planCsv(root, csvOf(8), csvOpts()), root, true);
    expect(r.written).toHaveLength(1);
    expect(existsSync(path.join(root, "packs/en-kid-test/lessons"))).toBe(false);
  });

  it("검수 완료된 레슨은 --force-reviewed 없이는 바꾸지 않는다", () => {
    const root = tempRoot();
    newPack(root);
    apply(planCsv(root, csvOf(8), csvOpts()), root);
    const file = path.join(root, "packs/en-kid-test/lessons/01.json");
    const lesson = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, JSON.stringify({ ...lesson, reviewed: true }, null, 2) + "\n");
    const changed = csvOf(8).replace("word1,", "wordX,");
    expect(planCsv(root, changed, csvOpts()).errors.join()).toContain("--force-reviewed");
    expect(planCsv(root, changed, csvOpts({ forceReviewed: true })).errors).toEqual([]);
  });

  it("CSV 오류: text 열 없음, 중복 text, 잘못된 imageable, 팩 없음", () => {
    const root = tempRoot();
    newPack(root);
    expect(planCsv(root, "meaningKo\n뜻", csvOpts()).errors.join()).toContain("text 열");
    expect(planCsv(root, "text,meaningKo\ncat,고양이\ncat,고양이", csvOpts()).errors.join()).toContain("중복");
    expect(planCsv(root, "text,meaningKo,emoji,tags,imageable\ncat,고양이,,,maybe", csvOpts()).errors.join()).toContain("imageable");
    expect(planCsv(root, "text,meaningKo\ncat,고양이", csvOpts({ packId: "ghost" })).errors.join()).toContain("content:new");
  });

  it("CSV 파서: 따옴표·쉼표·줄바꿈·BOM", () => {
    expect(parseCsv('﻿text,meaningKo\r\n"a, b","그""것"\n\n"x\ny",z')).toEqual([
      ["text", "meaningKo"],
      ["a, b", '그"것'],
      ["x\ny", "z"],
    ]);
  });

  it("아이템 id: 영문 slug, 비영문은 코드포인트, 겹치면 번호", () => {
    expect(itemIdFor("Ice Cream", new Set())).toBe("ice-cream");
    expect(itemIdFor("あ", new Set())).toBe("u3042");
    expect(itemIdFor("cat", new Set(["cat"]))).toBe("cat-2");
  });
});

describe("content:import", () => {
  const bundle = () => {
    const root = tempRoot();
    newPack(root, "src-pack");
    apply(planCsv(root, csvOf(16), csvOpts({ packId: "src-pack" })), root);
    const dir = path.join(root, "packs/src-pack");
    const read = (f: string) => JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    const pack = { ...read("pack.json"), id: "imported-pack" };
    const lessons = readdirSync(path.join(dir, "lessons")).map((f) => read(`lessons/${f}`));
    return { pack, items: [], lessons };
  };

  it("새 팩 번들을 풀어 넣고, 다시 가져오면 --force 없이는 거부한다", () => {
    const root = tempRoot();
    const b = bundle();
    const first = planImport(root, b, { force: false, forceReviewed: false });
    expect(first.errors).toEqual([]);
    apply(first, root);
    expect(buildAll(root).errors).toEqual([]);
    expect(planImport(root, b, { force: false, forceReviewed: false }).errors.join()).toContain("이미 있다");
  });

  it("--force 로 같은 번들을 다시 가져오면 바뀌는 파일이 없다 (멱등)", () => {
    const root = tempRoot();
    const b = bundle();
    apply(planImport(root, b, { force: false, forceReviewed: false }), root);
    const again = apply(planImport(root, b, { force: true, forceReviewed: false }), root);
    expect(again.written).toEqual([]);
  });

  it("검수 완료된 레슨을 바꾸는 번들은 --force-reviewed 가 있어야 한다", () => {
    const root = tempRoot();
    const b = bundle();
    apply(planImport(root, b, { force: false, forceReviewed: false }), root);
    const file = path.join(root, "packs/imported-pack/lessons/01.json");
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), reviewed: true }, null, 2) + "\n");
    expect(planImport(root, b, { force: true, forceReviewed: false }).errors.join()).toContain("--force-reviewed");
    expect(planImport(root, b, { force: true, forceReviewed: true }).errors).toEqual([]);
  });

  it("규칙을 어기는 번들은 아무것도 쓰지 않는다", () => {
    const root = tempRoot();
    const b = bundle();
    const broken = { ...b, lessons: [{ ...b.lessons[0], items: b.lessons[0].items.slice(0, 5) }, b.lessons[1]] };
    const plan = planImport(root, broken, { force: false, forceReviewed: false });
    expect(plan.errors.join()).toContain("아이템은 정확히 8개");
    expect(plan.files.size).toBe(0);
  });

  it("번들 모양·과목 검증", () => {
    const root = tempRoot();
    expect(planImport(root, { nope: 1 }, { force: false, forceReviewed: false }).errors.join()).toContain("{ pack, items?, lessons");
    const b = bundle();
    const bad = { ...b, pack: { ...b.pack, subjectId: "ghost-subject" } };
    expect(planImport(root, bad, { force: false, forceReviewed: false }).errors.join()).toContain("ghost-subject");
  });
});

describe("content:report", () => {
  it("검수표를 렌더한다", () => {
    const root = tempRoot();
    newPack(root);
    apply(planCsv(root, csvOf(8), csvOpts()), root);
    const md = renderReviewMarkdown(buildAll(root).contents[0]);
    expect(md).toContain("콘텐츠 검수표");
    expect(md).toContain("word1");
  });
});
