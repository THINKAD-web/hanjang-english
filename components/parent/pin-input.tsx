"use client";

import { PIN_LENGTH } from "@/lib/parent/pin";

/** 숫자 4자리 입력. 폰에서 숫자 키패드가 뜨도록 inputMode="numeric". 숫자 외 입력은 버린다. */
export function PinInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-2 text-lg font-semibold text-slate-700">
      {label}
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={PIN_LENGTH}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
        className="min-h-16 rounded-2xl bg-white px-4 text-center text-3xl tracking-[0.5em] text-slate-900 outline-none ring-2 ring-sky-200 focus:ring-sky-600"
      />
    </label>
  );
}
