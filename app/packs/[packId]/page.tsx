import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PackDetailScreen } from "@/components/learn/pack-detail-screen";
import { CONTENT_REGISTRY, loadContent } from "@/lib/content/load";

export async function generateMetadata({ params }: PageProps<"/packs/[packId]">): Promise<Metadata> {
  const { packId } = await params;
  const content = packId in CONTENT_REGISTRY ? loadContent(packId) : null;
  return { title: content ? `${content.pack.title} · 오늘 한장` : "오늘 한장" };
}

export default async function PackDetailPage({ params }: PageProps<"/packs/[packId]">) {
  const { packId } = await params;
  if (!(packId in CONTENT_REGISTRY)) notFound();
  return (
    <Suspense>
      <PackDetailScreen packId={packId} />
    </Suspense>
  );
}
