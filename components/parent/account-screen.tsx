"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/design-system";
import { BigButton, Screen } from "@/components/ui";
import { loadPrefs, setSfxEnabled } from "@/lib/prefs/client";
import { todayKey } from "@/lib/engine/date";
import { addProfile, resetProgress, setGrade, setParentPin, switchProfile } from "@/lib/parent/account";
import { activeProfile } from "@/lib/packs/catalog";
import type { Profile } from "@/lib/store/types";
import { hashPin, isValidPin, verifyPin } from "@/lib/parent/pin";
import { useDateParam, withDebugDate } from "@/lib/use-today-key";
import { ParentGate, type ParentApi } from "./parent-gate";
import { PinInput } from "./pin-input";

/** `/account` — 학년·PIN 변경·기록 내보내기·전체 초기화 (PR5 지시서 4장). */
export function AccountScreen() {
  return <ParentGate>{(api) => <AccountContent {...api} />}</ParentGate>;
}

function AccountContent({ state, update }: ParentApi) {
  const dateParam = useDateParam();
  const current = activeProfile(state);
  const grade = current.grade;
  const [resetDone, setResetDone] = useState(false);
  const [exportPreview, setExportPreview] = useState(false);
  const [sfx, setSfx] = useState(() => loadPrefs().sfx);

  const exportPreviewJson = useMemo(
    () =>
      JSON.stringify(
        {
          stateVersion: state.stateVersion,
          activeProfileId: state.activeProfileId,
          profiles: state.profiles.map((p) => ({ id: p.id, type: p.type, name: p.name, grade: p.grade })),
          attemptCount: state.attempts.length,
          wrongQueueCount: state.wrongQueue.length,
          eventCount: state.events.length,
          note: "PIN 해시·전체 Attempt 내용은 미리보기에 포함하지 않아요",
        },
        null,
        2,
      ),
    [state],
  );

  // 파일명 날짜는 기기의 실제 오늘 (디버그 날짜가 아니라).
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hanjang-export-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = async () => {
    if (!window.confirm("정말 모든 진행 기록을 지울까요?\n지운 기록은 되돌릴 수 없어요.")) return;
    await update(resetProgress);
    setResetDone(true);
  };

  return (
    <Screen>
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold text-slate-900">설정</h1>
        <Link href={withDebugDate("/parent", dateParam)} className="text-base text-sky-800 underline">
          부모 요약
        </Link>
      </header>

      <ProfilesSection
        profiles={state.profiles}
        activeId={state.activeProfileId}
        onSwitch={(id) => void update((s) => switchProfile(s, id))}
        onAdd={(input) => update((s) => addProfile(s, input))}
      />

      {current.type === "child" ? (
        <section aria-label="학년" className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
          <h2 className="text-xl font-bold text-slate-900">학년</h2>
          <div className="grid grid-cols-2 gap-3">
            {([3, 4] as const).map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={grade === g}
                onClick={() => void update((s) => setGrade(s, g))}
                className={`min-h-14 rounded-2xl text-xl font-bold ${
                  grade === g ? "bg-sky-700 text-white" : "bg-white text-slate-800 ring-2 ring-sky-200"
                }`}
              >
                {g}학년
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <PinChange pinHash={state.account.pinHash} onChange={(hash) => update((s) => setParentPin(s, hash))} />

      <section aria-label="효과음" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-ring)]">
        <h2 className="text-xl font-bold text-slate-900">효과음</h2>
        <label className="flex items-center justify-between gap-3 text-lg font-semibold text-slate-800">
          정답·도장 소리
          <input
            type="checkbox"
            checked={sfx}
            onChange={(e) => setSfx(setSfxEnabled(e.target.checked).sfx)}
            className="h-7 w-7 accent-sky-700"
          />
        </label>
        <p className="text-sm text-slate-600">단어 읽기(TTS)와는 별개예요. 이 기기에만 저장돼요.</p>
      </section>

      <section aria-label="기록 내보내기" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-ring)]">
        <h2 className="text-xl font-bold text-slate-900">사용 기록 내보내기</h2>
        <p className="text-base text-slate-600">이 기기에 저장된 기록 전체를 JSON 파일로 내려받아요.</p>
        <div className="grid grid-cols-2 gap-2">
          <BigButton onClick={exportJson}>내보내기</BigButton>
          <button
            type="button"
            onClick={() => setExportPreview((p) => !p)}
            className="min-h-[3.25rem] rounded-[var(--radius-card)] bg-white text-lg font-bold text-sky-800 ring-2 ring-sky-200"
          >
            {exportPreview ? "미리보기 닫기" : "미리보기"}
          </button>
        </div>
        {exportPreview ? (
          <pre className="max-h-48 overflow-auto rounded-xl bg-slate-50 p-3 text-left text-xs text-slate-700">{exportPreviewJson}</pre>
        ) : null}
      </section>

      <section aria-label="전체 초기화" className="mt-auto flex flex-col gap-3 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200">
        <h2 className="text-xl font-bold text-rose-800">전체 초기화</h2>
        <p className="text-base text-slate-700">진도·점수·오답 기록을 모두 지워요. PIN과 학년은 남아요.</p>
        <button
          type="button"
          onClick={() => void reset()}
          className="min-h-16 w-full rounded-2xl bg-rose-700 px-6 text-2xl font-bold text-white active:scale-[0.98]"
        >
          모든 기록 지우기
        </button>
        <p className="min-h-6 text-center text-base font-semibold text-rose-800" role="status">
          {resetDone ? "초기화했어요" : ""}
        </p>
      </section>

      <nav className="text-center text-base">
        <Link href={withDebugDate("/", dateParam)} className="text-sky-800 underline">
          홈으로
        </Link>
      </nav>
    </Screen>
  );
}

function PinChange({ pinHash, onChange }: { pinHash: string | null; onChange: (hash: string) => Promise<unknown> }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await verifyPin(current, pinHash))) {
      setMsg({ ok: false, text: "현재 PIN이 맞지 않아요" });
      return;
    }
    if (next !== again) {
      setMsg({ ok: false, text: "새 PIN을 두 번 다르게 입력했어요" });
      return;
    }
    await onChange(await hashPin(next));
    setCurrent("");
    setNext("");
    setAgain("");
    setMsg({ ok: true, text: "PIN을 바꿨어요" });
  };

  return (
    <section aria-label="PIN 변경" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-slate-900">PIN 변경</h2>
        <PinInput label="현재 PIN" value={current} onChange={setCurrent} />
        <PinInput label="새 PIN" value={next} onChange={setNext} />
        <PinInput label="새 PIN 확인" value={again} onChange={setAgain} />
        <p className={`min-h-6 text-center text-base font-semibold ${msg?.ok ? "text-emerald-700" : "text-rose-700"}`} role="status">
          {msg?.text ?? ""}
        </p>
        <BigButton type="submit" disabled={!isValidPin(current) || !isValidPin(next) || !isValidPin(again)}>
          PIN 바꾸기
        </BigButton>
      </form>
    </section>
  );
}

const PROFILE_TYPE_LABEL: Record<Profile["type"], string> = { child: "아이", self: "나(성인)" };

/** 프로필 목록 · 전환 · 추가. 아이 프로필은 어린이 과목, 나(성인) 프로필은 성인 과목을 먼저 보여준다. */
function ProfilesSection({
  profiles,
  activeId,
  onSwitch,
  onAdd,
}: {
  profiles: Profile[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: (input: { name: string; type: Profile["type"]; grade?: 3 | 4 }) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Profile["type"]>("self");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdd({ name, type });
    setName("");
  };

  return (
    <section aria-label="프로필" className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
      <h2 className="text-xl font-bold text-slate-900">프로필</h2>
      <ul className="flex flex-col gap-2">
        {profiles.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <ProfileAvatar name={p.name} type={p.type} />
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold text-slate-900">{p.name ?? PROFILE_TYPE_LABEL[p.type]}</span>
                <span className="block text-base text-slate-600">{PROFILE_TYPE_LABEL[p.type]}</span>
              </span>
            </span>
            {p.id === activeId ? (
              <span className="shrink-0 rounded-full bg-sky-700 px-4 py-2 text-base font-semibold text-white">사용 중</span>
            ) : (
              <button
                type="button"
                onClick={() => onSwitch(p.id)}
                className="min-h-12 shrink-0 rounded-full bg-white px-4 text-base font-semibold text-sky-800 ring-2 ring-sky-200"
              >
                이 프로필로 전환
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-base font-semibold text-slate-700">
          새 프로필 이름
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="예: 엄마"
            className="min-h-12 rounded-xl bg-white px-4 text-lg ring-2 ring-sky-200"
          />
        </label>
        <div role="radiogroup" aria-label="프로필 종류" className="grid grid-cols-2 gap-3">
          {(["self", "child"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={`min-h-12 rounded-2xl text-lg font-bold ${type === t ? "bg-sky-700 text-white" : "bg-white text-slate-800 ring-2 ring-sky-200"}`}
            >
              {PROFILE_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <BigButton type="submit">프로필 추가</BigButton>
      </form>
    </section>
  );
}
