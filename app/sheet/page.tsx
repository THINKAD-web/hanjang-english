import type { Metadata } from "next";
import { Suspense } from "react";
import { SheetScreen } from "@/components/sheet/sheet-screen";

export const metadata: Metadata = { title: "오늘 한 장 · 한장영어" };

export default function SheetPage() {
  return (
    <Suspense>
      <SheetScreen />
    </Suspense>
  );
}
