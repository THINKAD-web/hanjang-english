"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PreReleaseBadge, ProgressBar, Screen } from "@/components/ui";
import { isPreRelease } from "@/lib/content/visibility";
import { isDebug } from "@/lib/use-today-key";
import type { Content, Item, Lesson } from "@/lib/content/schema";
import type { DateKey } from "@/lib/engine/date";
import { buildLessonQuiz, shuffleSheetOptions } from "@/lib/engine/quizgen";
import type { SheetStep as TimingKey, StepTimings } from "@/lib/engine/progress";
import { initSheet, sheetProgress, sheetReducer, sheetScore, wrongItemIds, type SheetAction, type SheetState } from "@/lib/engine/sheet";
import type { AnswerRecord } from "@/lib/store/types";
import { speakItem, stopSpeaking } from "@/lib/tts";
import { SpeechLangProvider } from "@/lib/tts-lang";
import { CardStep, DoneStep, IntroStep, ListenAllStep, PatternsStep, PracticeStep, QuizStep, SentencesStep } from "./steps";
import { unitLabelOf } from "@/lib/content/pack-text";

export type LessonRunnerProps = {
  content: Content;
  lesson: Lesson;
  dateKey: DateKey;
  /** 오늘 장으로 실행할 때만 넘긴다. undefined 면 "다시 보기" — 진행·오답 기록을 남기지 않는다. */
  onStart?: () => void;
  onComplete?: (answers: AnswerRecord[], timings: StepTimings) => void;
  /** 넘기면 우측 상단에 ✕(닫기)가 뜬다. 확인 후 onHome 을 이어서 부른다. "다시 보기"에는 넘기지 않는다. */
  onAbort?: (step: TimingKey, elapsedMs: number) => void;
  onHome: () => void;
  /** 오답 삽입 대상 (오늘 장 실행일 때만) */
  injectedItemId?: string;
  /** 보기 셔플 seed 에 쓰는 장 식별자. 기본은 lesson.id. */
  sheetId?: string;
  /** "다시 보기" 등에서 상단에 보여줄 안내 배너 */
  banner?: string;
};

const STEP_KEY: Partial<Record<SheetState["step"]["kind"], TimingKey>> = {
  intro: "sound",
  card: "cards",
  listenAll: "listen",
  sentences: "sentences",
  practice: "practice",
  patterns: "patterns",
  quiz: "quiz",
};

/** 예전 장(소리·카드·듣기·예문·퀴즈)이 항상 남기던 다섯 키. 새 단계는 거쳤을 때만 키가 생긴다. */
const BASE_TIMINGS: StepTimings = {
  sound: 0,
  cards: 0,
  listen: 0,
  sentences: 0,
  quiz: 0,
};

/**
 * 레슨의 steps(소리 → 카드 → 전체 듣기 → 예문 → 연습/패턴 → 퀴즈 중 레슨 타입이 고른 순서) → 완료 한 벌.
 * `/learn/[packId]`(오늘 장)와 `/learn/[packId]/[lessonId]`(다시 보기) 가 함께 쓴다.
 */
export function LessonRunner({
  content,
  lesson,
  dateKey,
  onStart,
  onComplete,
  onAbort,
  onHome,
  injectedItemId,
  sheetId,
  banner,
}: LessonRunnerProps) {
  const items = useMemo(
    () => lesson.itemIds.map((id) => content.itemsById.get(id)).filter((it): it is Item => Boolean(it)),
    [lesson, content],
  );
  const quiz = useMemo(
    () => shuffleSheetOptions(buildLessonQuiz(lesson, content, dateKey, injectedItemId), dateKey, sheetId ?? lesson.id),
    [lesson, content, dateKey, injectedItemId, sheetId],
  );
  const lang = content.pack.ttsLang;
  const problems = useMemo(() => items.filter((it) => it.kind === "problem"), [items]);
  const [sheet, dispatch] = useReducer(sheetReducer, undefined, () =>
    initSheet(items.length, quiz.length, {
      plan: lesson.steps,
      practiceCount: problems.length,
      patternCount: items.length,
    }),
  );
  // iOS Safari 는 speechSynthesis.speak() 가 탭 핸들러 안에서 "직접" 호출돼야 재생을 허용한다.
  // useEffect/setTimeout 안에서 부르면 (첫 재생이 아무리 성공했어도) 이후 호출이 막힐 수 있다.
  // 그래서 다음 화면의 speak() 는 그 화면으로 넘어가게 하는 탭 핸들러 안에서 "미리" 시작해 두고,
  // 그 결과 Promise 를 다음 화면에 pendingSpeech 로 넘겨서 그걸 기다리게 한다.
  const [pendingCardSpeech, setPendingCardSpeech] = useState<Promise<boolean> | null>(null);
  const [pendingListenSpeech, setPendingListenSpeech] = useState<Promise<boolean> | null>(null);
  const [pendingQuizSpeech, setPendingQuizSpeech] = useState<Promise<boolean> | null>(null);
  const [pendingRevealSpeech, setPendingRevealSpeech] = useState<Promise<boolean> | null>(null);

  // 단계별 소요 시간(ms) — 화면엔 보여주지 않고 완료 시 이벤트로만 남긴다 (기획안 14장 8분 실측)
  const timingsRef = useRef<StepTimings>({ ...BASE_TIMINGS });
  const lastRef = useRef<{ key: TimingKey; at: number } | null>(null);
  useEffect(() => {
    const now = Date.now();
    if (lastRef.current)
      timingsRef.current[lastRef.current.key] = (timingsRef.current[lastRef.current.key] ?? 0) + now - lastRef.current.at;
    const key = STEP_KEY[sheet.step.kind];
    lastRef.current = key ? { key, at: now } : null;
  }, [sheet.step.kind]);
  const snapshotTimings = useCallback((): StepTimings => {
    const snap = { ...timingsRef.current };
    if (lastRef.current) snap[lastRef.current.key] = (snap[lastRef.current.key] ?? 0) + Date.now() - lastRef.current.at;
    return snap;
  }, []);

  /**
   * 다음 화면이 자동 재생으로 시작하면, 그 재생을 이 탭 핸들러 안에서 미리 시작해 둔다(iOS Safari).
   * 어느 화면으로 가는지는 리듀서에 물어본다 — 단계 순서를 여기서 따로 알 필요가 없다.
   */
  const advance = (action: SheetAction) => {
    const nextSheet = sheetReducer(sheet, action);
    if (nextSheet === sheet) return;
    const next = nextSheet.step;
    if (next.kind === "card") {
      setPendingCardSpeech(speakItem(items[next.index], lang));
    } else if (next.kind === "listenAll" && items[0]) {
      setPendingListenSpeech(speakItem(items[0], lang));
    } else if (next.kind === "quiz" && quiz[next.index]?.type === "listen_choice") {
      const target = content.itemsById.get(quiz[next.index].targetItemId);
      if (target) setPendingQuizSpeech(speakItem(target, lang));
    }
    dispatch(action);
  };

  const handleStart = () => {
    onStart?.();
    advance({ type: "start" });
  };

  /**
   * 답 선택 탭 — 정답 여부가 이 탭 안에서 이미 확정되므로, 이어질 재생(오답 카드 다시 듣기 /
   * 다음 문제가 듣고 고르기)도 여기서 미리 시작해 둔다. 실제 화면 전환은 몇 초 뒤 지연 애니메이션 이후.
   */
  const handleAnswer = (correct: boolean, chosen: string | boolean) => {
    if (step.kind !== "quiz") return;
    const currentQuiz = quiz[step.index];
    const currentTarget = content.itemsById.get(currentQuiz.targetItemId);
    setPendingRevealSpeech(!correct && currentTarget ? speakItem(currentTarget, lang) : null);

    const nextQuiz = quiz[step.index + 1];
    if (nextQuiz?.type === "listen_choice") {
      const nextTarget = content.itemsById.get(nextQuiz.targetItemId);
      setPendingQuizSpeech(nextTarget ? speakItem(nextTarget, lang) : null);
    } else {
      setPendingQuizSpeech(null);
    }
    dispatch({
      type: "answer",
      targetItemId: currentQuiz.targetItemId,
      correct,
      chosen,
    });
  };

  const finishQuiz = useCallback(
    (current: SheetState) => {
      const isLast = current.step.kind === "quiz" && current.step.index === current.quizCount - 1;
      if (isLast) onComplete?.(current.answers, snapshotTimings());
      dispatch({ type: "advanceQuiz" });
    },
    [onComplete, snapshotTimings],
  );
  const onQuizFinished = useCallback(() => finishQuiz(sheet), [finishQuiz, sheet]);

  const handleAbort = () => {
    if (!window.confirm("그만할까요? 처음부터 다시 해요")) return;
    const step = STEP_KEY[sheet.step.kind] ?? "sound";
    const elapsedMs = lastRef.current ? Date.now() - lastRef.current.at : 0;
    stopSpeaking();
    onAbort?.(step, elapsedMs);
    onHome();
  };

  const step = sheet.step;
  const stepRatio = sheetProgress(sheet);

  return (
    <SpeechLangProvider lang={lang}>
      <Screen>
        {banner ? <p className="rounded-xl bg-amber-100 px-3 py-2 text-center text-base font-semibold text-amber-900">{banner}</p> : null}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            {isDebug && isPreRelease(content.pack, lesson) ? (
              <div className="mb-1">
                <PreReleaseBadge />
              </div>
            ) : null}
            <ProgressBar label={`${unitLabelOf(content.pack)} · ${lesson.order}/${content.lessons.length}장`} ratio={stepRatio} />
          </div>
          {onAbort && step.kind !== "done" ? (
            <button
              type="button"
              aria-label="그만하고 홈으로"
              onClick={handleAbort}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bold text-slate-600 ring-1 ring-slate-200"
            >
              ✕
            </button>
          ) : null}
        </div>
        {step.kind === "intro" && <IntroStep lesson={lesson} onStart={handleStart} />}
        {step.kind === "card" && (
          <CardStep
            key={step.index}
            word={items[step.index]}
            index={step.index}
            total={items.length}
            pendingSpeech={pendingCardSpeech}
            onNext={() => advance({ type: "nextCard" })}
          />
        )}
        {step.kind === "listenAll" && (
          <ListenAllStep words={items} pendingFirstSpeech={pendingListenSpeech} onDone={() => advance({ type: "listenAllDone" })} />
        )}
        {step.kind === "sentences" && <SentencesStep sentences={lesson.sentences} onDone={() => advance({ type: "sentencesDone" })} />}
        {step.kind === "practice" && (
          <PracticeStep
            key={step.index}
            problem={problems[step.index]}
            index={step.index}
            total={problems.length}
            onNext={() => advance({ type: "nextPractice" })}
          />
        )}
        {step.kind === "patterns" && (
          <PatternsStep
            key={step.index}
            pattern={items[step.index]}
            index={step.index}
            total={items.length}
            onNext={() => advance({ type: "nextPattern" })}
          />
        )}
        {step.kind === "quiz" && (
          <QuizStep
            key={step.index}
            quiz={quiz[step.index]}
            index={step.index}
            total={quiz.length}
            target={content.itemsById.get(quiz[step.index].targetItemId)!}
            feedback={step.feedback}
            pendingSpeech={pendingQuizSpeech}
            pendingRevealSpeech={pendingRevealSpeech}
            onAnswer={handleAnswer}
            onFinished={onQuizFinished}
          />
        )}
        {step.kind === "done" && (
          <DoneStep
            score={sheetScore(sheet)}
            total={quiz.length}
            wrongWords={wrongItemIds(sheet)
              .map((id) => content.itemsById.get(id)!)
              .filter(Boolean)}
            onHome={() => {
              stopSpeaking();
              onHome();
            }}
          />
        )}
      </Screen>
    </SpeechLangProvider>
  );
}
