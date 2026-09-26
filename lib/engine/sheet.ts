import type { AnswerRecord } from "@/lib/store/types";

/**
 * 한 장 실행 상태머신 (지시서 3장 sheet: 학습 → 듣기 → 퀴즈 → 완료).
 * 순서: 오늘의 소리 → 단어 카드 N장 → 전체 듣기 → 예문 → 퀴즈 M문항 → 완료.
 * 타이머·음성 같은 부수효과는 UI 가 맡고, 여기서는 단계 전이만 다룬다.
 */

export type SheetStep =
  | { kind: "intro" }
  | { kind: "card"; index: number }
  | { kind: "listenAll" }
  | { kind: "sentences" }
  | { kind: "quiz"; index: number; feedback: QuizFeedback | null }
  | { kind: "done" };

export type QuizFeedback = { correct: boolean; chosen: string | boolean };

export type SheetState = {
  step: SheetStep;
  wordCount: number;
  quizCount: number;
  /** 문항 순서대로의 채점 결과 */
  answers: AnswerRecord[];
};

export type SheetAction =
  | { type: "start" }
  | { type: "nextCard" }
  | { type: "listenAllDone" }
  | { type: "sentencesDone" }
  | { type: "answer"; targetWordId: string; correct: boolean; chosen: string | boolean }
  | { type: "advanceQuiz" };

export function initSheet(wordCount: number, quizCount: number): SheetState {
  return { step: { kind: "intro" }, wordCount, quizCount, answers: [] };
}

export function sheetReducer(state: SheetState, action: SheetAction): SheetState {
  const { step } = state;
  switch (action.type) {
    case "start":
      return step.kind === "intro" ? { ...state, step: { kind: "card", index: 0 } } : state;

    case "nextCard":
      if (step.kind !== "card") return state;
      return {
        ...state,
        step: step.index + 1 < state.wordCount ? { kind: "card", index: step.index + 1 } : { kind: "listenAll" },
      };

    case "listenAllDone":
      return step.kind === "listenAll" ? { ...state, step: { kind: "sentences" } } : state;

    case "sentencesDone":
      return step.kind === "sentences" ? { ...state, step: { kind: "quiz", index: 0, feedback: null } } : state;

    case "answer":
      // 한 문항에 한 번만 답할 수 있다
      if (step.kind !== "quiz" || step.feedback) return state;
      return {
        ...state,
        step: { ...step, feedback: { correct: action.correct, chosen: action.chosen } },
        answers: [...state.answers, { targetWordId: action.targetWordId, correct: action.correct }],
      };

    case "advanceQuiz":
      if (step.kind !== "quiz" || !step.feedback) return state;
      return {
        ...state,
        step: step.index + 1 < state.quizCount ? { kind: "quiz", index: step.index + 1, feedback: null } : { kind: "done" },
      };
  }
}

export function sheetScore(state: SheetState): number {
  return state.answers.filter((a) => a.correct).length;
}

/** 틀린 단어 (중복 제거, 틀린 순서) */
export function wrongWordIds(state: SheetState): string[] {
  const out: string[] = [];
  for (const a of state.answers) if (!a.correct && !out.includes(a.targetWordId)) out.push(a.targetWordId);
  return out;
}
