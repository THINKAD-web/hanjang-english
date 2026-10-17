import type { Metadata } from "next";
import { Suspense } from "react";
import { ParentScreen } from "@/components/parent/parent-screen";

export const metadata: Metadata = { title: "부모 요약 · 오늘 한장" };

export default function ParentPage() {
  return (
    <Suspense>
      <ParentScreen />
    </Suspense>
  );
}
