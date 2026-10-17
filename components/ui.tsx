import type { ButtonHTMLAttributes, ReactNode } from "react";
import { speak } from "@/lib/tts";
import { useSpeechLang } from "@/lib/tts-lang";

/** 큰 주 버튼. 높이 56px 이상, 글자 24px. */
export function BigButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-[3.25rem] w-full rounded-[var(--radius-card)] bg-[var(--color-accent)] px-6 text-2xl font-bold text-white shadow-[var(--shadow-soft)] transition active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-600 ${className}`}
    />
  );
}

/** 🔊 다시 듣기 */
export function SpeakButton({ text, audio, label = "다시 듣기" }: { text: string; audio?: string; label?: string }) {
  const lang = useSpeechLang();
  return (
    <button
      type="button"
      onClick={() => void speak(text, audio, lang)}
      className="inline-flex min-h-14 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-amber-100 px-5 text-xl font-semibold text-amber-900 ring-1 ring-amber-300 active:scale-95"
    >
      <span aria-hidden>🔊</span>
      {label}
    </button>
  );
}

/** Debug(Preview) 에서만 보이는 "검수 전" 표시 — 공개 조건(live · 검수 완료 · testOnly 아님)을 못 채운 레슨/팩. */
export function PreReleaseBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-200 px-2 py-0.5 text-sm font-bold text-yellow-900" title="Production 에는 나가지 않아요">
      검수 전
    </span>
  );
}

/** 상단 진행 바: "ㄱ · 3/8장" + 단계 진행률 */
export function ProgressBar({ label, ratio }: { label: string; ratio: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div className="w-full">
      {label ? <p className="mb-1 text-base font-bold text-slate-700">{label}</p> : null}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-amber-100/90 shadow-inner"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Screen({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return (
    <main
      className={`mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-5 ${compact ? "gap-4" : "gap-6"}`}
    >
      {children}
    </main>
  );
}

/** 콘텐츠를 불러오지 못했을 때 (네트워크 등). 다시 시도하면 새로 요청한다. */
export function LoadFailed({ message = "내용을 불러오지 못했어요" }: { message?: string }) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-2xl font-bold text-slate-900">{message}</p>
        <BigButton onClick={() => window.location.reload()}>다시 시도</BigButton>
      </div>
    </Screen>
  );
}
