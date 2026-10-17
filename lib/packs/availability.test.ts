import { describe, expect, it } from "vitest";
import type { Content, Lesson, Pack } from "@/lib/content/schema";
import type { Loadable } from "@/lib/content/use-content";
import { packUnavailable } from "./availability";

const PROD = { debug: false };
const DEBUG = { debug: true };

const pack = (status: "live" | "soon"): Pack =>
  ({
    id: "p",
    subjectId: "s",
    title: "t",
    level: "1",
    levelOrder: 1,
    order: 1,
    tagLabel: "소리",
    ttsLang: "en-US",
    status,
    access: "free",
    lessonCount: 1,
  }) as Pack;
const lesson = { id: "p-01", order: 1 } as Lesson;
const ready = (status: "live" | "soon", lessons: Lesson[]): Loadable<Content> => ({
  status: "ready",
  data: { pack: pack(status), items: [], itemsById: new Map(), lessons },
});

describe("빈 콘텐츠 방어 — 이런 팩은 앱이 터지지 않고 /packs 로 보낸다", () => {
  it("알 수 없는 packId (콘텐츠를 못 찾음)", () => {
    expect(packUnavailable({ status: "missing" }, false, PROD)).toBe(true);
    expect(packUnavailable({ status: "missing" }, false, DEBUG)).toBe(true);
  });

  it("레슨이 0개인 팩", () => {
    expect(packUnavailable(ready("live", []), false, PROD)).toBe(true);
    expect(packUnavailable(ready("live", []), false, DEBUG)).toBe(true);
  });

  it("준비 중(soon) 팩: Production 은 돌려보내고, Debug 는 레슨이 있으면 열어 준다", () => {
    expect(packUnavailable(ready("soon", [lesson]), false, PROD)).toBe(true);
    expect(packUnavailable(ready("soon", [lesson]), false, DEBUG)).toBe(false);
    expect(packUnavailable(ready("soon", []), false, DEBUG)).toBe(true);
  });

  it("아직 잠긴 팩", () => {
    expect(packUnavailable(ready("live", [lesson]), true, PROD)).toBe(true);
  });

  it("정상 팩은 열리고, 불러오는 중·실패는 '열 수 없음' 이 아니다", () => {
    expect(packUnavailable(ready("live", [lesson]), false, PROD)).toBe(false);
    expect(packUnavailable({ status: "loading" }, false, PROD)).toBe(false);
    expect(packUnavailable({ status: "error", error: new Error("x") }, false, PROD)).toBe(false);
  });
});
