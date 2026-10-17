import type { Metadata } from "next";
import { Suspense } from "react";
import { PackDetailScreen } from "@/components/learn/pack-detail-screen";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("팩") };

export default async function PackDetailPage({ params }: PageProps<"/packs/[packId]">) {
  const { packId } = await params;
  return (
    <Suspense>
      <PackDetailScreen packId={packId} />
    </Suspense>
  );
}
