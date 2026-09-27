import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnScreen } from "@/components/learn/learn-screen";
import { CONTENT_REGISTRY } from "@/lib/content/load";

export const metadata: Metadata = { title: "오늘 한 장 · 오늘 한장" };

export default async function LearnPage({ params }: PageProps<"/learn/[packId]">) {
  const { packId } = await params;
  if (!(packId in CONTENT_REGISTRY)) notFound();
  return (
    <Suspense>
      <LearnScreen packId={packId} />
    </Suspense>
  );
}
