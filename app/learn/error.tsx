"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BigButton, Screen } from "@/components/ui";

/** 학습 중 예외 — 기록은 localStorage 에 남아 있고, 홈으로 돌아갈 수 있다. */
export default function LearnError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[learn]", error);
  }, [error]);

  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-3xl font-bold text-slate-900">학습 중 문제가 생겼어요</p>
        <p className="text-lg text-slate-600">처음부터 다시 시작하거나 홈으로 돌아갈 수 있어요.</p>
      </div>
      <div className="flex flex-col gap-3">
        <BigButton onClick={() => reset()}>다시 시도</BigButton>
        <Link href="/" className="text-center text-base text-sky-800 underline">
          홈으로
        </Link>
      </div>
    </Screen>
  );
}
