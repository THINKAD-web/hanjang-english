"use client";

import { useRouter } from "next/navigation";
import { BigButton, LoadFailed, Screen } from "@/components/ui";
import { useManifest, usePackContent } from "@/lib/content/use-content";
import { completedLessonIds } from "@/lib/engine/today";
import { PackBlockedScreen } from "@/components/learn/pack-blocked-screen";
import { packBlockReason } from "@/lib/packs/availability";
import { isUnlocked } from "@/lib/packs/catalog";
import { useProgress } from "@/lib/use-progress";
import { useDateParam, useTodayKey, withDebugDate } from "@/lib/use-today-key";
import { LessonRunner } from "./lesson-runner";

/**
 * `/learn/[packId]/[lessonId]` — 이미 끝낸 장만 다시 볼 수 있다. **읽기 전용**: 퀴즈는 풀 수 있지만
 * Attempt·도장·오답 큐에는 반영되지 않는다 (PR3 지시서 5장). 아직 끝내지 않은(잠긴) 장으로 들어오면
 * `/packs/[packId]` 로, 알 수 없는 팩이면 `/packs` 로 되돌린다.
 */
export function ReviewScreen({ packId, lessonId }: { packId: string; lessonId: string }) {
  const dateKey = useTodayKey();
  const dateParam = useDateParam();
  const { state } = useProgress();
  const router = useRouter();
  const pack = usePackContent(packId);
  const manifest = useManifest();

  const content = pack.status === "ready" ? pack.data : null;
  const lesson = content?.lessons.find((l) => l.id === lessonId);
  const catalogLocked =
    pack.status === "ready" && Boolean(state) && manifest.status === "ready" && !isUnlocked(state!, pack.data.pack, manifest.data);
  const block = packBlockReason(pack, catalogLocked);
  const reviewLocked = Boolean(state && content && !completedLessonIds(state, packId).includes(lessonId));

  if (pack.status === "error") return <LoadFailed />;
  if (block) return <PackBlockedScreen reason={block} packId={packId} />;
  if (!dateKey || !state || !content) {
    return (
      <Screen>
        <div className="h-40 animate-pulse rounded-3xl bg-amber-100" aria-hidden />
      </Screen>
    );
  }
  if (!lesson || reviewLocked) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-3xl font-bold text-slate-900">{!lesson ? "장을 찾을 수 없어요" : "아직 끝내지 않은 장이에요"}</p>
          <p className="text-lg text-slate-600">
            {!lesson ? "다른 장을 골라 주세요." : "오늘 한 장을 끝내면 다시 볼 수 있어요."}
          </p>
        </div>
        <BigButton type="button" onClick={() => router.push(withDebugDate(`/packs/${packId}`, dateParam))}>
          팩 목록으로
        </BigButton>
      </Screen>
    );
  }

  return (
    <LessonRunner
      content={content}
      lesson={lesson}
      dateKey={dateKey}
      sheetId={`${lesson.id}-review`}
      banner="다시 보기 (기록에 반영되지 않아요)"
      onHome={() => router.push(withDebugDate(`/packs/${packId}`, dateParam))}
    />
  );
}
