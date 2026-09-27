"use client";

import { useState } from "react";
import { BigButton, Screen } from "@/components/ui";

/**
 * `/learn/[packId]` 에서 decideToday 가 lesson/review 가 아닌 결과를 반환할 때 보여주는
 * 3가지 안내 화면 (PR4 지시서 3·4·5장). 엔진 판단은 건드리지 않고 화면만 연결한다.
 */

export function DoneTodayScreen({ canDoExtra, onExtra, onHome }: { canDoExtra: boolean; onExtra: () => void; onHome: () => void }) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="stamp-in flex h-28 w-28 items-center justify-center rounded-full bg-rose-100 text-7xl ring-4 ring-rose-300" aria-hidden>
          🎉
        </div>
        <p className="text-3xl font-bold text-slate-900">오늘 장 끝! 잘했어요</p>
        {canDoExtra ? (
          <>
            <p className="text-xl text-slate-700">어제 못한 장이 있어요. 하나 더 할까요?</p>
            <div className="mt-auto w-full">
              <BigButton onClick={onExtra}>하나 더 하기</BigButton>
            </div>
          </>
        ) : (
          <div className="mt-auto w-full">
            <BigButton onClick={onHome}>홈으로</BigButton>
          </div>
        )}
      </div>
    </Screen>
  );
}

export function DailyLimitScreen({ onHome }: { onHome: () => void }) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-amber-100 text-7xl ring-4 ring-amber-300" aria-hidden>
          🌙
        </div>
        <p className="text-3xl font-bold text-slate-900">오늘은 여기까지!</p>
        <p className="text-xl text-slate-700">내일 또 만나요.</p>
        <div className="mt-auto w-full">
          <BigButton onClick={onHome}>홈으로</BigButton>
        </div>
      </div>
    </Screen>
  );
}

export function PackCompleteScreen({
  unitLabel,
  wordCount,
  onRequestNextPack,
}: {
  unitLabel: string;
  wordCount: number;
  onRequestNextPack: () => void;
}) {
  const [requested, setRequested] = useState(false);

  const handleClick = () => {
    if (requested) return;
    onRequestNextPack();
    setRequested(true);
  };

  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="stamp-in flex h-32 w-32 items-center justify-center rounded-full bg-rose-100 text-8xl ring-4 ring-rose-300" aria-hidden>
          🏆
        </div>
        <p className="text-4xl font-bold text-slate-900">{unitLabel} 팩 완료! 🎉</p>
        <p className="text-2xl text-slate-800">
          지금까지 배운 단어 <strong className="text-sky-800">{wordCount}개</strong>
        </p>
        <div className="mt-auto w-full">
          <BigButton disabled={requested} onClick={handleClick}>
            {requested ? "부모님께 전달했어요" : `${unitLabel} 팩 열어달라고 부모님께 말하기`}
          </BigButton>
        </div>
      </div>
    </Screen>
  );
}
