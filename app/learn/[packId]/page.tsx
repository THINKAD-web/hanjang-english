import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnScreen } from "@/components/learn/learn-screen";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("오늘 한 장") };

/** 알 수 없는 팩이면 화면이 /packs 로 안내한다 (콘텐츠는 빌드 산출물이라 서버가 목록을 갖고 있지 않다). */
export default async function LearnPage({ params }: PageProps<"/learn/[packId]">) {
  const { packId } = await params;
  return (
    <Suspense>
      <LearnScreen packId={packId} />
    </Suspense>
  );
}
