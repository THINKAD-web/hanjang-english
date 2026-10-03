import { describe, expect, it } from "vitest";
import { completeLessonsUpTo } from "./debug-actions";
import { completedLessonIds, decideToday } from "@/lib/engine/today";
import { content, freshState, lessonId, packId, SAT, TUE } from "@/lib/engine/__fixtures__/state";

describe("디버그: N장까지 완료 처리", () => {
  it("8장 → 전부 완료, 오늘(평일)은 packComplete", () => {
    const s = completeLessonsUpTo(freshState(), content, 8, TUE);
    expect(completedLessonIds(s, packId)).toHaveLength(8);
    expect(s.attempts.every((a) => a.completed && a.score === a.answers.length)).toBe(true);
    expect(s.wrongQueue).toEqual([]);
    expect(decideToday(s, TUE, content)).toEqual({ kind: "packComplete" });
  });

  it("N장까지만: 다음 장이 오늘 할 일, 하루 한도에 걸리지 않는다", () => {
    const s = completeLessonsUpTo(freshState(), content, 3, TUE);
    expect(completedLessonIds(s, packId)).toEqual([lessonId(1), lessonId(2), lessonId(3)]);
    expect(s.attempts.some((a) => a.dateKey === TUE)).toBe(false);
    expect(decideToday(s, TUE, content)).toEqual({ kind: "lesson", lessonId: lessonId(4) });
  });

  it("장마다 서로 다른 날짜(오늘 이전)에 둔다", () => {
    const s = completeLessonsUpTo(freshState(), content, 4, TUE);
    const days = s.attempts.map((a) => a.dateKey);
    expect(new Set(days).size).toBe(4);
    expect(days.every((d) => d < TUE)).toBe(true);
    expect(days).toEqual([...days].sort());
  });

  it("이미 끝낸 장은 다시 넣지 않고, 더 큰 N 으로 이어서 채운다", () => {
    const three = completeLessonsUpTo(freshState(), content, 3, TUE);
    expect(completeLessonsUpTo(three, content, 3, TUE)).toBe(three);
    expect(completeLessonsUpTo(three, content, 2, TUE)).toBe(three);
    const five = completeLessonsUpTo(three, content, 5, TUE);
    expect(completedLessonIds(five, packId)).toHaveLength(5);
    expect(new Set(five.attempts.map((a) => a.id)).size).toBe(5);
  });

  it("주의: 주말에는 엔진 규칙(판단 3)상 8장을 다 끝내도 팩 완료가 아니라 복습장이 나온다", () => {
    const s = completeLessonsUpTo(freshState(), content, 8, SAT);
    expect(decideToday(s, SAT, content).kind).toBe("review");
  });

  it("이벤트는 남기지 않는다", () => {
    expect(completeLessonsUpTo(freshState(), content, 8, TUE).events).toEqual([]);
  });
});
