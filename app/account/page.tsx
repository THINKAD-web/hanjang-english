import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountScreen } from "@/components/parent/account-screen";

export const metadata: Metadata = { title: "설정 · 오늘 한장" };

export default function AccountPage() {
  return (
    <Suspense>
      <AccountScreen />
    </Suspense>
  );
}
