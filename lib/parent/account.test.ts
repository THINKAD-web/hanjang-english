import { describe, expect, it } from "vitest";
import { buildReviewItemIds, decideToday } from "@/lib/engine/today";
import { activeItems } from "@/lib/engine/queue";
import { content, doLesson, freshState, lessonId, MON, packId, SAT, TUE, WED } from "@/lib/engine/__fixtures__/state";
import { resetProgress, setGrade, setParentPin, toggleWrongReview } from "./account";

describe("PIN·학년 저장", () => {
  it("PIN 해시는 account 에, 학년은 profile 에 저장되고 나머지는 그대로", () => {
    let s = freshState();
    s = setParentPin(s, "abc123");
    s = setGrade(s, 4);
    expect(s.account.pinHash).toBe("abc123");
    expect(s.profiles[0].grade).toBe(4);
    expect(s.attempts).toEqual([]);
    expect(setParentPin(s, "new").account.pinHash).toBe("new");
  });
});

describe("오답 토글 → 다음 날 decideToday·퀴즈 삽입에 반영", () => {
  const base = () => doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grass", "g-grow"] });

  it("기본은 ON: 가장 오래된 오답(g-grass)이 다음 장 5번에 삽입된다", () => {
    expect(decideToday(base(), TUE, content)).toEqual({ kind: "lesson", lessonId: lessonId(2), injectedItemId: "g-grass" });
  });

  it("OFF → active=false, 삽입 대상에서 빠지고 다음 오답이 올라온다", () => {
    const s = toggleWrongReview(base(), packId, "g-grass", false, MON);
    expect(s.wrongQueue.find((i) => i.itemId === "g-grass")?.active).toBe(false);
    expect(activeItems(s.wrongQueue, packId).map((i) => i.itemId)).toEqual(["g-grow"]);
    expect(decideToday(s, TUE, content)).toEqual({ kind: "lesson", lessonId: lessonId(2), injectedItemId: "g-grow" });
  });

  it("전부 OFF 면 삽입 없이 다음 장만", () => {
    let s = toggleWrongReview(base(), packId, "g-grass", false, MON);
    s = toggleWrongReview(s, packId, "g-grow", false, MON);
    expect(decideToday(s, TUE, content)).toEqual({ kind: "lesson", lessonId: lessonId(2) });
  });

  it("다시 ON → active=true 복구, nextReviewDate 는 오늘 기준 다음 날", () => {
    let s = toggleWrongReview(base(), packId, "g-grass", false, MON);
    s = toggleWrongReview(s, packId, "g-grass", true, TUE);
    const item = s.wrongQueue.find((i) => i.itemId === "g-grass")!;
    expect(item.active).toBe(true);
    expect(item.nextReviewDate).toBe(WED);
    // 화요일엔 아직 복습할 때가 아니라서 g-grow 가, 수요일엔 둘 다 대상이 된다
    expect(decideToday(s, TUE, content)).toMatchObject({ kind: "lesson", injectedItemId: "g-grow" });
    expect(decideToday(s, WED, content)).toMatchObject({ kind: "lesson", injectedItemId: "g-grow" });
  });

  it("활성 오답이 3개 이상이면 평일에도 복습장 — 하나를 OFF 하면 복습장이 아니라 다음 장", () => {
    const s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grass", "g-grow", "g-grape"] });
    expect(decideToday(s, TUE, content).kind).toBe("review");
    const off = toggleWrongReview(s, packId, "g-grow", false, MON);
    expect(decideToday(off, TUE, content).kind).toBe("lesson");
  });

  it("OFF 한 단어는 주말 복습장 채우기에서도 빠진다", () => {
    const s = toggleWrongReview(base(), packId, "g-grow", false, MON);
    expect(buildReviewItemIds(s, SAT, content)).not.toContain("g-grow");
  });
});

describe("전체 초기화", () => {
  it("진행 기록만 지우고 PIN·학년은 남긴다", () => {
    let s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow"] });
    s = setGrade(setParentPin(s, "hash"), 4);
    s = { ...s, events: [{ profileId: "child", type: "parent_view", dateKey: MON, at: `${MON}T00:00:00.000Z` }] };
    const r = resetProgress(s);
    expect(r.attempts).toEqual([]);
    expect(r.wrongQueue).toEqual([]);
    expect(r.events).toEqual([]);
    expect(r.account.pinHash).toBe("hash");
    expect(r.profiles[0].grade).toBe(4);
    expect(decideToday(r, MON, content)).toEqual({ kind: "lesson", lessonId: lessonId(1) });
  });
});
