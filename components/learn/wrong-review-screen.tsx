"use client";

import { useRouter } from "next/navigation";
import { LoadingSkeleton } from "@/components/design-system";
import { LoadFailed, Screen } from "@/components/ui";
import { usePackContent } from "@/lib/content/use-content";
import { activeItems } from "@/lib/engine/queue";
import { recordSheetAbort, recordSheetComplete, recordSheetStart } from "@/lib/engine/progress";
import { useProgress, newAttemptId } from "@/lib/use-progress";
import { useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";
import { PackBlockedScreen } from "./pack-blocked-screen";
import { packBlockReason } from "@/lib/packs/availability";
import { ReviewRunner } from "./review-runner";

/** 부모/설정에서 진입 — WrongQueue 오답만 복습. 진도(장 완료)는 올리지 않고 Attempt·오답 기록은 갱신한다. */
export function WrongReviewScreen({ packId }: { packId: string }) {
  const dateKey = useTodayKey();
  const dateParam = useDateParam();
  const { state, update } = useProgress();
  const router = useRouter();
  const pack = usePackContent(packId);

  const block =
    pack.status === "missing" ? "missing" : pack.status === "ready" && state ? packBlockReason(pack, false) : null;

  if (pack.status === "error") return <LoadFailed />;
  if (block) return <PackBlockedScreen reason={block} packId={packId} />;
  if (!dateKey || !state || pack.status !== "ready") {
    return (
      <Screen>
        <LoadingSkeleton variant="learn" />
      </Screen>
    );
  }

  const itemIds = activeItems(state.wrongQueue, packId, state.activeProfileId).map((w) => w.itemId);
  if (itemIds.length === 0) {
    return (
      <Screen>
        <p className="text-center text-2xl font-bold text-slate-900">복습할 오답이 없어요</p>
        <button
          type="button"
          className="mt-4 min-h-14 rounded-2xl bg-sky-700 px-6 text-xl font-bold text-white"
          onClick={() => router.push(withDebugDate("/parent", dateParam))}
        >
          부모 요약으로
        </button>
      </Screen>
    );
  }

  return (
    <ReviewRunner
      content={pack.data}
      itemIds={itemIds.slice(0, 8)}
      dateKey={dateKey}
      banner="오답만 다시 풀기 (장 진도·오늘 장 횟수·도장·스트릭에는 반영되지 않아요)"
      onStart={() =>
        void update((s) =>
          recordSheetStart(s, { packId, subjectId: pack.data.pack.subjectId, dateKey, at: new Date().toISOString() }),
        )
      }
      onComplete={(answers) => {
        const finishedAt = new Date().toISOString();
        void update((s) =>
          recordSheetComplete(s, {
            attemptId: newAttemptId(),
            packId,
            subjectId: pack.data.pack.subjectId,
            dateKey,
            kind: "review",
            itemIds: itemIds.slice(0, 8),
            answers,
            startedAt: finishedAt,
            finishedAt,
          }),
        );
      }}
      onAbort={(step, elapsedMs) =>
        void update((s) => recordSheetAbort(s, { packId, dateKey, at: new Date().toISOString(), step, elapsedMs }))
      }
      onHome={() => router.push(withDebugDate("/parent", dateParam))}
    />
  );
}
