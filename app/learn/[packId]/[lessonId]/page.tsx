import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReviewScreen } from "@/components/learn/review-screen";
import { CONTENT_REGISTRY } from "@/lib/content/load";

export const metadata: Metadata = { title: "다시 보기 · 오늘 한장" };

export default async function LearnLessonReviewPage({ params }: PageProps<"/learn/[packId]/[lessonId]">) {
  const { packId, lessonId } = await params;
  if (!(packId in CONTENT_REGISTRY)) notFound();
  return (
    <Suspense>
      <ReviewScreen packId={packId} lessonId={lessonId} />
    </Suspense>
  );
}
