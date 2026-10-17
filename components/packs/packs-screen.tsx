"use client";

import Link from "next/link";
import { useState } from "react";
import { LoadFailed, PreReleaseBadge, ProgressBar, Screen } from "@/components/ui";
import type { Manifest, ManifestPack } from "@/lib/content/bundle";
import { objectParticle } from "@/lib/content/josa";
import { unitLabelOf } from "@/lib/content/pack-text";
import type { Audience } from "@/lib/content/schema";
import { useManifest } from "@/lib/content/use-content";
import { isPreRelease } from "@/lib/content/visibility";
import { recordPackInterest } from "@/lib/engine/progress";
import {
  activeProfile,
  audienceOf,
  isOpenPack,
  isUnlocked,
  levelsOf,
  openPackCountForAudience,
  openPackCountForSubject,
  packProgressOf,
  packsOf,
  subjectsOf,
} from "@/lib/packs/catalog";
import type { State } from "@/lib/store/types";
import { useProgress } from "@/lib/use-progress";
import { isDebug, useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";

const AUDIENCE_LABEL: Record<Audience, string> = { kid: "어린이", adult: "성인" };

/**
 * `/packs` — 대상(어린이/성인) 탭 → 과목 카드 → 레벨 칩 → 팩 카드 (대량 개발 지시서 9장).
 * 목록은 content/ 의 pack.json·subjects.json 에서 오므로 새 과목·레벨·팩은 데이터만 넣으면 여기에 나타난다.
 */
export function PacksScreen() {
  const manifest = useManifest();
  const { state, update } = useProgress();
  const dateKey = useTodayKey();
  if (manifest.status === "error" || manifest.status === "missing") return <LoadFailed />;
  if (manifest.status !== "ready" || !state) {
    return (
      <Screen>
        <h1 className="text-3xl font-bold text-slate-900">내 팩</h1>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }
  return <PacksReady manifest={manifest.data} state={state} update={update} dateKey={dateKey} />;
}

function PacksReady({
  manifest,
  state,
  update,
  dateKey,
}: {
  manifest: Manifest;
  state: State;
  update: (fn: (s: State) => State) => Promise<State>;
  dateKey: string | null;
}) {
  const dateParam = useDateParam();
  const [audience, setAudience] = useState<Audience>(audienceOf(activeProfile(state)));
  const [subjectPick, setSubjectPick] = useState<string | null>(null);
  const [levelPick, setLevelPick] = useState<number | null>(null);
  const [interest, setInterest] = useState<string | null>(null);

  const subjects = subjectsOf(manifest, audience);
  const subject = subjects.find((s) => s.id === subjectPick) ?? subjects[0];
  const levels = subject ? levelsOf(manifest, subject.id) : [];
  const level = levels.find((l) => l.levelOrder === levelPick) ?? levels[0];
  const packs = subject && level ? packsOf(manifest, subject.id, level.levelOrder) : [];
  const audienceOpenTotal = openPackCountForAudience(manifest, audience);

  const onSoon = (p: ManifestPack) => {
    setInterest(p.id);
    const today = dateKey ?? new Date().toISOString().slice(0, 10);
    void update((s) => recordPackInterest(s, { dateKey: today, at: new Date().toISOString(), payload: { packId: p.id, source: "packs" } }));
  };

  return (
    <Screen>
      <h1 className="text-3xl font-bold text-slate-900">내 팩</h1>
      <p className="text-base text-slate-600">
        과목을 고르고 오늘 풀 팩을 시작해요 · 이 탭에 열린 팩 {audienceOpenTotal}개
      </p>

      <div role="tablist" aria-label="대상" className="grid grid-cols-2 gap-2">
        {(["kid", "adult"] as const).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={audience === a}
            onClick={() => {
              setAudience(a);
              setSubjectPick(null);
              setLevelPick(null);
            }}
            className={`min-h-14 rounded-2xl text-xl font-bold ${audience === a ? "bg-sky-700 text-white" : "bg-white text-slate-800 ring-2 ring-sky-200"}`}
          >
            {AUDIENCE_LABEL[a]}
          </button>
        ))}
      </div>

      {subjects.length === 0 ? (
        <p className="rounded-2xl bg-white px-5 py-6 text-center text-lg text-slate-600 ring-1 ring-amber-200">아직 준비된 과목이 없어요</p>
      ) : (
        <>
          <section aria-label="과목" className="grid grid-cols-2 gap-3">
            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === subject.id}
                onClick={() => {
                  setSubjectPick(s.id);
                  setLevelPick(null);
                }}
                className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-xl font-bold ${
                  s.id === subject.id
                    ? "bg-amber-200 text-slate-900 ring-2 ring-amber-400"
                    : "bg-white text-slate-800 ring-1 ring-amber-200"
                }`}
              >
                <span aria-hidden className="text-3xl">
                  {s.icon ?? "📘"}
                </span>
                <span className="leading-tight">
                  {s.name}
                  <span className="mt-0.5 block text-sm font-semibold text-slate-600">팩 {openPackCountForSubject(manifest, s.id)}</span>
                </span>
              </button>
            ))}
          </section>

          {levels.length > 1 ? (
            <section aria-label="레벨" className="flex flex-wrap gap-2">
              {levels.map((l) => (
                <button
                  key={l.levelOrder}
                  type="button"
                  aria-pressed={l.levelOrder === level.levelOrder}
                  onClick={() => setLevelPick(l.levelOrder)}
                  className={`min-h-12 rounded-full px-5 text-lg font-semibold ${
                    l.levelOrder === level.levelOrder ? "bg-sky-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-300"
                  }`}
                >
                  {l.level}
                </button>
              ))}
            </section>
          ) : null}

          <ul className="flex flex-col gap-3" aria-label="팩">
            {packs.map((p) => (
              <li key={p.id}>
                <PackCard
                  pack={p}
                  state={state}
                  locked={p.status === "live" && !isUnlocked(state, p, manifest)}
                  afterTitle={p.unlock ? manifest.packs.find((x) => x.id === p.unlock!.afterPackId)?.title : undefined}
                  href={withDebugDate(`/packs/${p.id}`, dateParam)}
                  onSoon={() => onSoon(p)}
                />
              </li>
            ))}
          </ul>
          {interest ? (
            <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-center text-base text-slate-700">
              준비 중이에요. 열어 달라는 마음을 기록해 두었어요 🙌
            </p>
          ) : null}
        </>
      )}

      <nav className="mt-auto text-center text-base">
        <Link href={withDebugDate("/", dateParam)} className="text-sky-800 underline">
          홈으로
        </Link>
      </nav>
    </Screen>
  );
}

function PackCard({
  pack,
  state,
  locked,
  afterTitle,
  href,
  onSoon,
}: {
  pack: ManifestPack;
  state: State;
  locked: boolean;
  afterTitle?: string;
  href: string;
  onSoon: () => void;
}) {


  // Debug 에서는 레슨이 있는 준비 중 팩도 열어 볼 수 있다. Production 에서는 목록에만 보인다.
  const openable = isOpenPack(pack);
  const preRelease = isDebug && (pack.status !== "live" || pack.lessons.some((l) => isPreRelease(pack, l)));
  const title = (
    <>
      <span className="block text-xl font-bold">{pack.title}</span>
      <span className="block text-base text-slate-600">{pack.brandLabel ?? unitLabelOf(pack)}</span>
      {preRelease ? <PreReleaseBadge /> : null}
    </>
  );

  if (!openable) {
    return (
      <button
        type="button"
        onClick={onSoon}
        className="flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 text-left text-slate-500 ring-1 ring-slate-200"
      >
        <span>{title}</span>
        <span className="shrink-0 text-sm">🔒 준비 중</span>
      </button>
    );
  }
  if (locked) {
    return (
      <div
        className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-slate-500 ring-1 ring-slate-200"
        aria-disabled="true"
      >
        <span>{title}</span>
        <span className="shrink-0 text-right text-sm">
          🔒 {afterTitle ? `${afterTitle}${objectParticle(afterTitle)} 끝내면` : "앞 팩을 끝내면"}
        </span>
      </div>
    );
  }
  const { done, total } = packProgressOf(state, pack);
  return (
    <Link href={href} className="flex flex-col gap-2 rounded-2xl bg-white px-5 py-4 text-slate-900 shadow-sm ring-1 ring-amber-200">
      <span className="flex items-center justify-between">
        <span>{title}</span>
        <span className="shrink-0 text-sky-700">{done > 0 ? "이어서 ›" : "시작 ›"}</span>
      </span>
      <ProgressBar label={`${unitLabelOf(pack)} · ${done}/${total}장`} ratio={total > 0 ? done / total : 0} />
    </Link>
  );
}
