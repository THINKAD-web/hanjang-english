"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BigButton, ProgressBar, Screen } from "@/components/ui";
import type { Content, Item } from "@/lib/content/schema";
import type { DateKey } from "@/lib/engine/date";
import { buildReviewQuiz, shuffleSheetOptions } from "@/lib/engine/quizgen";
import type { SheetStep } from "@/lib/engine/progress";
import { initReviewSheet, sheetReducer, sheetScore, wrongItemIds, type SheetState } from "@/lib/engine/sheet";
import type { AnswerRecord } from "@/lib/store/types";
import { speak, stopSpeaking } from "@/lib/tts";
import { CardStep, DoneStep, QuizStep } from "./steps";

export type ReviewRunnerProps = {
  content: Content;
  /** 복습 대상 아이템 (오래된 오답 우선, 부족하면 최근 배운 단어로 채움 — buildReviewItemIds 결과). */
  itemIds: string[];
  dateKey: DateKey;
  onStart?: () => void;
  onComplete?: (answers: AnswerRecord[], timings: Record<SheetStep, number>) => void;
  onAbort?: (step: SheetStep, elapsedMs: number) => void;
  onHome: () => void;
};

const STEP_KEY: Partial<Record<SheetState["step"]["kind"], SheetStep>> = {
  card: "cards",
  quiz: "quiz",
};

const ZERO_TIMINGS: Record<SheetStep, number> = { sound: 0, cards: 0, listen: 0, sentences: 0, quiz: 0 };

/**
 * 복습장: 단어 카드 → 퀴즈만 (오늘의 소리·전체 듣기·예문 생략, PR4 지시서 2장).
 * `/learn/[packId]` 에서 decideToday 가 `{ kind: "review" }` 를 반환할 때 쓴다.
 * LessonRunner 와 같은 sheetReducer(skipMiddle)·CardStep/QuizStep/DoneStep 을 그대로 재사용한다.
 * "다시 보기"(review-screen.tsx, 지난 장 재실행)와는 다른 화면이다 — 이름 혼동 주의.
 */
export function ReviewRunner({ content, itemIds, dateKey, onStart, onComplete, onAbort, onHome }: ReviewRunnerProps) {
  const items = useMemo(
    () => itemIds.map((id) => content.itemsById.get(id)).filter((it): it is Item => Boolean(it)),
    [itemIds, content],
  );
  const quiz = useMemo(() => shuffleSheetOptions(buildReviewQuiz(itemIds, content, dateKey), dateKey, "review"), [itemIds, content, dateKey]);
  const [sheet, dispatch] = useReducer(sheetReducer, undefined, () => initReviewSheet(items.length, quiz.length));
  const [started, setStarted] = useState(false);

  // iOS Safari 탭 핸들러 안에서 speak() 를 미리 시작해 다음 화면에 넘기는 패턴 — lesson-runner.tsx 와 동일.
  const [pendingCardSpeech, setPendingCardSpeech] = useState<Promise<boolean> | null>(null);
  const [pendingQuizSpeech, setPendingQuizSpeech] = useState<Promise<boolean> | null>(null);
  const [pendingRevealSpeech, setPendingRevealSpeech] = useState<Promise<boolean> | null>(null);

  const timingsRef = useRef<Record<SheetStep, number>>({ ...ZERO_TIMINGS });
  const lastRef = useRef<{ key: SheetStep; at: number } | null>(null);
  useEffect(() => {
    const now = Date.now();
    if (lastRef.current) timingsRef.current[lastRef.current.key] += now - lastRef.current.at;
    const key = started ? STEP_KEY[sheet.step.kind] : "sound";
    lastRef.current = key ? { key, at: now } : null;
  }, [sheet.step.kind, started]);
  const snapshotTimings = useCallback((): Record<SheetStep, number> => {
    const snap = { ...timingsRef.current };
    if (lastRef.current) snap[lastRef.current.key] += Date.now() - lastRef.current.at;
    return snap;
  }, []);

  const handleStart = () => {
    if (items[0]) setPendingCardSpeech(speak(items[0].text, items[0].audio));
    onStart?.();
    setStarted(true);
  };

  const handleNextCard = () => {
    if (sheet.step.kind !== "card") return;
    const nextIndex = sheet.step.index + 1;
    if (nextIndex < items.length) {
      setPendingCardSpeech(speak(items[nextIndex].text, items[nextIndex].audio));
    } else if (quiz[0]?.type === "listen_choice") {
      const target = content.itemsById.get(quiz[0].targetItemId);
      if (target) setPendingQuizSpeech(speak(target.text, target.audio));
    }
    dispatch({ type: "nextCard" });
  };

  const handleAnswer = (correct: boolean, chosen: string | boolean) => {
    if (sheet.step.kind !== "quiz") return;
    const currentQuiz = quiz[sheet.step.index];
    const currentTarget = content.itemsById.get(currentQuiz.targetItemId);
    setPendingRevealSpeech(!correct && currentTarget ? speak(currentTarget.text, currentTarget.audio) : null);

    const nextQuiz = quiz[sheet.step.index + 1];
    if (nextQuiz?.type === "listen_choice") {
      const nextTarget = content.itemsById.get(nextQuiz.targetItemId);
      setPendingQuizSpeech(nextTarget ? speak(nextTarget.text, nextTarget.audio) : null);
    } else {
      setPendingQuizSpeech(null);
    }
    dispatch({ type: "answer", targetItemId: currentQuiz.targetItemId, correct, chosen });
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
  const { done, total, ratio } = reviewProgress(sheet, started);

  return (
    <Screen>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar label={`복습장 · ${done}/${total}`} ratio={ratio} />
        </div>
        {onAbort && started && step.kind !== "done" ? (
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
      {!started ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <p className="text-xl font-semibold text-amber-800">복습장</p>
          <p className="text-2xl text-slate-800">그동안 헷갈렸던 단어들을 다시 볼까요?</p>
          <BigButton onClick={handleStart}>시작</BigButton>
        </section>
      ) : null}
      {started && step.kind === "card" && (
        <CardStep
          key={step.index}
          word={items[step.index]}
          index={step.index}
          total={items.length}
          pendingSpeech={pendingCardSpeech}
          onNext={handleNextCard}
        />
      )}
      {started && step.kind === "quiz" && (
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
      {started && step.kind === "done" && (
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
  );
}

/** 상단 진행 바: 카드 N장 + 퀴즈 M 문항 중 어디인지. 시작 전엔 0/전체. */
function reviewProgress(s: SheetState, started: boolean): { done: number; total: number; ratio: number } {
  const total = s.itemCount + s.quizCount;
  if (!started) return { done: 0, total, ratio: 0 };
  const step = s.step;
  const done = step.kind === "card" ? step.index : step.kind === "quiz" ? s.itemCount + step.index : total;
  return { done, total, ratio: total > 0 ? done / total : 0 };
}
