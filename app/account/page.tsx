import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountScreen } from "@/components/parent/account-screen";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("설정") };

export default function AccountPage() {
  return (
    <Suspense>
      <AccountScreen />
    </Suspense>
  );
}
