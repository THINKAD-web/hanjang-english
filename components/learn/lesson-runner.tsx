"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ProgressBar, Screen } from "@/components/ui";
import type { Content, Item, Lesson } from "@/lib/content/schema";
import type { DateKey } from "@/lib/engine/date";
import { buildLessonQuiz, shuffleSheetOptions } from "@/lib/engine/quizgen";
import type { SheetStep } from "@/lib/engine/progress";
import { initSheet, sheetReducer, sheetScore, wrongItemIds, type SheetState } from "@/lib/engine/sheet";
import type { AnswerRecord } from "@/lib/store/types";
import { speak, stopSpeaking } from "@/lib/tts";
import { CardStep, DoneStep, IntroStep, ListenAllStep, QuizStep, SentencesStep } from "./steps";

export type LessonRunnerProps = {
  content: Content;
  lesson: Lesson;
  dateKey: DateKey;
  /** 오늘 장으로 실행할 때만 넘긴다. undefined 면 "다시 보기" — 진행·오답 기록을 남기지 않는다. */
  onStart?: () => void;
  onComplete?: (answers: AnswerRecord[], timings: Record<SheetStep, number>) => void;
  /** 넘기면 우측 상단에 ✕(닫기)가 뜬다. 확인 후 onHome 을 이어서 부른다. "다시 보기"에는 넘기지 않는다. */
  onAbort?: (step: SheetStep, elapsedMs: number) => void;
  onHome: () => void;
  /** 오답 삽입 대상 (오늘 장 실행일 때만) */
  injectedItemId?: string;
  /** 보기 셔플 seed 에 쓰는 장 식별자. 기본은 lesson.id. */
  sheetId?: string;
  /** "다시 보기" 등에서 상단에 보여줄 안내 배너 */
  banner?: string;
};

const STEP_KEY: Partial<Record<SheetState["step"]["kind"], SheetStep>> = {
  intro: "sound",
  card: "cards",
  listenAll: "listen",
  sentences: "sentences",
  quiz: "quiz",
};

const ZERO_TIMINGS: Record<SheetStep, number> = { sound: 0, cards: 0, listen: 0, sentences: 0, quiz: 0 };

/**
 * 소리 → 카드 → 전체 듣기 → 예문 → 퀴즈 → 완료 한 벌.
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
  const [sheet, dispatch] = useReducer(sheetReducer, undefined, () => initSheet(items.length, quiz.length));
  const [firstSpeech, setFirstSpeech] = useState<Promise<boolean> | null>(null);

  // 단계별 소요 시간(ms) — 화면엔 보여주지 않고 완료 시 이벤트로만 남긴다 (기획안 14장 8분 실측)
  const timingsRef = useRef<Record<SheetStep, number>>({ ...ZERO_TIMINGS });
  const lastRef = useRef<{ key: SheetStep; at: number } | null>(null);
  useEffect(() => {
    const now = Date.now();
    if (lastRef.current) timingsRef.current[lastRef.current.key] += now - lastRef.current.at;
    const key = STEP_KEY[sheet.step.kind];
    lastRef.current = key ? { key, at: now } : null;
  }, [sheet.step.kind]);
  const snapshotTimings = useCallback((): Record<SheetStep, number> => {
    const snap = { ...timingsRef.current };
    if (lastRef.current) snap[lastRef.current.key] += Date.now() - lastRef.current.at;
    return snap;
  }, []);

  const handleStart = () => {
    // iOS Safari: 사용자가 탭한 이 핸들러 안에서 첫 재생을 시작해야 이후 자동 재생이 된다
    setFirstSpeech(speak(items[0].text, items[0].audio));
    onStart?.();
    dispatch({ type: "start" });
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
  const stepRatio = progressRatio(sheet);

  return (
    <Screen>
      {banner ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-center text-base font-semibold text-amber-900">{banner}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar label={`${content.pack.unitLabel} · ${lesson.dayNo}/${content.lessons.length}장`} ratio={stepRatio} />
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
          pendingSpeech={step.index === 0 ? firstSpeech : null}
          onNext={() => dispatch({ type: "nextCard" })}
        />
      )}
      {step.kind === "listenAll" && <ListenAllStep words={items} onDone={() => dispatch({ type: "listenAllDone" })} />}
      {step.kind === "sentences" && <SentencesStep sentences={lesson.sentences} onDone={() => dispatch({ type: "sentencesDone" })} />}
      {step.kind === "quiz" && (
        <QuizStep
          key={step.index}
          quiz={quiz[step.index]}
          index={step.index}
          total={quiz.length}
          target={content.itemsById.get(quiz[step.index].targetItemId)!}
          feedback={step.feedback}
          onAnswer={(correct, chosen) => dispatch({ type: "answer", targetItemId: quiz[step.index].targetItemId, correct, chosen })}
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
  );
}

/** 상단 진행 바: 소리 1 + 카드 N + 전체 듣기 1 + 예문 1 + 퀴즈 M 단계 중 어디인지 */
function progressRatio(s: SheetState): number {
  const total = 1 + s.itemCount + 1 + 1 + s.quizCount;
  const step = s.step;
  const done =
    step.kind === "intro"
      ? 0
      : step.kind === "card"
        ? 1 + step.index
        : step.kind === "listenAll"
          ? 1 + s.itemCount
          : step.kind === "sentences"
            ? 2 + s.itemCount
            : step.kind === "quiz"
              ? 3 + s.itemCount + step.index
              : total;
  return done / total;
}
