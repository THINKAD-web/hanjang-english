"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BadgeChip,
  LoadingSkeleton,
  PackIconTile,
  ProfileAvatar,
  ProgressRing,
  StreakPill,
  TodayDateBadge,
} from "@/components/design-system";
import { BRAND } from "@/lib/brand";
import type { Manifest } from "@/lib/content/bundle";
import type { Content } from "@/lib/content/schema";
import { useManifest, usePackContent } from "@/lib/content/use-content";
import { addDays, type DateKey } from "@/lib/engine/date";
import { homeCta, packProgress, recordNextPackRequest, weekStamps } from "@/lib/engine/progress";
import { BADGE_LABEL, earnedBadges, lastStudyDate, learningStreak } from "@/lib/engine/stats";
import { activeProfile, continuePackId, inProgressPacks, packProgressOf } from "@/lib/packs/catalog";
import { decideToday } from "@/lib/engine/today";
import { completeLessonsUpTo } from "@/lib/debug-actions";
import type { State } from "@/lib/store/types";
import { warmUpVoices } from "@/lib/tts";
import { useProgress } from "@/lib/use-progress";
import { isDebug, useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";
import { StampRow } from "./stamp-row";
import { BigButton, LoadFailed, ProgressBar, Screen } from "./ui";
import { unitLabelOf } from "@/lib/content/pack-text";
export function HomeScreen() {
  const dateKey = useTodayKey();
  const { state, reset, update } = useProgress();
  const manifest = useManifest();
  const continueId = state && manifest.status === "ready" ? continuePackId(state, manifest.data) : null;
  const pack = usePackContent(continueId);
  if (manifest.status === "error" || pack.status === "error") return <LoadFailed />;
  if (!dateKey || !state || manifest.status !== "ready") {
    return (
      <Screen>
        <LoadingSkeleton variant="home" />
      </Screen>
    );
  }
  if (!continueId) return <HomeNoPack dateKey={dateKey} state={state} manifest={manifest.data} update={update} />;
  if (pack.status === "missing") return <LoadFailed />;
  if (pack.status !== "ready") {
    return (
      <Screen>
        <LoadingSkeleton variant="home" />
      </Screen>
    );
  }
  return <HomeReady dateKey={dateKey} state={state} onReset={reset} update={update} manifest={manifest.data} content={pack.data} />;
}

function HomeNoPack({
  dateKey,
  state,
  manifest,
  update,
}: {
  dateKey: DateKey;
  state: State;
  manifest: Manifest;
  update: (fn: (s: State) => State) => Promise<State>;
}) {
  const dateParam = useDateParam();
  const profile = activeProfile(state);
  return (
    <Screen compact>
      <HomeHeader dateKey={dateKey} state={state} />
      <section aria-label="팩 고르기" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-5 text-center shadow-[var(--shadow-card)] ring-1 ring-[var(--color-ring)]">
        <p className="text-xl font-semibold text-slate-800">{profile.name ?? "새 프로필"} · 어떤 팩으로 시작할까요?</p>
        <Link
          href={withDebugDate("/packs", dateParam)}
          className="flex min-h-[3.25rem] items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-accent)] px-6 text-2xl font-bold text-white"
        >
          팩 고르기
        </Link>
      </section>
      <MyPacks state={state} manifest={manifest} dateParam={dateParam} update={update} dateKey={dateKey} />
    </Screen>
  );
}

function HomeHeader({ dateKey, state }: { dateKey: DateKey; state: State }) {
  const profile = activeProfile(state);
  const streak = learningStreak(state, dateKey);
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProfileAvatar name={profile.name} type={profile.type} />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{BRAND.appName}</h1>
            <p className="text-base font-medium text-slate-600">{profile.name ?? (profile.type === "child" ? "아이" : "나")}</p>
          </div>
        </div>
        <StreakPill days={streak} large />
      </div>
      <TodayDateBadge dateKey={dateKey} />
    </header>
  );
}

function MyPacks({
  state,
  manifest,
  dateParam,
  update,
  dateKey,
}: {
  state: State;
  manifest: Manifest;
  dateParam: string | null;
  update: (fn: (s: State) => State) => Promise<State>;
  dateKey: DateKey;
}) {
  const mine = inProgressPacks(state, manifest, MY_PACKS_MAX);
  return (
    <section aria-label="내 팩">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700">내 팩</h2>
        <button
          type="button"
          className="text-sm font-semibold text-sky-800 underline"
          onClick={() =>
            void update((s) =>
              recordNextPackRequest(s, {
                dateKey,
                at: new Date().toISOString(),
                payload: { source: "home", profileId: s.activeProfileId },
              }),
            )
          }
        >
          다음 팩 요청
        </button>
      </div>
      <ul className="flex flex-col gap-2.5">
        {mine.map((p) => {
          const { done, total } = packProgressOf(state, p);
          const last = lastStudyDate(state, p.id);
          return (
            <li key={p.id}>
              <Link
                href={withDebugDate(`/packs/${p.id}`, dateParam)}
                className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-white to-[var(--color-accent-soft)]/30 px-4 py-3.5 shadow-[var(--shadow-soft)] ring-2 ring-[var(--color-accent)]/25"
              >
                <PackIconTile subjectId={p.subjectId} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold text-slate-900">{p.title}</p>
                  <p className="truncate text-sm font-medium text-slate-600">{unitLabelOf(p)}</p>
                  <ProgressBar label={`${done}/${total}장`} ratio={total > 0 ? done / total : 0} />
                  {last ? <p className="mt-0.5 text-sm text-slate-500">마지막 학습 {last}</p> : null}
                </div>
                <ProgressRing ratio={total > 0 ? done / total : 0} label={`${done}/${total}`} />
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href={withDebugDate("/packs", dateParam)}
            className="flex w-full items-center justify-between rounded-[var(--radius-panel)] bg-[var(--color-surface)] px-5 py-3 text-slate-600 ring-1 ring-slate-200"
          >
            <span className="text-lg font-semibold">전체 보기 · 팩 추가</span>
            <span aria-hidden>›</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

const MY_PACKS_MAX = 3;

function HomeReady({
  dateKey,
  state,
  onReset,
  update,
  manifest,
  content,
}: {
  dateKey: DateKey;
  state: State;
  onReset: () => Promise<void>;
  update: (fn: (s: State) => State) => Promise<State>;
  manifest: Manifest;
  content: Content;
}) {
  const router = useRouter();
  const dateParam = useDateParam();
  const decision = decideToday(state, dateKey, content);
  const cta = homeCta(decision, content);
  const progress = packProgress(state, content);
  const lesson = decision.kind === "lesson" ? content.lessons.find((l) => l.id === decision.lessonId) : undefined;
  const badges = earnedBadges(state, dateKey, content.pack.id);

  return (
    <Screen compact>
      <HomeHeader dateKey={dateKey} state={state} />

      {badges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <BadgeChip key={b} label={BADGE_LABEL[b]} />
          ))}
        </div>
      ) : null}

      <section
        aria-label="이어서"
        className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-gradient-to-b from-[var(--color-accent-soft)] to-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] ring-2 ring-[var(--color-accent)]/35"
      >
        <div className="flex items-start gap-3">
          <PackIconTile subjectId={content.pack.subjectId} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">이어서 하기</p>
            <p className="text-xl font-bold leading-snug text-slate-900">{content.pack.title}</p>
            <p className="text-sm font-semibold text-slate-600">{unitLabelOf(content.pack)}</p>
            {lesson ? <p className="mt-1 text-base font-bold text-slate-800">{lesson.title}</p> : null}
            {decision.kind === "review" ? <p className="mt-1 text-base font-bold text-slate-800">오늘 복습장</p> : null}
            <p className="mt-0.5 text-sm text-slate-500">
              {progress.done}/{progress.total}장 완료
            </p>
          </div>
          <ProgressRing ratio={progress.total > 0 ? progress.done / progress.total : 0} label={`${progress.done}/${progress.total}`} />
        </div>
        <ProgressBar label="팩 진행" ratio={progress.total > 0 ? progress.done / progress.total : 0} />
        <BigButton
          className="min-h-[4.25rem] text-2xl shadow-[var(--shadow-soft)]"
          disabled={!cta.enabled}
          onClick={() => {
            warmUpVoices();
            router.push(withDebugDate(`/learn/${content.pack.id}`, dateParam));
          }}
        >
          {cta.label}
        </BigButton>
        {cta.sub ? <p className="text-center text-lg text-slate-600">{cta.sub}</p> : null}
        {lesson ? (
          <p className="text-center text-sm font-medium text-slate-500">
            약 {lesson.steps.length}단계 · 퀴즈 {lesson.quiz.length}문항
          </p>
        ) : null}
      </section>

      <StampRow cells={weekStamps(state, dateKey)} emphasized />

      <MyPacks state={state} manifest={manifest} dateParam={dateParam} update={update} dateKey={dateKey} />

      <div className="flex justify-end">
        <Link href={withDebugDate("/parent", dateParam)} className="px-1 py-1 text-sm text-slate-500">
          부모
        </Link>
      </div>

      {isDebug ? (
        <DebugPanel
          dateKey={dateKey}
          onReset={onReset}
          lessonCount={content.lessons.length}
          onCompleteUpTo={(n) => void update((s) => completeLessonsUpTo(s, content, n, dateKey))}
        />
      ) : null}
    </Screen>
  );
}

function DebugPanel({
  dateKey,
  onReset,
  lessonCount,
  onCompleteUpTo,
}: {
  dateKey: DateKey;
  onReset: () => Promise<void>;
  lessonCount: number;
  onCompleteUpTo: (n: number) => void;
}) {
  const link = (d: DateKey) => `/?date=${d}`;
  const [n, setN] = useState(String(lessonCount));
  const count = Number(n);
  const validCount = Number.isInteger(count) && count >= 1 && count <= lessonCount;
  return (
    <section aria-label="디버그" className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-base text-slate-800">
      <p className="font-bold">DEBUG · 오늘 = {dateKey}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link className="rounded-lg bg-white px-3 py-2 ring-1 ring-amber-300" href={link(addDays(dateKey, -1))}>
          ◀ 전날
        </Link>
        <Link className="rounded-lg bg-white px-3 py-2 ring-1 ring-amber-300" href={link(addDays(dateKey, 1))}>
          다음 날 ▶
        </Link>
        <Link className="rounded-lg bg-white px-3 py-2 ring-1 ring-amber-300" href="/">
          실제 오늘
        </Link>
        <button
          type="button"
          className="rounded-lg bg-white px-3 py-2 text-rose-700 ring-1 ring-rose-300"
          onClick={() => {
            if (window.confirm("이 기기의 기록을 모두 지울까요?")) void onReset();
          }}
        >
          기록 초기화
        </button>
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (validCount) onCompleteUpTo(count);
        }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={lessonCount}
          value={n}
          onChange={(e) => setN(e.target.value)}
          aria-label="완료 처리할 장 수"
          className="w-20 rounded-lg bg-white px-3 py-2 text-center ring-1 ring-amber-300"
        />
        <button type="submit" disabled={!validCount} className="rounded-lg bg-white px-3 py-2 ring-1 ring-amber-300 disabled:opacity-50">
          장까지 완료 처리
        </button>
      </form>
    </section>
  );
}
