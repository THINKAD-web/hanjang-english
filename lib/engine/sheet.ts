import type { StepType } from "@/lib/content/schema";
import type { AnswerRecord } from "@/lib/store/types";

/**
 * 한 장 실행 상태머신. 어떤 단계를 어떤 순서로 거치는지는 `plan`(StepType 목록)이 정한다 —
 * phonics/vocab 은 소리 → 카드 N장 → 전체 듣기 → 예문 → 퀴즈, math 는 소리 → 연습 → 퀴즈처럼
 * 레슨 타입이 고른 목록을 그대로 따른다. 타이머·음성 같은 부수효과는 UI 가 맡고, 여기서는 단계 전이만 다룬다.
 */

export type SheetStep =
  | { kind: "intro" }
  | { kind: "card"; index: number }
  | { kind: "listenAll" }
  | { kind: "sentences" }
  | { kind: "practice"; index: number }
  | { kind: "patterns"; index: number }
  | { kind: "quiz"; index: number; feedback: QuizFeedback | null }
  | { kind: "done" };

export type QuizFeedback = { correct: boolean; chosen: string | boolean };

export type SheetState = {
  step: SheetStep;
  /** 거칠 단계 순서. intro 는 "시작" 버튼 화면(소리를 켜는 탭)이라 실행기가 항상 맨 앞에 둔다. */
  plan: readonly StepType[];
  itemCount: number;
  quizCount: number;
  /** practice 단계의 문제 수 (기본 0) */
  practiceCount: number;
  /** patterns 단계의 패턴(아이템) 수 (기본 0) */
  patternCount: number;
  /** 문항 순서대로의 채점 결과 */
  answers: AnswerRecord[];
};

export type SheetAction =
  | { type: "start" }
  | { type: "nextCard" }
  | { type: "listenAllDone" }
  | { type: "sentencesDone" }
  | { type: "nextPractice" }
  | { type: "nextPattern" }
  | {
      type: "answer";
      targetItemId: string;
      correct: boolean;
      chosen: string | boolean;
    }
  | { type: "advanceQuiz" };

/** 예전 고정 순서: 소리 → 카드 → 전체 듣기 → 예문 → 퀴즈 (en-kid-giyeok 과 같다) */
export const CLASSIC_PLAN: readonly StepType[] = ["intro", "cards", "listen", "sentences", "quiz"];

type Sizes = Pick<SheetState, "itemCount" | "quizCount" | "practiceCount" | "patternCount">;

/** `type` 단계의 첫 화면. 그 단계가 비어 있으면 건너뛰고 다음 단계로. */
function enter(plan: readonly StepType[], from: number, sizes: Sizes): SheetStep {
  for (let i = from; i < plan.length; i++) {
    switch (plan[i]) {
      case "intro":
        return { kind: "intro" };
      case "cards":
        if (sizes.itemCount > 0) return { kind: "card", index: 0 };
        break;
      case "listen":
        if (sizes.itemCount > 0) return { kind: "listenAll" };
        break;
      case "sentences":
        return { kind: "sentences" };
      case "practice":
        if (sizes.practiceCount > 0) return { kind: "practice", index: 0 };
        break;
      case "patterns":
        if (sizes.patternCount > 0) return { kind: "patterns", index: 0 };
        break;
      case "quiz":
        if (sizes.quizCount > 0) return { kind: "quiz", index: 0, feedback: null };
        break;
    }
  }
  return { kind: "done" };
}

/** 지금 단계(type) 다음 단계로. */
function after(state: SheetState, type: StepType): SheetStep {
  const at = state.plan.indexOf(type);
  return enter(state.plan, at < 0 ? state.plan.length : at + 1, state);
}

export type SheetOptions = {
  plan?: readonly StepType[];
  practiceCount?: number;
  patternCount?: number;
};

export function initSheet(itemCount: number, quizCount: number, opts: SheetOptions = {}): SheetState {
  const requested = opts.plan ?? CLASSIC_PLAN;
  const plan = requested.includes("intro") ? requested : (["intro", ...requested] as StepType[]);
  const sizes: Sizes = {
    itemCount,
    quizCount,
    practiceCount: opts.practiceCount ?? 0,
    patternCount: opts.patternCount ?? 0,
  };
  return { step: { kind: "intro" }, plan, ...sizes, answers: [] };
}

/** 복습장: "오늘의 소리" 없이 단어 카드부터 바로 시작하고, 전체 듣기·예문도 건너뛴다. */
export function initReviewSheet(itemCount: number, quizCount: number): SheetState {
  const plan: readonly StepType[] = ["cards", "quiz"];
  const sizes: Sizes = {
    itemCount,
    quizCount,
    practiceCount: 0,
    patternCount: 0,
  };
  return { step: enter(plan, 0, sizes), plan, ...sizes, answers: [] };
}

export function sheetReducer(state: SheetState, action: SheetAction): SheetState {
  const { step } = state;
  switch (action.type) {
    case "start":
      return step.kind === "intro" ? { ...state, step: after(state, "intro") } : state;

    case "nextCard":
      if (step.kind !== "card") return state;
      if (step.index + 1 < state.itemCount) return { ...state, step: { kind: "card", index: step.index + 1 } };
      return { ...state, step: after(state, "cards") };

    case "listenAllDone":
      return step.kind === "listenAll" ? { ...state, step: after(state, "listen") } : state;

    case "sentencesDone":
      return step.kind === "sentences" ? { ...state, step: after(state, "sentences") } : state;

    case "nextPractice":
      if (step.kind !== "practice") return state;
      if (step.index + 1 < state.practiceCount) return { ...state, step: { kind: "practice", index: step.index + 1 } };
      return { ...state, step: after(state, "practice") };

    case "nextPattern":
      if (step.kind !== "patterns") return state;
      if (step.index + 1 < state.patternCount) return { ...state, step: { kind: "patterns", index: step.index + 1 } };
      return { ...state, step: after(state, "patterns") };

    case "answer":
      // 한 문항에 한 번만 답할 수 있다
      if (step.kind !== "quiz" || step.feedback) return state;
      return {
        ...state,
        step: {
          ...step,
          feedback: { correct: action.correct, chosen: action.chosen },
        },
        answers: [...state.answers, { targetItemId: action.targetItemId, correct: action.correct }],
      };

    case "advanceQuiz":
      if (step.kind !== "quiz" || !step.feedback) return state;
      return {
        ...state,
        step: step.index + 1 < state.quizCount ? { kind: "quiz", index: step.index + 1, feedback: null } : after(state, "quiz"),
      };
  }
}

/** 상단 진행 바 비율. 단계마다 화면 수만큼 가중치 (소리 1, 카드 N, 전체 듣기 1, 예문 1, 연습/패턴 N, 퀴즈 M). */
export function sheetProgress(s: SheetState): number {
  const weight = (t: StepType): number =>
    t === "intro" || t === "listen" || t === "sentences"
      ? 1
      : t === "cards"
        ? s.itemCount
        : t === "practice"
          ? s.practiceCount
          : t === "patterns"
            ? s.patternCount
            : s.quizCount;
  const total = s.plan.reduce((n, t) => n + weight(t), 0);
  if (total === 0) return 0;
  if (s.step.kind === "done") return 1;
  const before = (until: StepType, extra: number) => {
    let n = 0;
    for (const t of s.plan) {
      if (t === until) break;
      n += weight(t);
    }
    return (n + extra) / total;
  };
  switch (s.step.kind) {
    case "intro":
      return 0;
    case "card":
      return before("cards", s.step.index);
    case "listenAll":
      return before("listen", 0);
    case "sentences":
      return before("sentences", 0);
    case "practice":
      return before("practice", s.step.index);
    case "patterns":
      return before("patterns", s.step.index);
    case "quiz":
      return before("quiz", s.step.index);
  }
}

export function sheetScore(state: SheetState): number {
  return state.answers.filter((a) => a.correct).length;
}

/** 틀린 단어 (중복 제거, 틀린 순서) */
export function wrongItemIds(state: SheetState): string[] {
  const out: string[] = [];
  for (const a of state.answers) if (!a.correct && !out.includes(a.targetItemId)) out.push(a.targetItemId);
  return out;
}
