"use client";

import { useCallback, useMemo, useReducer, useState } from "react";
import { ProgressBar, Screen } from "@/components/ui";
import type { Content, Item, Lesson } from "@/lib/content/schema";
import type { AnswerRecord } from "@/lib/store/types";
import type { DateKey } from "@/lib/engine/date";
import { buildLessonQuiz, shuffleSheetOptions } from "@/lib/engine/quizgen";
import { initSheet, sheetReducer, sheetScore, wrongItemIds, type SheetState } from "@/lib/engine/sheet";
import { speak, stopSpeaking } from "@/lib/tts";
import { CardStep, DoneStep, IntroStep, ListenAllStep, QuizStep, SentencesStep } from "./steps";

export type LessonRunnerProps = {
  content: Content;
  lesson: Lesson;
  dateKey: DateKey;
  /** 오늘 장으로 실행할 때만 넘긴다. undefined 면 "다시 보기" — 진행·오답 기록을 남기지 않는다. */
  onStart?: () => void;
  onComplete?: (answers: AnswerRecord[]) => void;
  onHome: () => void;
  /** 오답 삽입 대상 (오늘 장 실행일 때만) */
  injectedItemId?: string;
  /** 보기 셔플 seed 에 쓰는 장 식별자. 기본은 lesson.id. */
  sheetId?: string;
};

/**
 * 소리 → 카드 → 전체 듣기 → 예문 → 퀴즈 → 완료 한 벌.
 * `/learn/[packId]`(오늘 장)와 `/learn/[packId]/[lessonId]`(다시 보기) 가 함께 쓴다.
 */
export function LessonRunner({ content, lesson, dateKey, onStart, onComplete, onHome, injectedItemId, sheetId }: LessonRunnerProps) {
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

  const handleStart = () => {
    // iOS Safari: 사용자가 탭한 이 핸들러 안에서 첫 재생을 시작해야 이후 자동 재생이 된다
    setFirstSpeech(speak(items[0].text, items[0].audio));
    onStart?.();
    dispatch({ type: "start" });
  };

  const finishQuiz = useCallback(
    (current: SheetState) => {
      const isLast = current.step.kind === "quiz" && current.step.index === current.quizCount - 1;
      if (isLast) onComplete?.(current.answers);
      dispatch({ type: "advanceQuiz" });
    },
    [onComplete],
  );
  const onQuizFinished = useCallback(() => finishQuiz(sheet), [finishQuiz, sheet]);

  const step = sheet.step;
  const stepRatio = progressRatio(sheet);

  return (
    <Screen>
      <ProgressBar label={`${content.pack.unitLabel} · ${lesson.dayNo}/${content.lessons.length}장`} ratio={stepRatio} />
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
