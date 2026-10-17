"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";
import { StampRow } from "@/components/stamp-row";
import { DEFAULT_PACK_ID, loadContent } from "@/lib/content/load";
import { formatDateLabel } from "@/lib/engine/date";
import { recordParentView } from "@/lib/engine/progress";
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
    // 무시 — 저장이 막히면 열 때마다 기록된다
  }
}

/** 열람 이벤트 기록. 같은 탭에서 10분 안 재열람은 건너뛴다. */
function recordViewOnce(dateKey: string, packId: string, update: ParentApi["update"]): void {
  const now = Date.now();
  if (!shouldRecordParentView(readLastView(), now)) return;
  writeLastView(now);
  void update((s) => recordParentView(s, { dateKey, at: new Date(now).toISOString(), payload: { packId, dateKey } }));
}

/** `/parent` — PIN 통과 후 오늘 요약 · 이번 주 · 현재 오답. 그래프 없이 텍스트와 작은 칸만 (PR5 지시서 3장). */
export function ParentScreen() {
  return <ParentGate>{(api) => <ParentContent {...api} />}</ParentGate>;
}

function ParentContent({ state, update }: ParentApi) {
  const dateKey = useTodayKey();
  const dateParam = useDateParam();
  const content = loadContent(DEFAULT_PACK_ID);
  const packId = content.pack.id;
  // 이 화면에서 끈 오답도 되돌릴 수 있게 목록에 남겨 두는 순서 (화면을 다시 열면 비워진다)
  const [pinned, setPinned] = useState<string[]>([]);

  // 통과 후 화면이 열릴 때마다 parent_view. 같은 탭에서 10분 안 재열람(새로고침 포함)은 1회로 센다.
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
  const onToggle = (itemId: string, on: boolean) => {
    if (!on) setPinned(listedWrongIds(activeIds, pinned));
    void update((s) => toggleWrongReview(s, packId, itemId, on, dateKey));
  };

  return (
    <Screen>
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold text-slate-900">부모 요약</h1>
        <p className="text-lg font-semibold text-slate-700">{formatDateLabel(dateKey)}</p>
      </header>

      <section aria-label="오늘 요약" className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
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
              <div className="flex flex-col gap-2">
                <p className="text-base font-semibold text-slate-700">오늘 틀린 단어</p>
                <WrongList words={today.wrong} onToggle={onToggle} />
              </div>
            ) : (
              <p className="text-lg text-emerald-700">틀린 단어가 없어요 👏</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xl font-semibold text-slate-700">아직이에요</p>
            <p className="text-lg text-slate-600">오늘은 아직 푼 문제가 없어요</p>
          </>
        )}
      </section>

      <section aria-label="이번 주 요약" className="flex flex-col gap-3">
        <StampRow cells={week.stamps} />
        <p className="text-lg font-semibold text-slate-800">이번 주 {week.doneCount}장 완료</p>
        {week.trickySounds.length > 0 ? (
          <p className="text-lg text-slate-800">{week.trickySounds.join(", ")} 소리를 자주 헷갈려요</p>
        ) : null}
      </section>

      <section aria-label="현재 오답" className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
        <h2 className="text-xl font-bold text-slate-900">현재 오답</h2>
        {wrongNow.length > 0 ? (
          <p className="text-lg text-slate-800">
            복습 예정 {wrongNow.length}개: {wrongNow.map((w) => w.text).join(", ")}
          </p>
        ) : (
          <p className="text-lg text-slate-600">복습 예정인 오답이 없어요</p>
        )}
        {listedWrong.length > 0 ? <WrongList words={listedWrong} onToggle={onToggle} /> : null}
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

function WrongList({ words, onToggle }: { words: WrongWord[]; onToggle: (itemId: string, on: boolean) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {words.map((w) => (
        <li key={w.itemId} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3">
          <span className="min-w-0">
            <span lang="en" className="block text-xl font-bold text-slate-900">
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
