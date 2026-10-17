"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BRAND } from "@/lib/brand";
import type { Manifest } from "@/lib/content/bundle";
import type { Content } from "@/lib/content/schema";
import { useManifest, usePackContent } from "@/lib/content/use-content";
import { addDays, formatDateLabel, type DateKey } from "@/lib/engine/date";
import { homeCta, packProgress, weekStamps } from "@/lib/engine/progress";
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
  // 이어서 카드가 가리킬 팩 — 마지막으로 연 팩 → 진행 중인 팩 → (아이 프로필이면) 기본 팩
  const continueId = state && manifest.status === "ready" ? continuePackId(state, manifest.data) : null;
  const pack = usePackContent(continueId);
  if (manifest.status === "error" || pack.status === "error") return <LoadFailed />;
  if (!dateKey || !state || manifest.status !== "ready") return <HomeSkeleton />;
  if (!continueId) return <HomeNoPack dateKey={dateKey} state={state} manifest={manifest.data} />;
  if (pack.status === "missing") return <LoadFailed />;
  if (pack.status !== "ready") return <HomeSkeleton />;
  return <HomeReady dateKey={dateKey} state={state} onReset={reset} update={update} manifest={manifest.data} content={pack.data} />;
}

/** 이어서 할 팩이 아직 없는 프로필(예: 새로 만든 성인 프로필): 팩 고르기로 안내. */
function HomeNoPack({ dateKey, state, manifest }: { dateKey: DateKey; state: State; manifest: Manifest }) {
  const dateParam = useDateParam();
  return (
    <Screen>
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold text-slate-900">{BRAND.appName}</h1>
        <p className="text-xl font-semibold text-slate-700">{formatDateLabel(dateKey)}</p>
      </header>
      <section aria-label="팩 고르기" className="flex flex-col gap-3 rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-amber-200">
        <p className="text-xl font-semibold text-slate-800">{activeProfile(state).name ?? "새 프로필"} · 어떤 팩으로 시작할까요?</p>
        <Link
          href={withDebugDate("/packs", dateParam)}
          className="flex min-h-16 items-center justify-center rounded-2xl bg-sky-700 px-6 text-2xl font-bold text-white"
        >
          팩 고르기
        </Link>
      </section>
      <MyPacks state={state} manifest={manifest} dateParam={dateParam} />
    </Screen>
  );
}

/** 홈 "내 팩": 진행 중인 팩 최대 3개 + 전체 보기. 팩 추가·준비 중 목록은 /packs 에서. */
function MyPacks({ state, manifest, dateParam }: { state: State; manifest: Manifest; dateParam: string | null }) {
  const mine = inProgressPacks(state, manifest, MY_PACKS_MAX);
  return (
    <section aria-label="내 팩">
      <h2 className="mb-2 text-lg font-semibold text-slate-700">내 팩</h2>
      <ul className="flex flex-col gap-2">
        {mine.map((p) => {
          const { done, total } = packProgressOf(state, p);
          return (
            <li key={p.id}>
              <Link
                href={withDebugDate(`/packs/${p.id}`, dateParam)}
                className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 ring-1 ring-amber-200"
              >
                <span className="text-lg font-semibold text-slate-900">
                  {p.title} · {unitLabelOf(p)}
                </span>
                <span className="text-sky-700">
                  {done}/{total} ›
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href={withDebugDate("/packs", dateParam)}
            className="flex w-full items-center justify-between rounded-2xl bg-white px-5 py-3 text-slate-600 ring-1 ring-slate-200"
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

/** 홈 정보구조 (기획안 v2 7-1): 이어서 카드 + 이번 주 도장 + 내 팩. */
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

  return (
    <Screen>
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold text-slate-900">{BRAND.appName}</h1>
        <p className="text-xl font-semibold text-slate-700">{formatDateLabel(dateKey)}</p>
      </header>

      <section aria-label="이어서" className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-amber-200">
        <p className="text-lg font-semibold text-slate-700">
          이어서 — {content.pack.title} · {unitLabelOf(content.pack)} {progress.done}/{progress.total}
        </p>
        <ProgressBar label={`${unitLabelOf(content.pack)} · ${progress.done}/${progress.total}장`} ratio={progress.done / progress.total} />
        <BigButton
          className="min-h-24 text-3xl"
          disabled={!cta.enabled}
          onClick={() => {
            warmUpVoices();
            router.push(withDebugDate(`/learn/${content.pack.id}`, dateParam));
          }}
        >
          {cta.label}
        </BigButton>
        {cta.sub ? <p className="text-center text-lg text-slate-600">{cta.sub}</p> : null}
      </section>

      <StampRow cells={weekStamps(state, dateKey)} />

      <MyPacks state={state} manifest={manifest} dateParam={dateParam} />

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

function HomeSkeleton() {
  return (
    <Screen>
      <h1 className="text-3xl font-bold text-slate-900">{BRAND.appName}</h1>
      <div className="h-24 animate-pulse rounded-2xl bg-amber-100" aria-hidden />
    </Screen>
  );
}

/** NEXT_PUBLIC_DEBUG=true 일 때만: 날짜 이동, 기록 초기화, N장까지 완료 처리 (Preview 수동 검증용) */
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
