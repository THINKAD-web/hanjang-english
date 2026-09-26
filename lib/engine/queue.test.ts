import { describe, expect, it } from "vitest";
import type { Attempt } from "@/lib/store/types";
import { activeItems, applyAttempt, dueItems, setReviewEnabled } from "./queue";

function attempt(dateKey: string, answers: [string, boolean][], completed = true): Attempt {
  return {
    id: "x",
    dateKey,
    kind: "review",
    wordIds: answers.map(([id]) => id),
    answers: answers.map(([targetWordId, correct]) => ({ targetWordId, correct })),
    score: answers.filter(([, c]) => c).length,
    startedAt: "",
    completed,
  };
}

describe("applyAttempt", () => {
  it("새로 틀린 단어를 추가한다 (다음 날 복습)", () => {
    expect(applyAttempt([], attempt("2026-09-25", [["g-grow", false]]))).toEqual([
      {
        wordId: "g-grow",
        wrongCount: 1,
        firstWrongDate: "2026-09-25",
        lastWrongDate: "2026-09-25",
        nextReviewDate: "2026-09-26",
        active: true,
      },
    ]);
  });

  it("다시 틀리면 wrongCount+1, 졸업했던 단어도 재활성", () => {
    let q = applyAttempt([], attempt("2026-09-21", [["g-grow", false]]));
    q = applyAttempt(q, attempt("2026-09-22", [["g-grow", true]]));
    expect(q[0].active).toBe(false);
    q = applyAttempt(q, attempt("2026-09-24", [["g-grow", false]]));
    expect(q[0]).toMatchObject({ wrongCount: 2, firstWrongDate: "2026-09-21", lastWrongDate: "2026-09-24", nextReviewDate: "2026-09-25", active: true });
  });

  it("한 시도에서 같은 단어를 틀리고 맞히면 틀린 쪽 우선", () => {
    let q = applyAttempt([], attempt("2026-09-21", [["g-grow", false]]));
    q = applyAttempt(q, attempt("2026-09-22", [["g-grow", true], ["g-grow", false]]));
    expect(q[0]).toMatchObject({ wrongCount: 2, active: true });
  });

  it("완료되지 않은 시도는 반영하지 않는다", () => {
    expect(applyAttempt([], attempt("2026-09-21", [["g-grow", false]], false))).toEqual([]);
  });

  it("큐에 없는 단어를 맞힌 것은 아무 영향 없음", () => {
    expect(applyAttempt([], attempt("2026-09-21", [["g-grow", true]]))).toEqual([]);
  });
});

describe("조회", () => {
  const q = [
    { wordId: "b", wrongCount: 1, firstWrongDate: "2026-09-22", lastWrongDate: "2026-09-22", nextReviewDate: "2026-09-23", active: true },
    { wordId: "a", wrongCount: 1, firstWrongDate: "2026-09-21", lastWrongDate: "2026-09-21", nextReviewDate: "2026-09-22", active: true },
    { wordId: "c", wrongCount: 1, firstWrongDate: "2026-09-21", lastWrongDate: "2026-09-21", nextReviewDate: "2026-09-22", active: false },
  ];

  it("activeItems 는 오래된 순", () => {
    expect(activeItems(q).map((i) => i.wordId)).toEqual(["a", "b"]);
  });

  it("dueItems 는 nextReviewDate ≤ 오늘", () => {
    expect(dueItems(q, "2026-09-22").map((i) => i.wordId)).toEqual(["a"]);
    expect(dueItems(q, "2026-09-23").map((i) => i.wordId)).toEqual(["a", "b"]);
  });

  it("setReviewEnabled OFF/ON", () => {
    expect(setReviewEnabled(q, "a", false).find((i) => i.wordId === "a")?.active).toBe(false);
    expect(setReviewEnabled(q, "c", true).find((i) => i.wordId === "c")?.active).toBe(true);
  });
});
