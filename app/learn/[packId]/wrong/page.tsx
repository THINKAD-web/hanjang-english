import type { Metadata } from "next";
import { Suspense } from "react";
import { WrongReviewScreen } from "@/components/learn/wrong-review-screen";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("오답 연습") };

export default async function WrongReviewPage({ params }: PageProps<"/learn/[packId]/wrong">) {
  const { packId } = await params;
  return (
    <Suspense>
      <WrongReviewScreen packId={packId} />
    </Suspense>
  );
}
