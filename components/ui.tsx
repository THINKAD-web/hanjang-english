import type { ButtonHTMLAttributes, ReactNode } from "react";
import { speak } from "@/lib/tts";

/** 큰 주 버튼. 높이 56px 이상, 글자 24px. */
export function BigButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-16 w-full rounded-2xl bg-sky-700 px-6 text-2xl font-bold text-white shadow-sm transition active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-600 ${className}`}
    />
  );
}

/** 🔊 다시 듣기 */
export function SpeakButton({ text, audio, label = "다시 듣기" }: { text: string; audio?: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => void speak(text, audio)}
      className="inline-flex min-h-14 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-amber-100 px-5 text-xl font-semibold text-amber-900 ring-1 ring-amber-300 active:scale-95"
    >
      <span aria-hidden>🔊</span>
      {label}
    </button>
  );
}

/** 상단 진행 바: "ㄱ · 3/8장" + 단계 진행률 */
export function ProgressBar({ label, ratio }: { label: string; ratio: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div className="w-full">
      <p className="mb-1 text-lg font-semibold text-slate-700">{label}</p>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-amber-100"
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

export function Screen({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-10 pt-6">{children}</main>;
}
