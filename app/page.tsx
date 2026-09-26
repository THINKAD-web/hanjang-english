import { Suspense } from "react";
import { HomeScreen } from "@/components/home-screen";

export default function Home() {
  return (
    <Suspense>
      <HomeScreen />
    </Suspense>
  );
}
