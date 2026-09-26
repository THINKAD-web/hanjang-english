"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useReducer, useState } from "react";
import { BigButton, ProgressBar, Screen } from "@/components/ui";
import { loadContent } from "@/lib/content/load";
import type { Lesson, Word } from "@/lib/content/schema";
import type { DateKey } from "@/lib/engine/date";
import { recordSheetComplete, recordSheetStart } from "@/lib/engine/progress";
import { buildLessonQuiz, shuffleSheetOptions } from "@/lib/engine/quizgen";
import { initSheet, sheetReducer, sheetScore, wrongWordIds, type SheetState } from "@/lib/engine/sheet";
import { decideToday } from "@/lib/engine/today";
import type { AnswerRecord, State } from "@/lib/store/types";
import { speak, stopSpeaking } from "@/lib/tts";
import { newAttemptId, useProgress } from "@/lib/use-progress";
import { useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";
import { CardStep, DoneStep, IntroStep, ListenAllStep, QuizStep, SentencesStep } from "./steps";

const content = loadContent();

export function SheetScreen() {
  const dateKey = useTodayKey();
  const { state, update } = useProgress();
  if (!dateKey || !state) {
    return (
      <Screen>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }
  return <SheetGate initialState={state} dateKey={dateKey} update={update} />;
}

/**
 * 들어온 순간의 상태로 오늘 할 장을 한 번만 정한다.
 * (진행 중에 기록이 바뀌어도 화면이 다른 장으로 바뀌지 않도록)
 * PR3 는 일반 장만 실행한다. 복습장 등은 PR4.
 */
function SheetGate({
  initialState,
  dateKey,
  update,
}: {
  initialState: State;
  dateKey: DateKey;
  update: (fn: (s: State) => State) => Promise<State>;
}) {
  const router = useRouter();
  const dateParam = useDateParam();
  const [decision] = useState(() => decideToday(initialState, dateKey, content));
  const goHome = useCallback(() => {
    stopSpeaking();
    router.push(withDebugDate("/", dateParam));
  }, [router, dateParam]);

  const lesson = decision.kind === "lesson" ? content.lessons.find((l) => l.id === decision.lessonId) : undefined;
  if (!lesson) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-3xl font-bold text-slate-900">오늘 할 장이 없어요</p>
          <BigButton onClick={goHome}>홈으로</BigButton>
        </div>
      </Screen>
    );
  }
  return <LessonRunner lesson={lesson} dateKey={dateKey} update={update} onHome={goHome} />;
}

function LessonRunner({
  lesson,
  dateKey,
  update,
  onHome,
}: {
  lesson: Lesson;
  dateKey: DateKey;
  update: (fn: (s: State) => State) => Promise<State>;
  onHome: () => void;
}) {
  const words = useMemo(() => lesson.wordIds.map((id) => content.wordsById.get(id)).filter((w): w is Word => Boolean(w)), [lesson]);
  // 보기 순서는 날짜·장·문항 번호 seed 로 섞는다 (JSON 은 정답이 첫 보기)
  const quiz = useMemo(() => shuffleSheetOptions(buildLessonQuiz(lesson, content, dateKey), dateKey, lesson.id), [lesson, dateKey]);
  const [sheet, dispatch] = useReducer(sheetReducer, undefined, () => initSheet(words.length, quiz.length));
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [firstSpeech, setFirstSpeech] = useState<Promise<boolean> | null>(null);

  const handleStart = () => {
    // iOS Safari: 사용자가 탭한 이 핸들러 안에서 첫 재생을 시작해야 이후 자동 재생이 된다
    setFirstSpeech(speak(words[0].text, words[0].audio));
    const id = newAttemptId();
    setAttemptId(id);
    void update((s) =>
      recordSheetStart(s, { attemptId: id, dateKey, kind: "lesson", lessonId: lesson.id, wordIds: lesson.wordIds, at: new Date().toISOString() }),
    );
    dispatch({ type: "start" });
  };

  const finishQuiz = useCallback(
    (current: SheetState) => {
      const isLast = current.step.kind === "quiz" && current.step.index === current.quizCount - 1;
      if (isLast && attemptId) {
        const answers: AnswerRecord[] = current.answers;
        void update((s) => recordSheetComplete(s, attemptId, answers, new Date().toISOString()));
      }
      dispatch({ type: "advanceQuiz" });
    },
    [attemptId, update],
  );
  const onQuizFinished = useCallback(() => finishQuiz(sheet), [finishQuiz, sheet]);

  const step = sheet.step;
  const stepRatio = progressRatio(sheet);

  return (
    <Screen>
      <ProgressBar label={`${content.pack.consonant} · ${lesson.dayNo}/${content.lessons.length}장`} ratio={stepRatio} />
      {step.kind === "intro" && <IntroStep lesson={lesson} onStart={handleStart} />}
      {step.kind === "card" && (
        <CardStep
          key={step.index}
          word={words[step.index]}
          index={step.index}
          total={words.length}
          pendingSpeech={step.index === 0 ? firstSpeech : null}
          onNext={() => dispatch({ type: "nextCard" })}
        />
      )}
      {step.kind === "listenAll" && <ListenAllStep words={words} onDone={() => dispatch({ type: "listenAllDone" })} />}
      {step.kind === "sentences" && <SentencesStep sentences={lesson.sentences} onDone={() => dispatch({ type: "sentencesDone" })} />}
      {step.kind === "quiz" && (
        <QuizStep
          key={step.index}
          quiz={quiz[step.index]}
          index={step.index}
          total={quiz.length}
          target={content.wordsById.get(quiz[step.index].targetWordId)!}
          feedback={step.feedback}
          onAnswer={(correct, chosen) =>
            dispatch({ type: "answer", targetWordId: quiz[step.index].targetWordId, correct, chosen })
          }
          onFinished={onQuizFinished}
        />
      )}
      {step.kind === "done" && (
        <DoneStep
          score={sheetScore(sheet)}
          total={quiz.length}
          wrongWords={wrongWordIds(sheet).map((id) => content.wordsById.get(id)!).filter(Boolean)}
          onHome={onHome}
        />
      )}
    </Screen>
  );
}

/** 상단 진행 바: 소리 1 + 카드 N + 전체 듣기 1 + 예문 1 + 퀴즈 M 단계 중 어디인지 */
function progressRatio(s: SheetState): number {
  const total = 1 + s.wordCount + 1 + 1 + s.quizCount;
  const step = s.step;
  const done =
    step.kind === "intro"
      ? 0
      : step.kind === "card"
        ? 1 + step.index
        : step.kind === "listenAll"
          ? 1 + s.wordCount
          : step.kind === "sentences"
            ? 2 + s.wordCount
            : step.kind === "quiz"
              ? 3 + s.wordCount + step.index
              : total;
  return done / total;
}
