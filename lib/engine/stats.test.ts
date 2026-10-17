import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/store/types";
import { recordSheetComplete } from "./progress";
import { earnedBadges, learningStreak, studyMinutesFromEvents } from "./stats";

describe("learningStreak", () => {
  const base = createInitialState("en-kid-giyeok");

  it("완료 Attempt 가 없으면 0", () => {
    expect(learningStreak(base, "2026-10-17")).toBe(0);
  });

  it("연속된 날짜만 센다", () => {
    let s = base;
    for (const d of ["2026-10-15", "2026-10-16", "2026-10-17"]) {
      s = recordSheetComplete(s, {
        attemptId: `a-${d}`,
        packId: "en-kid-giyeok",
        dateKey: d,
        kind: "lesson",
        lessonId: "en-kid-giyeok-01",
        itemIds: [],
        answers: [{ targetItemId: "x", correct: true }],
        startedAt: `${d}T00:00:00.000Z`,
        finishedAt: `${d}T00:08:00.000Z`,
      });
    }
    expect(learningStreak(s, "2026-10-17")).toBe(3);
    expect(learningStreak(s, "2026-10-18")).toBe(3);
  });

  it("review Attempt 만 있는 날은 스트릭에 넣지 않는다", () => {
    const s = recordSheetComplete(createInitialState("en-kid-giyeok"), {
      attemptId: "r1",
      packId: "en-kid-giyeok",
      dateKey: "2026-10-17",
      kind: "review",
      itemIds: ["w1"],
      answers: [{ targetItemId: "w1", correct: true }],
      startedAt: "2026-10-17T00:00:00.000Z",
      finishedAt: "2026-10-17T00:08:00.000Z",
    });
    expect(learningStreak(s, "2026-10-17")).toBe(0);
  });
});

describe("studyMinutesFromEvents", () => {
  it("step_time ms 를 분으로 합산한다", () => {
    const s = {
      ...createInitialState("en-kid-giyeok"),
      events: [
        {
          profileId: "child",
          type: "step_time" as const,
          dateKey: "2026-10-17",
          at: "2026-10-17T00:00:00.000Z",
          payload: { packId: "en-kid-giyeok", quiz: 120_000, cards: 60_000 },
        },
      ],
    };
    expect(studyMinutesFromEvents(s, "2026-10-17", "en-kid-giyeok")).toBe(3);
  });
});

describe("earnedBadges", () => {
  it("첫 장 완료 배지", () => {
    const s = recordSheetComplete(createInitialState("en-kid-giyeok"), {
      attemptId: "a1",
      packId: "en-kid-giyeok",
      dateKey: "2026-10-17",
      kind: "lesson",
      lessonId: "en-kid-giyeok-01",
      itemIds: ["w1"],
      answers: [{ targetItemId: "w1", correct: true }],
      startedAt: "2026-10-17T00:00:00.000Z",
      finishedAt: "2026-10-17T00:08:00.000Z",
    });
    expect(earnedBadges(s, "2026-10-17", "en-kid-giyeok")).toContain("first_lesson");
    expect(earnedBadges(s, "2026-10-17", "en-kid-giyeok")).toContain("perfect_lesson");
  });
});
