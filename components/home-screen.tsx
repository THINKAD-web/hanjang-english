"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadContent, loadPacksSummary } from "@/lib/content/load";
import { addDays, formatDateLabel, type DateKey } from "@/lib/engine/date";
import { homeCta, packProgress, weekStamps } from "@/lib/engine/progress";
import { decideToday } from "@/lib/engine/today";
import type { State } from "@/lib/store/types";
import { warmUpVoices } from "@/lib/tts";
import { useProgress } from "@/lib/use-progress";
import { isDebug, useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";
import { StampRow } from "./stamp-row";
import { BigButton, ProgressBar, Screen } from "./ui";

const DEFAULT_PACK_ID = "en-kid-giyeok";
const content = loadContent(DEFAULT_PACK_ID);

export function HomeScreen() {
  const dateKey = useTodayKey();
  const { state, reset } = useProgress();
  if (!dateKey || !state) return <HomeSkeleton />;
  return <HomeReady dateKey={dateKey} state={state} onReset={reset} />;
}

/** 홈 정보구조 (기획안 v2 7-1): 이어서 카드 + 이번 주 도장 + 내 팩. */
function HomeReady({ dateKey, state, onReset }: { dateKey: DateKey; state: State; onReset: () => Promise<void> }) {
  const router = useRouter();
  const dateParam = useDateParam();
  const decision = decideToday(state, dateKey, content);
  const cta = homeCta(decision, content);
  const progress = packProgress(state, content);
  const packs = loadPacksSummary();
  const livePacks = packs.filter((p) => p.status === "live");
  const soonPacks = packs.filter((p) => p.status === "soon");

  return (
    <Screen>
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold text-slate-900">오늘 한장</h1>
        <p className="text-xl font-semibold text-slate-700">{formatDateLabel(dateKey)}</p>
      </header>

      <section aria-label="이어서" className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-amber-200">
        <p className="text-lg font-semibold text-slate-700">
          이어서 — {content.pack.title} · {content.pack.unitLabel} {progress.done}/{progress.total}
        </p>
        <ProgressBar label={`${content.pack.unitLabel} · ${progress.done}/${progress.total}장`} ratio={progress.done / progress.total} />
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

      <StampRow cells={weekStamps(state, dateKey, content.pack.id)} />

      <section aria-label="내 팩">
        <h2 className="mb-2 text-lg font-semibold text-slate-700">내 팩</h2>
        <ul className="flex flex-col gap-2">
          {livePacks.map((p) => (
            <li key={p.id}>
              <Link
                href={`/packs/${p.id}`}
                className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 ring-1 ring-amber-200"
              >
                <span className="text-lg font-semibold text-slate-900">
                  {p.title} · {p.unitLabel}
                </span>
                <span className="text-sky-700">진행 중 ›</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/packs"
              className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 text-slate-500 ring-1 ring-slate-200"
            >
              <span className="text-lg font-semibold">+ 팩 추가</span>
              <span className="text-sm">{soonPacks.length}개 준비 중</span>
            </Link>
          </li>
        </ul>
      </section>

      {isDebug ? <DebugPanel dateKey={dateKey} onReset={onReset} /> : null}
    </Screen>
  );
}

function HomeSkeleton() {
  return (
    <Screen>
      <h1 className="text-3xl font-bold text-slate-900">오늘 한장</h1>
      <div className="h-24 animate-pulse rounded-2xl bg-amber-100" aria-hidden />
    </Screen>
  );
}

/** NEXT_PUBLIC_DEBUG=true 일 때만: 날짜 이동과 기록 초기화 (Preview 수동 검증용) */
function DebugPanel({ dateKey, onReset }: { dateKey: DateKey; onReset: () => Promise<void> }) {
  const link = (d: DateKey) => `/?date=${d}`;
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
    </section>
  );
}
