import { describe, expect, it } from "vitest";
import { homeCta, packProgress, recordSheetComplete, recordSheetStart, weekStamps } from "./progress";
import { decideToday } from "./today";
import { content, freshState, lessonId, MON, SAT, TUE } from "./__fixtures__/state";

const L1 = content.lessons[0];

function startL1(dateKey = MON, attemptId = "a1") {
  return recordSheetStart(freshState(), {
    attemptId,
    dateKey,
    kind: "lesson",
    lessonId: L1.id,
    wordIds: L1.wordIds,
    at: `${dateKey}T00:00:00.000Z`,
  });
}

describe("recordSheetStart / recordSheetComplete", () => {
  it("시작하면 미완료 시도 + sheet_start, 이탈 상태면 같은 장을 처음부터", () => {
    const s = startL1();
    expect(s.attempts).toHaveLength(1);
    expect(s.attempts[0]).toMatchObject({ completed: false, lessonId: L1.id, score: 0 });
    expect(s.events.map((e) => e.type)).toEqual(["sheet_start"]);
    expect(decideToday(s, MON, content)).toEqual({ kind: "lesson", lessonId: L1.id });
  });

  it("완료하면 점수·오답 큐·sheet_complete 반영, 다음 날 L2", () => {
    const answers = [
      { targetWordId: "g-grass", correct: false },
      { targetWordId: "g-grow", correct: true },
      { targetWordId: "g-green", correct: true },
      { targetWordId: "g-grape", correct: true },
      { targetWordId: "g-grandma", correct: true },
    ];
    const s = recordSheetComplete(startL1(), "a1", answers, `${MON}T00:08:00.000Z`);
    expect(s.attempts[0]).toMatchObject({ completed: true, score: 4, finishedAt: `${MON}T00:08:00.000Z` });
    expect(s.wrongQueue.map((i) => i.wordId)).toEqual(["g-grass"]);
    expect(s.events.map((e) => e.type)).toEqual(["sheet_start", "sheet_complete"]);
    expect(s.events[1].payload).toMatchObject({ score: 4, total: 5 });
    expect(decideToday(s, MON, content)).toEqual({ kind: "doneToday", canDoExtra: false });
    expect(decideToday(s, TUE, content)).toMatchObject({ kind: "lesson", lessonId: lessonId(2) });
  });

  it("같은 시도를 두 번 완료해도 한 번만 반영", () => {
    const answers = [{ targetWordId: "g-grass", correct: false }];
    let s = recordSheetComplete(startL1(), "a1", answers, "t");
    s = recordSheetComplete(s, "a1", answers, "t");
    expect(s.events.filter((e) => e.type === "sheet_complete")).toHaveLength(1);
    expect(s.wrongQueue[0].wrongCount).toBe(1);
  });
});

describe("weekStamps", () => {
  it("월~일 7칸, 완료한 날만 도장, 오늘·미래 표시", () => {
    const s = recordSheetComplete(startL1(MON), "a1", [], "t");
    const cells = weekStamps(s, TUE);
    expect(cells.map((c) => c.label)).toEqual(["월", "화", "수", "목", "금", "토", "일"]);
    expect(cells.map((c) => c.stamped)).toEqual([true, false, false, false, false, false, false]);
    expect(cells[1].isToday).toBe(true);
    expect(cells[2].isFuture).toBe(true);
  });

  it("미완료 시도는 도장이 아니다", () => {
    expect(weekStamps(startL1(MON), MON)[0].stamped).toBe(false);
  });
});

describe("packProgress / homeCta", () => {
  it("완료한 장 수", () => {
    expect(packProgress(freshState(), content)).toEqual({ done: 0, total: 8 });
    const s = recordSheetComplete(startL1(), "a1", [], "t");
    expect(packProgress(s, content)).toEqual({ done: 1, total: 8 });
  });

  it("결정에 따라 버튼 문구가 바뀐다", () => {
    expect(homeCta({ kind: "lesson", lessonId: L1.id }, content)).toEqual({ label: "오늘 한 장 시작", sub: "1장 · gr 소리 ①", enabled: true });
    expect(homeCta({ kind: "doneToday", canDoExtra: false }, content).enabled).toBe(false);
    expect(homeCta({ kind: "dailyLimit" }, content).enabled).toBe(false);
    expect(homeCta({ kind: "review", wordIds: [] }, content)).toMatchObject({ label: "복습장", enabled: false });
    expect(homeCta({ kind: "packComplete" }, content).enabled).toBe(false);
  });

  it("주말 첫 사용이면 L1 을 시작할 수 있다", () => {
    expect(homeCta(decideToday(freshState(), SAT, content), content).enabled).toBe(true);
  });
});
