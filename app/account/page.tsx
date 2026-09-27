import type { Metadata } from "next";

export const metadata: Metadata = { title: "설정 · 오늘 한장" };

/** 자리만 (기획안 v2 6장). PIN·프로필·구독은 이후 PR. */
export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-2xl font-bold text-slate-900">설정</p>
      <p className="text-lg text-slate-600">준비 중이에요.</p>
    </main>
  );
}
