import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewScreen } from "@/components/learn/review-screen";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("다시 보기") };

export default async function LearnLessonReviewPage({ params }: PageProps<"/learn/[packId]/[lessonId]">) {
  const { packId, lessonId } = await params;
  return (
    <Suspense>
      <ReviewScreen packId={packId} lessonId={lessonId} />
    </Suspense>
  );
}
