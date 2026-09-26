const CONSONANTS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

/** 자음 줄: ㄱ 만 열림, 나머지는 🔒 준비 중 */
export function ConsonantRow({ active = "ㄱ" }: { active?: string }) {
  return (
    <section aria-label="자음 팩">
      <h2 className="mb-2 text-lg font-semibold text-slate-700">
        자음 팩 <span className="text-base font-normal text-slate-600">· 🔒 준비 중</span>
      </h2>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {CONSONANTS.map((c) =>
          c === active ? (
            <li
              key={c}
              className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-sky-700 text-2xl font-bold text-white"
            >
              {c}
            </li>
          ) : (
            <li
              key={c}
              className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200"
              aria-label={`${c} 준비 중`}
            >
              <span className="text-xl">{c}</span>
              <span className="text-sm" aria-hidden>
                🔒
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
