"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConsonantRow } from "@/components/consonant-row";
import { StampRow } from "@/components/stamp-row";
import { BigButton, ProgressBar, Screen } from "@/components/ui";
import { loadContent } from "@/lib/content/load";
import { addDays, formatDateLabel, type DateKey } from "@/lib/engine/date";
import { homeCta, packProgress, weekStamps } from "@/lib/engine/progress";
import { decideToday } from "@/lib/engine/today";
import type { State } from "@/lib/store/types";
import { warmUpVoices } from "@/lib/tts";
import { useProgress } from "@/lib/use-progress";
import { isDebug, useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";

const content = loadContent();

export function HomeScreen() {
  const dateKey = useTodayKey();
  const { state, reset } = useProgress();
  if (!dateKey || !state) return <HomeSkeleton />;
  return <HomeReady dateKey={dateKey} state={state} onReset={reset} />;
}

function HomeReady({ dateKey, state, onReset }: { dateKey: DateKey; state: State; onReset: () => Promise<void> }) {
  const router = useRouter();
  const dateParam = useDateParam();
  const decision = decideToday(state, dateKey, content);
  const cta = homeCta(decision, content);
  const progress = packProgress(state, content);

  return (
    <Screen>
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold text-slate-900">한장영어</h1>
        <p className="text-xl font-semibold text-slate-700">{formatDateLabel(dateKey)}</p>
      </header>

      <ProgressBar label={`${content.pack.consonant} · ${progress.done}/${progress.total}장`} ratio={progress.done / progress.total} />

      <div className="flex flex-col gap-2">
        <BigButton
          className="min-h-24 text-3xl"
          disabled={!cta.enabled}
          onClick={() => {
            warmUpVoices();
            router.push(withDebugDate("/sheet", dateParam));
          }}
        >
          {cta.label}
        </BigButton>
        {cta.sub ? <p className="text-center text-lg text-slate-600">{cta.sub}</p> : null}
      </div>

      <StampRow cells={weekStamps(state, dateKey)} />
      <ConsonantRow active={content.pack.consonant} />

      {isDebug ? <DebugPanel dateKey={dateKey} onReset={onReset} /> : null}
    </Screen>
  );
}

function HomeSkeleton() {
  return (
    <Screen>
      <h1 className="text-3xl font-bold text-slate-900">한장영어</h1>
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
