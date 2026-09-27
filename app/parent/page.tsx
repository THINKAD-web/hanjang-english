import type { Metadata } from "next";

export const metadata: Metadata = { title: "부모 요약 · 오늘 한장" };

/** 자리만 (기획안 v2 6장). 오늘 요약·주간·설정은 PR5 에서 만든다. */
export default function ParentPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-2xl font-bold text-slate-900">부모 요약</p>
      <p className="text-lg text-slate-600">준비 중이에요. 곧 오늘 요약과 주간 도장을 볼 수 있어요.</p>
    </main>
  );
}
