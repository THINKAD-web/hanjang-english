"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { BigButton, Screen } from "@/components/ui";
import { setParentPin } from "@/lib/parent/account";
import { checkMultiplyAnswer, hashPin, isValidPin, makeMultiplyChallenge, verifyPin, type MultiplyChallenge } from "@/lib/parent/pin";
import type { State } from "@/lib/store/types";
import { useProgress } from "@/lib/use-progress";
import { useDateParam, withDebugDate } from "@/lib/use-today-key";
import { PinInput } from "./pin-input";

/**
 * 부모 화면 입구. 이 PIN 은 아이가 실수로 들어오는 것을 막는 문일 뿐이며 보안 기능이 아니다.
 * 한 번 통과하면 sessionStorage 에 표시해서 같은 탭에서는 /parent ↔ /account 를 오가도 다시 묻지 않는다.
 * 탭을 닫으면 풀린다.
 */

const UNLOCK_KEY = "hanjang-parent-unlocked";

function readUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function writeUnlocked(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    // 저장이 막혀 있으면 이 화면에서만 열린 채로 둔다 (다른 화면으로 가면 다시 묻는다)
  }
}

const noopSubscribe = () => () => {};

export type ParentApi = { state: State; update: (fn: (s: State) => State) => Promise<State> };

export function ParentGate({ children }: { children: (api: ParentApi) => ReactNode }) {
  const { state, update } = useProgress();
  // 서버·하이드레이션 중에는 null (sessionStorage 를 읽지 않는다)
  const stored = useSyncExternalStore<boolean | null>(noopSubscribe, readUnlocked, () => null);
  const [unlockedNow, setUnlockedNow] = useState(false);
  const [mode, setMode] = useState<"enter" | "forgot" | "reset">("enter");

  if (!state || stored === null) {
    return (
      <Screen>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }
  if (stored || unlockedNow) return <>{children({ state, update })}</>;

  const unlock = () => {
    writeUnlocked();
    setUnlockedNow(true);
  };
  const savePin = async (pin: string) => {
    const hash = await hashPin(pin);
    await update((s) => setParentPin(s, hash));
    unlock();
  };

  if (!state.account.pinHash) {
    return <PinSetup title="부모 PIN 4자리를 정해주세요" hint="아이가 실수로 들어오는 걸 막아주는 번호예요." onSave={savePin} />;
  }
  if (mode === "reset") {
    return <PinSetup title="새 PIN 4자리를 정해주세요" hint="진행 기록은 그대로 남아 있어요." onSave={savePin} />;
  }
  if (mode === "forgot") {
    return <ForgotPin onSolved={() => setMode("reset")} onBack={() => setMode("enter")} />;
  }
  return <PinEntry pinHash={state.account.pinHash} onPass={unlock} onForgot={() => setMode("forgot")} />;
}

function GateShell({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const dateParam = useDateParam();
  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {hint ? <p className="mt-2 text-base text-slate-600">{hint}</p> : null}
        </div>
        {children}
        <Link href={withDebugDate("/", dateParam)} className="text-center text-base text-sky-800 underline">
          홈으로
        </Link>
      </div>
    </Screen>
  );
}

function PinEntry({ pinHash, onPass, onForgot }: { pinHash: string; onPass: () => void; onForgot: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await verifyPin(pin, pinHash)) {
      onPass();
      return;
    }
    setError("PIN이 맞지 않아요");
    setPin("");
  };

  return (
    <GateShell title="부모 PIN을 입력해 주세요">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PinInput label="PIN" value={pin} onChange={setPin} />
        <p className="min-h-6 text-center text-base font-semibold text-rose-700" role="alert">
          {error}
        </p>
        <BigButton type="submit" disabled={!isValidPin(pin)}>
          확인
        </BigButton>
        <button type="button" onClick={onForgot} className="text-center text-base text-sky-800 underline">
          PIN을 잊었어요
        </button>
      </form>
    </GateShell>
  );
}

/** 처음 정할 때와 분실 후 다시 정할 때 같이 쓴다: 한 번 입력 → 한 번 더 입력해서 일치하면 저장. */
function PinSetup({ title, hint, onSave }: { title: string; hint: string; onSave: (pin: string) => Promise<void> }) {
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (first === null) {
      setFirst(pin);
      setPin("");
      setError("");
      return;
    }
    if (pin !== first) {
      setError("두 번 입력한 PIN이 달라요. 처음부터 다시 해주세요");
      setFirst(null);
      setPin("");
      return;
    }
    await onSave(pin);
  };

  return (
    <GateShell title={title} hint={hint}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PinInput label={first === null ? "PIN 4자리" : "한 번 더 입력해 주세요"} value={pin} onChange={setPin} />
        <p className="min-h-6 text-center text-base font-semibold text-rose-700" role="alert">
          {error}
        </p>
        <BigButton type="submit" disabled={!isValidPin(pin)}>
          {first === null ? "다음" : "저장"}
        </BigButton>
      </form>
    </GateShell>
  );
}

/** PIN 분실: 부모 확인 문제(두 자리 × 한 자리)를 맞히면 PIN 만 새로 정한다. 진행 기록은 건드리지 않는다. */
function ForgotPin({ onSolved, onBack }: { onSolved: () => void; onBack: () => void }) {
  const [challenge, setChallenge] = useState<MultiplyChallenge>(() => makeMultiplyChallenge());
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkMultiplyAnswer(challenge, answer)) {
      onSolved();
      return;
    }
    setError("답이 맞지 않아요. 새 문제예요");
    setAnswer("");
    setChallenge(makeMultiplyChallenge());
  };

  return (
    <GateShell title="부모 확인" hint="맞히면 PIN만 새로 정할 수 있어요. 기록은 그대로예요.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-center text-3xl font-bold text-slate-900">
          <span aria-live="polite">
            {challenge.a} × {challenge.b} = ?
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label="답"
            value={answer}
            onChange={(e) => setAnswer(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="min-h-16 rounded-2xl bg-white px-4 text-center text-3xl outline-none ring-2 ring-sky-200 focus:ring-sky-600"
          />
        </label>
        <p className="min-h-6 text-center text-base font-semibold text-rose-700" role="alert">
          {error}
        </p>
        <BigButton type="submit" disabled={answer.length === 0}>
          확인
        </BigButton>
        <button type="button" onClick={onBack} className="text-center text-base text-sky-800 underline">
          PIN 입력으로 돌아가기
        </button>
      </form>
    </GateShell>
  );
}
