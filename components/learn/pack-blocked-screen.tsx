"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/design-system";
import { BigButton, Screen } from "@/components/ui";
import { packBlockCopy, type PackBlockReason } from "@/lib/packs/availability";
import { useDateParam, withDebugDate } from "@/lib/use-today-key";

/** 잠금·미공개·없는 팩 — /packs 로 조용히 보내지 않고 이유를 보여준다. */
export function PackBlockedScreen({ reason, packId }: { reason: PackBlockReason; packId?: string }) {
  const router = useRouter();
  const dateParam = useDateParam();
  const { title, body } = packBlockCopy(reason);
  const packsHref = withDebugDate("/packs", dateParam);
  const detailHref = packId ? withDebugDate(`/packs/${packId}`, dateParam) : packsHref;

  return (
    <Screen>
      <EmptyState icon="📦" title={title} body={body} />
      <div className="flex flex-col gap-3">
        <BigButton type="button" onClick={() => router.push(packsHref)}>
          팩 목록으로
        </BigButton>
        {reason === "locked" && packId ? (
          <Link href={detailHref} className="text-center text-base text-sky-800 underline">
            이 팩 소개 보기
          </Link>
        ) : null}
        <Link href={withDebugDate("/", dateParam)} className="text-center text-base text-sky-800 underline">
          홈으로
        </Link>
      </div>
    </Screen>
  );
}
