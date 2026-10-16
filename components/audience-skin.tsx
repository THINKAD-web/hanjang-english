"use client";

import { useEffect } from "react";
import { activeProfile, audienceOf } from "@/lib/packs/catalog";
import { useProgress } from "@/lib/use-progress";

/** 쓰는 프로필에 맞춰 <html data-audience="kid|adult"> 를 바꾼다. 색 차이는 globals.css 의 [data-audience] 규칙이 맡는다. */
export function AudienceSkin() {
  const { state } = useProgress();
  const audience = state ? audienceOf(activeProfile(state)) : null;
  useEffect(() => {
    if (audience) document.documentElement.dataset.audience = audience;
  }, [audience]);
  return null;
}
