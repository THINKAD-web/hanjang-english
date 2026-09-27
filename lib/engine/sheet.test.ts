import { describe, expect, it } from "vitest";
import { initSheet, sheetReducer, sheetScore, wrongItemIds, type SheetAction, type SheetState } from "./sheet";

const run = (actions: SheetAction[], state: SheetState = initSheet(8, 5)) => actions.reduce(sheetReducer, state);
const cards = (n: number): SheetAction[] => Array.from({ length: n }, () => ({ type: "nextCard" }) as const);

describe("sheetReducer", () => {
  it("소리 → 카드 8장 → 전체 듣기 → 예문 → 퀴즈 순서", () => {
    let s = run([{ type: "start" }]);
    expect(s.step).toEqual({ kind: "card", index: 0 });
    s = run(cards(7), s);
    expect(s.step).toEqual({ kind: "card", index: 7 });
    s = run([{ type: "nextCard" }], s);
    expect(s.step).toEqual({ kind: "listenAll" });
    s = run([{ type: "listenAllDone" }], s);
    expect(s.step).toEqual({ kind: "sentences" });
    s = run([{ type: "sentencesDone" }], s);
    expect(s.step).toEqual({ kind: "quiz", index: 0, feedback: null });
  });

  it("전체 듣기는 건너뛸 수 없다: 카드 단계에서 listenAllDone 은 무시", () => {
    const s = run([{ type: "start" }, { type: "listenAllDone" }, { type: "sentencesDone" }]);
    expect(s.step).toEqual({ kind: "card", index: 0 });
  });

  it("퀴즈: 답하면 피드백, 한 문항에 한 번만, 넘기면 다음 문항 → 5문항 뒤 완료", () => {
    let s = run([{ type: "start" }, ...cards(8), { type: "listenAllDone" }, { type: "sentencesDone" }]);
    s = run([{ type: "answer", targetItemId: "g-grass", correct: false, chosen: "glass" }], s);
    expect(s.step).toEqual({ kind: "quiz", index: 0, feedback: { correct: false, chosen: "glass" } });
    // 두 번째 답은 무시
    s = run([{ type: "answer", targetItemId: "g-grass", correct: true, chosen: "grass" }], s);
    expect(s.answers).toHaveLength(1);
    // 피드백 전에는 넘길 수 없다
    s = run([{ type: "advanceQuiz" }], s);
    expect(s.step).toMatchObject({ kind: "quiz", index: 1, feedback: null });
    s = run([{ type: "advanceQuiz" }], s);
    expect(s.step).toMatchObject({ kind: "quiz", index: 1 });

    for (const id of ["g-grow", "g-green", "g-grape", "g-grandma"]) {
      s = run([{ type: "answer", targetItemId: id, correct: true, chosen: "x" }, { type: "advanceQuiz" }], s);
    }
    expect(s.step).toEqual({ kind: "done" });
    expect(sheetScore(s)).toBe(4);
    expect(wrongItemIds(s)).toEqual(["g-grass"]);
  });

  it("intro 가 아니면 start 는 무시", () => {
    const s = run([{ type: "start" }, { type: "nextCard" }, { type: "start" }]);
    expect(s.step).toEqual({ kind: "card", index: 1 });
  });
});
