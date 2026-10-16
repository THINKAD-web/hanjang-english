import { describe, expect, it } from "vitest";
import { initSheet, sheetProgress, sheetReducer, sheetScore, wrongItemIds, type SheetAction, type SheetState } from "./sheet";

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

describe("계획(plan) 기반 단계", () => {
  const states = (s: SheetState, actions: SheetAction[]) => actions.map((a) => (s = sheetReducer(s, a)).step.kind);

  it("math: 소리 → 연습 N문제 → 퀴즈 (카드·듣기·예문 없음)", () => {
    const s = initSheet(3, 2, { plan: ["intro", "practice", "quiz"], practiceCount: 3 });
    expect(states(s, [{ type: "start" }, { type: "nextPractice" }, { type: "nextPractice" }, { type: "nextPractice" }])).toEqual([
      "practice",
      "practice",
      "practice",
      "quiz",
    ]);
  });

  it("grammar: 소리 → 패턴 N개 → 퀴즈", () => {
    const s = initSheet(2, 1, { plan: ["intro", "patterns", "quiz"], patternCount: 2 });
    expect(states(s, [{ type: "start" }, { type: "nextPattern" }, { type: "nextPattern" }])).toEqual(["patterns", "patterns", "quiz"]);
  });

  it("listening: 소리 → 전체 듣기 → 퀴즈", () => {
    const s = initSheet(4, 1, { plan: ["intro", "listen", "quiz"] });
    expect(states(s, [{ type: "start" }, { type: "listenAllDone" }])).toEqual(["listenAll", "quiz"]);
  });

  it("intro 가 없는 계획도 맨 앞에 시작 화면(intro)을 둔다 — iOS 음성 허용 탭이 필요하다", () => {
    const s = initSheet(2, 1, { plan: ["cards", "quiz"] });
    expect(s.step).toEqual({ kind: "intro" });
    expect(s.plan).toEqual(["intro", "cards", "quiz"]);
  });

  it("비어 있는 단계는 건너뛴다 (연습할 문제 0개면 바로 퀴즈)", () => {
    const s = initSheet(0, 2, { plan: ["intro", "practice", "quiz"], practiceCount: 0 });
    expect(sheetReducer(s, { type: "start" }).step).toEqual({ kind: "quiz", index: 0, feedback: null });
  });

  it("퀴즈가 마지막이 아니어도 퀴즈 뒤 단계로 이어진다", () => {
    let s = initSheet(1, 1, { plan: ["intro", "quiz", "sentences"] });
    s = run([{ type: "start" }, { type: "answer", targetItemId: "x", correct: true, chosen: "x" }, { type: "advanceQuiz" }], s);
    expect(s.step).toEqual({ kind: "sentences" });
  });

  it("진행 바 비율: 예전 고정 순서와 같은 값", () => {
    // 소리 1 + 카드 8 + 듣기 1 + 예문 1 + 퀴즈 5 = 16
    let s = initSheet(8, 5);
    expect(sheetProgress(s)).toBe(0);
    s = run([{ type: "start" }], s);
    expect(sheetProgress(s)).toBe(1 / 16);
    s = run([...cards(7), { type: "nextCard" }], s);
    expect(sheetProgress(s)).toBe(9 / 16);
    s = run([{ type: "listenAllDone" }], s);
    expect(sheetProgress(s)).toBe(10 / 16);
    s = run([{ type: "sentencesDone" }], s);
    expect(sheetProgress(s)).toBe(11 / 16);
  });
});
