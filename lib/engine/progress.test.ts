import { describe, expect, it } from "vitest";
import {
  homeCta,
  packProgress,
  recordPackInterest,
  recordSheetAbort,
  recordSheetComplete,
  recordSheetStart,
  recordStepTime,
  weekStamps,
} from "./progress";
import { decideToday } from "./today";
import { content, freshState, lessonId, MON, packId, SAT, TUE } from "./__fixtures__/state";

const L1 = content.lessons[0];

function startL1(dateKey = MON) {
  return recordSheetStart(freshState(), { packId, dateKey, lessonId: L1.id, at: `${dateKey}T00:00:00.000Z` });
}

function completeL1(dateKey = MON, answers: { targetItemId: string; correct: boolean }[] = [], finishedAt = `${dateKey}T00:08:00.000Z`) {
  return recordSheetComplete(startL1(dateKey), {
    attemptId: "a1",
    packId,
    dateKey,
    kind: "lesson",
    lessonId: L1.id,
    itemIds: L1.itemIds,
    answers,
    startedAt: `${dateKey}T00:00:00.000Z`,
    finishedAt,
  });
}

describe("recordSheetStart", () => {
  it("Attempt 는 만들지 않고 sheet_start 이벤트만 남긴다", () => {
    const s = startL1();
    expect(s.attempts).toEqual([]);
    expect(s.events).toEqual([
      { profileId: "child", type: "sheet_start", dateKey: MON, at: `${MON}T00:00:00.000Z`, payload: { packId, lessonId: L1.id } },
    ]);
    // 시작만 하고 완료 전이면(=Attempt 없음) 다시 들어와도 같은 장 그대로
    expect(decideToday(s, MON, content)).toEqual({ kind: "lesson", lessonId: L1.id });
  });
});

describe("recordSheetComplete", () => {
  it("완료하면 Attempt·점수·오답 큐·sheet_complete 반영, 다음 날 L2", () => {
    const answers = [
      { targetItemId: "g-grass", correct: false },
      { targetItemId: "g-grow", correct: true },
      { targetItemId: "g-green", correct: true },
      { targetItemId: "g-grape", correct: true },
      { targetItemId: "g-grandma", correct: true },
    ];
    const s = completeL1(MON, answers);
    expect(s.attempts).toHaveLength(1);
    expect(s.attempts[0]).toMatchObject({ completed: true, score: 4, packId, lessonId: L1.id, finishedAt: `${MON}T00:08:00.000Z` });
    expect(s.wrongQueue.map((i) => i.itemId)).toEqual(["g-grass"]);
    expect(s.events.map((e) => e.type)).toEqual(["sheet_start", "sheet_complete"]);
    expect(s.events[1].payload).toMatchObject({ score: 4, total: 5 });
    expect(decideToday(s, MON, content)).toEqual({ kind: "doneToday", canDoExtra: false });
    expect(decideToday(s, TUE, content)).toMatchObject({ kind: "lesson", lessonId: lessonId(2) });
  });
});

describe("recordSheetAbort", () => {
  it("Attempt 를 남기지 않고 sheet_abort 이벤트만 남긴다", () => {
    let s = startL1();
    s = recordSheetAbort(s, { packId, lessonId: L1.id, dateKey: MON, at: `${MON}T00:03:00.000Z`, step: "cards", elapsedMs: 12_000 });
    expect(s.attempts).toEqual([]);
    expect(s.events.map((e) => e.type)).toEqual(["sheet_start", "sheet_abort"]);
    expect(s.events[1].payload).toEqual({ packId, lessonId: L1.id, step: "cards", elapsedMs: 12_000 });
    // 다시 들어와도 같은 장 그대로 (기록이 없으니 처음부터)
    expect(decideToday(s, MON, content)).toEqual({ kind: "lesson", lessonId: L1.id });
  });
});

describe("recordStepTime", () => {
  it("완료 시 단계별 ms 를 이벤트로만 남긴다 (화면엔 안 보임)", () => {
    let s = completeL1();
    s = recordStepTime(s, {
      packId,
      lessonId: L1.id,
      dateKey: MON,
      at: `${MON}T00:08:00.000Z`,
      timings: { sound: 3000, cards: 40000, listen: 15000, sentences: 20000, quiz: 60000 },
    });
    const ev = s.events.find((e) => e.type === "step_time")!;
    expect(ev.payload).toEqual({ packId, lessonId: L1.id, sound: 3000, cards: 40000, listen: 15000, sentences: 20000, quiz: 60000 });
  });
});

describe("recordPackInterest", () => {
  it("자유 payload 로 이벤트만 남긴다", () => {
    const s = recordPackInterest(freshState(), { dateKey: MON, at: `${MON}T00:00:00.000Z`, payload: { unit: "ㄴ" } });
    expect(s.events).toEqual([{ profileId: "child", type: "pack_interest", dateKey: MON, at: `${MON}T00:00:00.000Z`, payload: { unit: "ㄴ" } }]);
  });
});

describe("weekStamps", () => {
  it("월~일 7칸, 완료한 날만 도장, 오늘·미래 표시", () => {
    const s = completeL1(MON);
    const cells = weekStamps(s, TUE, packId);
    expect(cells.map((c) => c.label)).toEqual(["월", "화", "수", "목", "금", "토", "일"]);
    expect(cells.map((c) => c.stamped)).toEqual([true, false, false, false, false, false, false]);
    expect(cells[1].isToday).toBe(true);
    expect(cells[2].isFuture).toBe(true);
  });

  it("시작만 하고 완료하지 않으면 도장이 아니다", () => {
    expect(weekStamps(startL1(MON), MON, packId)[0].stamped).toBe(false);
  });
});

describe("packProgress / homeCta", () => {
  it("완료한 장 수", () => {
    expect(packProgress(freshState(), content)).toEqual({ done: 0, total: 8 });
    expect(packProgress(completeL1(), content)).toEqual({ done: 1, total: 8 });
  });

  it("결정에 따라 버튼 문구가 바뀐다", () => {
    expect(homeCta({ kind: "lesson", lessonId: L1.id }, content)).toEqual({ label: "오늘 한 장 시작", sub: "1장 · gr 소리 ①", enabled: true });
    expect(homeCta({ kind: "doneToday", canDoExtra: false }, content)).toEqual({ label: "오늘 장 끝! 잘했어요", enabled: false });
    expect(homeCta({ kind: "dailyLimit" }, content)).toEqual({ label: "오늘 장 끝! 잘했어요", enabled: false });
    expect(homeCta({ kind: "review", itemIds: [] }, content)).toMatchObject({ label: "복습장", enabled: false });
    expect(homeCta({ kind: "packComplete" }, content).enabled).toBe(false);
  });

  it("주말 첫 사용이면 L1 을 시작할 수 있다", () => {
    expect(homeCta(decideToday(freshState(), SAT, content), content).enabled).toBe(true);
  });
});
