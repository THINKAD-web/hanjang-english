import type { Metadata } from "next";
import { Suspense } from "react";
import { ParentScreen } from "@/components/parent/parent-screen";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("부모 요약") };

export default function ParentPage() {
  return (
    <Suspense>
      <ParentScreen />
    </Suspense>
  );
}
