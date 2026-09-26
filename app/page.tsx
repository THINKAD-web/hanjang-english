import { Suspense } from "react";
import { TodayLabel, TodayLabelFallback } from "@/components/today-label";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="text-4xl font-bold">한장영어</h1>
      <Suspense fallback={<TodayLabelFallback />}>
        <TodayLabel />
      </Suspense>
      <p className="text-lg text-slate-500">준비 중이에요.</p>
    </main>
  );
}
