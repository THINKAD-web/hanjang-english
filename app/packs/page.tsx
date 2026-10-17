import type { Metadata } from "next";
import { Suspense } from "react";
import { PacksScreen } from "@/components/packs/packs-screen";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("내 팩") };

export default function PacksPage() {
  return (
    <Suspense>
      <PacksScreen />
    </Suspense>
  );
}
