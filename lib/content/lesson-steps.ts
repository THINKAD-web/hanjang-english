import type { Intro, LessonType, StepType } from "./schema";

/** 타입별 기본 스텝 순서 (대량 개발 지시서 6장). 레슨에 steps 가 있으면 그것을 쓴다. */
export const DEFAULT_STEPS: Record<LessonType, readonly StepType[]> = {
  phonics: ["intro", "cards", "listen", "sentences", "quiz"],
  vocab: ["intro", "cards", "listen", "sentences", "quiz"],
  listening: ["intro", "listen", "quiz"],
  grammar: ["intro", "patterns", "quiz"],
  math: ["intro", "practice", "quiz"],
};

/** intro 화면 위쪽의 작은 이름. phonics 는 예전 "오늘의 소리" 그대로. */
export const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  phonics: "오늘의 소리",
  vocab: "오늘의 단어",
  listening: "오늘의 듣기",
  grammar: "오늘의 패턴",
  math: "오늘의 문제",
};

/**
 * 실제로 거칠 스텝. intro 가 없으면 intro 를 건너뛰고, 문장이 없으면 sentences 를 건너뛴다.
 * (건너뛰는 판단은 빌드 한 번에 끝내서 화면과 상태머신은 결과 목록만 따른다.)
 */
export function resolveSteps(lesson: { type: LessonType; steps?: readonly StepType[]; intro?: Intro; sentences: readonly unknown[] }): StepType[] {
  const base = lesson.steps ?? DEFAULT_STEPS[lesson.type];
  return base.filter((s) => (s === "intro" ? Boolean(lesson.intro) : s === "sentences" ? lesson.sentences.length > 0 : true));
}
