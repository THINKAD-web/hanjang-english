"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeChip, StreakPill, TodayDateBadge, WeekCalendar } from "@/components/design-system";
import { LoadFailed, Screen } from "@/components/ui";
import { DEFAULT_PACK_ID } from "@/lib/content/defaults";
import type { Content } from "@/lib/content/schema";
import { useManifest, usePackContent } from "@/lib/content/use-content";
import { objectParticle } from "@/lib/content/josa";
import { continuePackId, isOpenPack } from "@/lib/packs/catalog";
import { recordParentView } from "@/lib/engine/progress";
import { BADGE_LABEL, earnedBadges, groupWrongByTag, learningStreak, studyMinutesFromEvents } from "@/lib/engine/stats";
import { toggleWrongReview } from "@/lib/parent/account";
import { attemptLabel, currentWrong, listedWrongIds, todaySummary, weekSummary, wrongWordById, type WrongWord } from "@/lib/parent/summary";
import { shouldRecordParentView } from "@/lib/parent/view";
import { useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";
import { ParentGate, type ParentApi } from "./parent-gate";

const VIEW_KEY = "hanjang-parent-view-at";

function readLastView(): number | null {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function writeLastView(ms: number): void {
  try {
    sessionStorage.setItem(VIEW_KEY, String(ms));
  } catch {
    // 무시
  }
}

function recordViewOnce(dateKey: string, packId: string, update: ParentApi["update"]): void {
  const now = Date.now();
  if (!shouldRecordParentView(readLastView(), now)) return;
  writeLastView(now);
  void update((s) => recordParentView(s, { dateKey, at: new Date(now).toISOString(), payload: { packId, dateKey } }));
}

export function ParentScreen() {
  return <ParentGate>{(api) => <ParentLoader {...api} />}</ParentGate>;
}

function ParentLoader(api: ParentApi) {
  const manifest = useManifest();
  const [picked, setPicked] = useState<string | null>(null);
  const options = useMemo(() => {
    if (manifest.status !== "ready") return [];
    const mine = new Set(api.state.tracks.filter((t) => t.profileId === api.state.activeProfileId).map((t) => t.packId));
    return manifest.data.packs.filter((p) => isOpenPack(p) && mine.has(p.id));
  }, [manifest, api.state.tracks, api.state.activeProfileId]);
  const fallback = manifest.status === "ready" ? continuePackId(api.state, manifest.data) : null;
  const packId =
    picked && options.some((p) => p.id === picked)
      ? picked
      : (options.find((p) => p.id === api.state.activePackId)?.id ?? options[0]?.id ?? fallback ?? DEFAULT_PACK_ID);
  const pack = usePackContent(manifest.status === "ready" ? packId : null);
  if (manifest.status === "error" || pack.status === "error" || pack.status === "missing") return <LoadFailed />;
  if (manifest.status !== "ready" || pack.status !== "ready") {
    return (
      <Screen>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }
  return (
    <ParentContent {...api} content={pack.data} packOptions={options.map((p) => ({ id: p.id, title: p.title }))} onPickPack={setPicked} />
  );
}

function ParentContent({
  state,
  update,
  content,
  packOptions,
  onPickPack,
}: ParentApi & { content: Content; packOptions: { id: string; title: string }[]; onPickPack: (id: string) => void }) {
  const dateKey = useTodayKey();
  const dateParam = useDateParam();
  const packId = content.pack.id;
  const textLang = content.pack.ttsLang.split("-")[0];
  const [pinned, setPinned] = useState<string[]>([]);
  const [wrongOpen, setWrongOpen] = useState(true);

  useEffect(() => {
    if (dateKey) recordViewOnce(dateKey, packId, update);
  }, [dateKey, packId, update]);

  if (!dateKey) {
    return (
      <Screen>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }

  const today = todaySummary(state, content, dateKey);
  const week = weekSummary(state, content, dateKey);
  const wrongNow = currentWrong(state, content);
  const activeIds = wrongNow.map((w) => w.itemId);
  const listedWrong = listedWrongIds(activeIds, pinned)
    .map((id) => wrongWordById(state, content, id))
    .filter((w): w is WrongWord => w !== null);
  const grouped = groupWrongByTag(listedWrong, content.pack.tagLabel);
  const minutes = studyMinutesFromEvents(state, dateKey, packId);
  const streak = learningStreak(state, dateKey);
  const badges = earnedBadges(state, dateKey, packId);

  const onToggle = (itemId: string, on: boolean) => {
    if (!on) setPinned(listedWrongIds(activeIds, pinned));
    void update((s) => toggleWrongReview(s, packId, itemId, on, dateKey));
  };

  return (
    <Screen>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">부모 요약</h1>
          <StreakPill days={streak} />
        </div>
        <TodayDateBadge dateKey={dateKey} variant="parent" />
      </header>

      {packOptions.length > 1 ? (
        <label className="flex flex-col gap-1 text-base font-semibold text-slate-700">
          팩
          <select
            value={packId}
            onChange={(e) => onPickPack(e.target.value)}
            className="min-h-14 rounded-[var(--radius-card)] bg-white px-4 text-xl font-bold text-slate-900 ring-2 ring-sky-200"
          >
            {packOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {badges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <BadgeChip key={b} label={BADGE_LABEL[b]} />
          ))}
        </div>
      ) : null}

      <section aria-label="오늘 요약" className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-ring)]">
          <p className="text-sm font-bold text-slate-600">오늘 완료</p>
          <p className="text-4xl font-bold text-slate-900">{today.lessonCount}</p>
          <p className="text-sm text-slate-500">장</p>
        </div>
        <div className="rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-ring)]">
          <p className="text-sm font-semibold text-slate-600">학습 시간</p>
          <p className="text-4xl font-bold text-slate-900">{minutes}</p>
          <p className="text-sm text-slate-500">분 (추정)</p>
        </div>
      </section>

      <section aria-label="오늘 상세" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-ring)]">
        <h2 className="text-xl font-bold text-slate-900">오늘</h2>
        {today.done ? (
          <>
            <p className="text-xl font-semibold text-emerald-700">오늘 장 완료 ✅</p>
            {today.attempts.map((a, i) => (
              <p key={i} className="text-lg text-slate-800">
                {attemptLabel(a)}
              </p>
            ))}
            {today.wrong.length > 0 ? (
              <p className="text-base text-amber-800">오늘 틀린 항목 {today.wrong.length}개</p>
            ) : (
              <p className="text-lg text-emerald-700">틀린 항목이 없어요 👏</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xl font-semibold text-slate-700">아직이에요</p>
            <p className="text-lg text-slate-600">오늘은 아직 푼 문제가 없어요</p>
          </>
        )}
      </section>

      <WeekCalendar cells={week.stamps} title="이번 주 도장" />
      <p className="text-lg font-semibold text-slate-800">이번 주 {week.doneCount}장 완료</p>
      {week.trickySounds.length > 0 ? (
        <p className="text-lg text-slate-800">
          {week.trickySounds.join(", ")} {content.pack.tagLabel}
          {objectParticle(content.pack.tagLabel)} 자주 헷갈려요
        </p>
      ) : null}

      <section aria-label="현재 오답" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-ring)]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">현재 오답 {wrongNow.length}개</h2>
          <button type="button" className="text-base font-semibold text-sky-800 underline" onClick={() => setWrongOpen((o) => !o)}>
            {wrongOpen ? "접기" : "펼치기"}
          </button>
        </div>
        {wrongNow.length > 0 ? (
          <Link
            href={withDebugDate(`/learn/${packId}/wrong`, dateParam)}
            className="flex min-h-14 items-center justify-center rounded-[var(--radius-card)] bg-sky-700 text-lg font-bold text-white"
          >
            오답만 다시 풀기
          </Link>
        ) : (
          <p className="text-lg text-slate-600">복습 예정인 오답이 없어요</p>
        )}
        {wrongOpen && listedWrong.length > 0 ? (
          <div className="flex flex-col gap-4">
            {[...grouped.entries()].map(([tag, words]) => (
              <div key={tag}>
                <p className="mb-2 text-base font-bold text-slate-700">{tag}</p>
                <WrongList words={words} onToggle={onToggle} lang={textLang} />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <nav className="mt-auto flex justify-between text-base">
        <Link href={withDebugDate("/account", dateParam)} className="text-sky-800 underline">
          설정
        </Link>
        <Link href={withDebugDate("/", dateParam)} className="text-sky-800 underline">
          홈으로
        </Link>
      </nav>
    </Screen>
  );
}

function WrongList({ words, onToggle, lang }: { words: WrongWord[]; onToggle: (itemId: string, on: boolean) => void; lang: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {words.map((w) => (
        <li key={w.itemId} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3">
          <span className="min-w-0">
            <span lang={lang} className="block text-xl font-bold text-slate-900">
              {w.text}
            </span>
            <span className="block text-base text-slate-600">{w.meaningKo}</span>
          </span>
          <label className="flex shrink-0 items-center gap-2 text-base font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={w.reviewOn}
              onChange={(e) => onToggle(w.itemId, e.target.checked)}
              aria-label={`${w.text} 내일 복습에 넣기`}
              className="h-6 w-6 accent-sky-700"
            />
            내일 복습에 넣기
          </label>
        </li>
      ))}
    </ul>
  );
}
