"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { BigButton, SpeakButton } from "@/components/ui";
import { WordCard, WordPicture } from "@/components/word-card";
import type { Item, Lesson, Quiz, Sentence } from "@/lib/content/schema";
import type { QuizFeedback } from "@/lib/engine/sheet";
import { NO_TTS_DELAY_MS, speak, stopSpeaking, ttsSupported } from "@/lib/tts";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 재생이 끝나면(또는 음성을 못 쓰면 표시 후 1.5초 뒤) resolve */
async function playOrWait(word: Item, shownAt: number, pending?: Promise<boolean> | null): Promise<void> {
  const ok = await (pending ?? speak(word.text, word.audio));
  if (!ok) await sleep(Math.max(0, NO_TTS_DELAY_MS - (Date.now() - shownAt)));
}

// ───────────────────────── 오늘의 소리 ─────────────────────────

export function IntroStep({ lesson, onStart }: { lesson: Lesson; onStart: () => void }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <p className="text-xl font-semibold text-amber-800">오늘의 소리</p>
      <p lang="en" className="text-7xl font-bold text-slate-900">
        {lesson.focus.label}
      </p>
      <div className="space-y-3 text-2xl leading-relaxed text-slate-800">
        <p>{lesson.focus.lines[0]}</p>
        <p>{lesson.focus.lines[1]}</p>
      </div>
      <BigButton onClick={onStart}>시작</BigButton>
      <p className="text-base text-slate-600">소리가 나와요. 소리를 켜 주세요 🔈</p>
    </section>
  );
}

// ───────────────────────── 단어 카드 ─────────────────────────

/**
 * 카드가 보이면 자동 재생. 재생이 끝나야 "다음" 이 켜진다 (음성 불가 기기는 1.5초 뒤).
 * 첫 카드는 "시작" 탭에서 이미 재생을 시작했으므로(iOS) 그 promise 를 받아서 기다린다.
 */
export function CardStep({
  word,
  index,
  total,
  pendingSpeech,
  onNext,
}: {
  word: Item;
  index: number;
  total: number;
  pendingSpeech: Promise<boolean> | null;
  onNext: () => void;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    playOrWait(word, Date.now(), pendingSpeech).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [word, pendingSpeech]);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <p className="text-center text-xl font-semibold text-slate-700">
        단어 {index + 1} / {total}
      </p>
      <WordCard word={word} />
      <div className="flex justify-center">
        <SpeakButton text={word.text} audio={word.audio} />
      </div>
      <div className="mt-auto">
        <BigButton disabled={!ready} onClick={onNext} aria-live="polite">
          {ready ? "다음" : "듣는 중…"}
        </BigButton>
      </div>
    </section>
  );
}

// ───────────────────────── 전체 듣기 ─────────────────────────

/**
 * 8단어 연속 재생. 건너뛰기 없음 — 끝나야 "다음" 이 켜진다.
 * 첫 단어는 이전 화면(마지막 카드)의 "다음" 탭에서 이미 재생을 시작했으므로(iOS) 그 promise 를 기다린다.
 */
export function ListenAllStep({
  words,
  pendingFirstSpeech,
  onDone,
}: {
  words: Item[];
  pendingFirstSpeech?: Promise<boolean> | null;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      await sleep(400);
      for (let i = 0; i < words.length; i++) {
        if (!alive) return;
        setCurrent(i);
        await playOrWait(words[i], Date.now(), i === 0 ? pendingFirstSpeech : null);
        await sleep(250);
      }
      if (alive) setFinished(true);
    })();
    return () => {
      alive = false;
      stopSpeaking();
    };
  }, [words, pendingFirstSpeech]);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <p className="text-center text-2xl font-bold text-slate-800">전체 듣기</p>
      <ol className="grid grid-cols-2 gap-3">
        {words.map((w, i) => {
          const on = !finished && i === current;
          return (
            <li
              key={w.id}
              lang="en"
              aria-current={on ? "true" : undefined}
              className={`flex min-h-16 items-center justify-center rounded-2xl text-3xl font-bold transition ${
                on ? "scale-105 bg-sky-700 text-white" : "bg-white text-slate-800 ring-1 ring-amber-200"
              }`}
            >
              {w.text}
            </li>
          );
        })}
      </ol>
      <div className="mt-auto">
        <BigButton disabled={!finished} onClick={onDone}>
          {finished ? "다음" : "듣는 중…"}
        </BigButton>
      </div>
    </section>
  );
}

// ───────────────────────── 예문 ─────────────────────────

export function SentencesStep({ sentences, onDone }: { sentences: Sentence[]; onDone: () => void }) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <p className="text-center text-2xl font-bold text-slate-800">예문</p>
      {sentences.map((s) => (
        <div key={s.text} className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
          <p lang="en" className="text-3xl font-bold leading-snug text-slate-900">
            {s.text}
          </p>
          <p className="text-2xl text-slate-700">{s.meaningKo}</p>
          <div>
            <SpeakButton text={s.text} label="듣기" />
          </div>
        </div>
      ))}
      <div className="mt-auto">
        <BigButton onClick={onDone}>퀴즈 풀기</BigButton>
      </div>
    </section>
  );
}

// ───────────────────────── 퀴즈 ─────────────────────────

const CORRECT_PAUSE_MS = 800;
const WRONG_ANSWER_MS = 1200;
const WRONG_CARD_MS = 1000;

/**
 * 한 화면에 한 문제. 보기 버튼 높이 56px 이상, 글자 24px 이상.
 * 틀리면 정답을 표시하고, 이어서 단어 카드를 1초 보여준 뒤 넘어간다.
 */
export function QuizStep({
  quiz,
  index,
  total,
  target,
  feedback,
  pendingSpeech,
  pendingRevealSpeech,
  onAnswer,
  onFinished,
}: {
  quiz: Quiz;
  index: number;
  total: number;
  target: Item;
  feedback: QuizFeedback | null;
  /** 듣고 고르기 자동 재생 — 이전 화면의 탭에서 이미 시작한 재생이 있으면 그걸 쓴다(iOS). */
  pendingSpeech?: Promise<boolean> | null;
  /** 오답 카드 다시 듣기 — 답 선택 탭에서 이미 시작한 재생이 있으면 그걸 쓴다(iOS). */
  pendingRevealSpeech?: Promise<boolean> | null;
  onAnswer: (correct: boolean, chosen: string | boolean) => void;
  onFinished: () => void;
}) {
  const [showCard, setShowCard] = useState(false);
  const finished = useEffectEvent(onFinished);

  // 듣고 고르기: 문제가 보이면 자동 재생
  useEffect(() => {
    if (quiz.type === "listen_choice") void (pendingSpeech ?? speak(target.text, target.audio));
  }, [quiz, target, pendingSpeech]);

  // 채점 후 넘어가기
  useEffect(() => {
    if (!feedback) return;
    let alive = true;
    (async () => {
      if (feedback.correct) {
        await sleep(CORRECT_PAUSE_MS);
      } else {
        await sleep(WRONG_ANSWER_MS);
        if (!alive) return;
        setShowCard(true);
        void (pendingRevealSpeech ?? speak(target.text, target.audio));
        await sleep(WRONG_CARD_MS);
      }
      if (alive) finished();
    })();
    return () => {
      alive = false;
    };
  }, [feedback, target, pendingRevealSpeech]);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <p className="text-center text-xl font-semibold text-slate-700">
        퀴즈 {index + 1} / {total}
      </p>
      {showCard ? null : <QuizPrompt quiz={quiz} target={target} />}
      {showCard ? (
        <WordCard word={target} />
      ) : quiz.type === "ox" ? (
        <OxButtons answer={quiz.answer} feedback={feedback} onAnswer={onAnswer} />
      ) : (
        <ChoiceButtons options={quiz.options} answer={quiz.answer} feedback={feedback} onAnswer={onAnswer} />
      )}
      <p className="min-h-8 text-center text-2xl font-bold" aria-live="polite">
        {feedback ? (feedback.correct ? "딩동댕! 🎉" : "정답을 확인해요") : ""}
      </p>
    </section>
  );
}

function QuizPrompt({ quiz, target }: { quiz: Quiz; target: Item }) {
  switch (quiz.type) {
    case "picture_choice":
      return (
        <div className="flex flex-col items-center gap-3">
          <p className="text-2xl text-slate-800">그림에 맞는 단어는?</p>
          <WordPicture word={target} />
        </div>
      );
    case "meaning_choice":
      return <p className="text-center text-4xl font-bold text-slate-900">{quiz.prompt}</p>;
    case "fill_blank":
      return (
        <div className="flex flex-col items-center gap-3">
          <p className="text-2xl text-slate-800">빈칸에 들어갈 단어는?</p>
          <p lang="en" className="text-center text-3xl font-bold leading-snug text-slate-900">
            {quiz.sentence}
          </p>
        </div>
      );
    case "listen_choice":
      return (
        <div className="flex flex-col items-center gap-3">
          <p className="text-2xl text-slate-800">잘 듣고 고르세요</p>
          <SpeakButton text={target.text} audio={target.audio} label="한 번 더" />
          {!ttsSupported() ? <p className="text-lg text-slate-600">소리가 안 나와요 · 뜻: {target.meaningKo}</p> : null}
        </div>
      );
    case "ox":
      return (
        <div className="flex flex-col items-center gap-3">
          <p className="text-2xl text-slate-800">맞으면 O, 틀리면 X</p>
          <p className="text-center text-4xl font-bold text-slate-900">{quiz.statement}</p>
        </div>
      );
  }
}

function optionClass(state: "idle" | "right" | "wrong" | "dim") {
  const base = "min-h-16 w-full rounded-2xl px-4 text-3xl font-bold transition active:scale-[0.98]";
  switch (state) {
    case "right":
      return `${base} bg-emerald-600 text-white ring-4 ring-emerald-300`;
    case "wrong":
      return `${base} bg-rose-600 text-white`;
    case "dim":
      return `${base} bg-white text-slate-500 ring-1 ring-slate-200`;
    default:
      return `${base} bg-white text-slate-900 ring-2 ring-sky-200`;
  }
}

function ChoiceButtons({
  options,
  answer,
  feedback,
  onAnswer,
}: {
  options: readonly string[];
  answer: string;
  feedback: QuizFeedback | null;
  onAnswer: (correct: boolean, chosen: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((o) => {
        const state = !feedback ? "idle" : o === answer ? "right" : o === feedback.chosen ? "wrong" : "dim";
        return (
          <button key={o} type="button" lang="en" disabled={Boolean(feedback)} className={optionClass(state)} onClick={() => onAnswer(o === answer, o)}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function OxButtons({
  answer,
  feedback,
  onAnswer,
}: {
  answer: boolean;
  feedback: QuizFeedback | null;
  onAnswer: (correct: boolean, chosen: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {([true, false] as const).map((v) => {
        const state = !feedback ? "idle" : v === answer ? "right" : v === feedback.chosen ? "wrong" : "dim";
        return (
          <button
            key={String(v)}
            type="button"
            disabled={Boolean(feedback)}
            aria-label={v ? "맞아요 (O)" : "틀려요 (X)"}
            className={`${optionClass(state)} min-h-28 text-6xl`}
            onClick={() => onAnswer(v === answer, v)}
          >
            {v ? "O" : "X"}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────── 완료 ─────────────────────────

export const MAX_WRONG_SHOWN = 3;

export function DoneStep({
  score,
  total,
  wrongWords,
  onHome,
}: {
  score: number;
  total: number;
  wrongWords: Item[];
  onHome: () => void;
}) {
  return (
    <section className="flex flex-1 flex-col items-center gap-6 text-center">
      <div className="stamp-in mt-4 flex h-36 w-36 items-center justify-center rounded-full bg-rose-100 text-8xl ring-4 ring-rose-300" aria-hidden>
        💮
      </div>
      <h2 className="text-5xl font-bold text-slate-900">오늘 끝!</h2>
      <p className="text-3xl text-slate-800">
        {total}문제 중 <strong className="text-sky-800">{score}개</strong> 맞았어요
      </p>
      {wrongWords.length > 0 ? (
        <div className="flex w-full flex-col gap-3 text-left">
          <p className="text-xl font-semibold text-slate-700">다시 보기</p>
          {wrongWords.slice(0, MAX_WRONG_SHOWN).map((w) => (
            <div key={w.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <WordCard word={w} size="sm" />
              </div>
              <SpeakButton text={w.text} audio={w.audio} label="듣기" />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-2xl text-emerald-700">다 맞았어요! 👏</p>
      )}
      <div className="mt-auto w-full">
        <BigButton onClick={onHome}>홈으로</BigButton>
      </div>
    </section>
  );
}
