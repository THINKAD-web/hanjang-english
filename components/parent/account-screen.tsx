"use client";

import Link from "next/link";
import { useState } from "react";
import { BigButton, Screen } from "@/components/ui";
import { todayKey } from "@/lib/engine/date";
import { resetProgress, setGrade, setParentPin } from "@/lib/parent/account";
import { hashPin, isValidPin, verifyPin } from "@/lib/parent/pin";
import { DEFAULT_PROFILE_ID } from "@/lib/store/types";
import { useDateParam, withDebugDate } from "@/lib/use-today-key";
import { ParentGate, type ParentApi } from "./parent-gate";
import { PinInput } from "./pin-input";

/** `/account` — 학년·PIN 변경·기록 내보내기·전체 초기화 (PR5 지시서 4장). */
export function AccountScreen() {
  return <ParentGate>{(api) => <AccountContent {...api} />}</ParentGate>;
}

function AccountContent({ state, update }: ParentApi) {
  const dateParam = useDateParam();
  const grade = state.profiles.find((p) => p.id === DEFAULT_PROFILE_ID)?.grade;
  const [resetDone, setResetDone] = useState(false);

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

      <PinChange pinHash={state.account.pinHash} onChange={(hash) => update((s) => setParentPin(s, hash))} />

      <section aria-label="기록 내보내기" className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
        <h2 className="text-xl font-bold text-slate-900">사용 기록 내보내기</h2>
        <p className="text-base text-slate-600">이 기기에 저장된 기록 전체를 JSON 파일로 내려받아요.</p>
        <BigButton onClick={exportJson}>내보내기</BigButton>
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
