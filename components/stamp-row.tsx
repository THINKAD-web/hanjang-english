import type { StampCell } from "@/lib/engine/progress";

/** 이번 주 도장 7칸 (월~일) */
export function StampRow({ cells }: { cells: StampCell[] }) {
  return (
    <section aria-label="이번 주 도장">
      <h2 className="mb-2 text-lg font-semibold text-slate-700">이번 주 도장</h2>
      <ol className="grid grid-cols-7 gap-1.5">
        {cells.map((c) => (
          <li key={c.dateKey} className="flex flex-col items-center gap-1">
            <span className={`text-base ${c.isToday ? "font-bold text-sky-800" : "text-slate-600"}`}>{c.label}</span>
            <span
              className={`flex aspect-square w-full items-center justify-center rounded-xl text-2xl ${
                c.stamped ? "bg-rose-100 ring-2 ring-rose-300" : c.isToday ? "bg-white ring-2 ring-sky-600" : "bg-white ring-1 ring-amber-200"
              }`}
              role="img"
              aria-label={`${c.label}요일 ${c.stamped ? "도장 있음" : "도장 없음"}`}
            >
              {c.stamped ? <span className="stamp-mark" aria-hidden>💮</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
