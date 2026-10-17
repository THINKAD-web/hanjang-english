import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAll, writeBuild } from "./node";
import { publicLessonCount } from "./visibility";
import { ContentNotFoundError, createFetchRepository, type FetchLike } from "./repository";

/** 실제 빌드 산출물을 임시 폴더에 쓰고, 그 파일을 돌려주는 가짜 fetch. */
function fakeFetch(dir: string, counter: { n: number }, failFirst = false): FetchLike {
  return async (url) => {
    counter.n++;
    if (failFirst && counter.n === 1) return { ok: false, status: 503, json: async () => ({}) };
    const file = path.join(dir, url.replace(/^\/content\//, ""));
    try {
      const text = readFileSync(file, "utf8");
      return { ok: true, status: 200, json: async () => JSON.parse(text) };
    } catch {
      return { ok: false, status: 404, json: async () => ({}) };
    }
  };
}

function build() {
  const result = buildAll();
  expect(result.errors).toEqual([]);
  const dir = mkdtempSync(path.join(tmpdir(), "content-build-"));
  writeBuild(result, dir);
  return { result, dir };
}

describe("content build", () => {
  it("같은 입력이면 항상 같은 바이트를 만든다", () => {
    const a = build();
    const b = build();
    const files = (d: string) => [readdirSync(d).sort(), readdirSync(path.join(d, "packs")).sort()];
    expect(files(a.dir)).toEqual(files(b.dir));
    for (const f of ["manifest.json", "packs/en-kid-giyeok.json"]) {
      expect(readFileSync(path.join(a.dir, f), "utf8")).toBe(readFileSync(path.join(b.dir, f), "utf8"));
    }
  });

  it("manifest 는 팩 목록과 계산된 lessonCount 를 담는다", () => {
    const { dir } = build();
    const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const kid = manifest.packs.find((p: { id: string }) => p.id === "en-kid-giyeok");
    expect(kid.lessonCount).toBe(8);
    expect(kid.lessons).toHaveLength(8);
  });
});

describe("ContentRepository — 공개 게이트", () => {
  it("Production: 시드 팩은 목록에도 없고 열 수도 없다. Debug 에서는 열린다", async () => {
    const { dir } = build();
    const prod = createFetchRepository({ fetchImpl: fakeFetch(dir, { n: 0 }), visibility: { debug: false } });
    const ids = (await prod.getManifest()).packs.map((p) => p.id);
    expect(ids).toContain("en-kid-giyeok");
    expect(ids).not.toContain("math-kid-add-1");
    await expect(prod.getPack("math-kid-add-1")).rejects.toBeInstanceOf(ContentNotFoundError);
    await expect(prod.getPack("en-adult-travel")).rejects.toBeInstanceOf(ContentNotFoundError);

    const debug = createFetchRepository({ fetchImpl: fakeFetch(dir, { n: 0 }), visibility: { debug: true } });
    expect((await debug.getManifest()).packs.map((p) => p.id)).toContain("math-kid-add-1");
    expect((await debug.getPack("math-kid-add-1")).lessons).toHaveLength(20);
  });

  it("Production 빌드 산출물에는 시드 팩 파일이 아예 없다 (Debug 빌드에는 있다)", () => {
    const result = buildAll();
    const prod = mkdtempSync(path.join(tmpdir(), "content-prod-"));
    writeBuild(result, prod, { debug: false });
    const files = readdirSync(path.join(prod, "packs"));
    expect(files).toContain("en-kid-giyeok.json");
    expect(files).not.toContain("math-kid-add-1.json");
    expect(files).not.toContain("en-adult-travel.json");
    expect(readFileSync(path.join(prod, "manifest.json"), "utf8")).not.toContain("math-kid-add-1");
    const debug = mkdtempSync(path.join(tmpdir(), "content-debug-"));
    writeBuild(result, debug, { debug: true });
    expect(readdirSync(path.join(debug, "packs"))).toContain("math-kid-add-1.json");
  });

  it("Production: 시드 팩 전부의 공개 레슨 수는 0, 정식 팩은 8", async () => {
    const result = buildAll();
    const exposed = Object.fromEntries(result.contents.map((c) => [c.pack.id, publicLessonCount(c.pack, c.lessons)]));
    for (const id of ["math-kid-add-1", "math-kid-sub-1", "en-kid-animals", "en-adult-travel", "ja-adult-hiragana-1"]) expect(exposed[id]).toBe(0);
    expect(exposed["en-kid-giyeok"]).toBe(8);
  });
});

describe("ContentRepository", () => {
  it("manifest·팩·레슨을 불러오고 같은 요청은 한 번만 보낸다", async () => {
    const { dir } = build();
    const counter = { n: 0 };
    const repo = createFetchRepository({ fetchImpl: fakeFetch(dir, counter) });
    const m = await repo.getManifest();
    expect(m.packs.some((p) => p.id === "en-kid-giyeok")).toBe(true);
    const c1 = await repo.getPack("en-kid-giyeok");
    const c2 = await repo.getPack("en-kid-giyeok");
    expect(c1).toBe(c2);
    expect(c1.itemsById.size).toBe(c1.items.length);
    const lesson = await repo.getLesson("en-kid-giyeok", c1.lessons[0].id);
    expect(lesson.id).toBe(c1.lessons[0].id);
    expect(counter.n).toBe(2); // manifest + 팩 1회
  });

  it("없는 팩·레슨은 ContentNotFoundError", async () => {
    const { dir } = build();
    const repo = createFetchRepository({ fetchImpl: fakeFetch(dir, { n: 0 }) });
    await expect(repo.getPack("no-such-pack")).rejects.toBeInstanceOf(ContentNotFoundError);
    await expect(repo.getLesson("en-kid-giyeok", "nope")).rejects.toBeInstanceOf(ContentNotFoundError);
  });

  it("실패는 기억하지 않고 다시 시도한다", async () => {
    const { dir } = build();
    const repo = createFetchRepository({ fetchImpl: fakeFetch(dir, { n: 0 }, true) });
    await expect(repo.getManifest()).rejects.toThrow(/503/);
    await expect(repo.getManifest()).resolves.toBeDefined();
  });
});
