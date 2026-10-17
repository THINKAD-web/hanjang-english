"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 조건이 참이면 화면을 그려 둔 채로 to 로 교체 이동한다 (알 수 없는 팩·빈 팩·잠긴 팩 방어). */
export function useRedirect(when: boolean, to: string): void {
  const router = useRouter();
  useEffect(() => {
    if (when) router.replace(to);
  }, [when, to, router]);
}
