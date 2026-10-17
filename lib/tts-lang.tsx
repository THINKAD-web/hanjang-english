"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_TTS_LANG } from "@/lib/tts";

/** 화면 아래쪽의 🔊 버튼·자동 재생이 팩의 읽기 언어(pack.ttsLang)를 알도록 하는 컨텍스트. */
const SpeechLangContext = createContext<string>(DEFAULT_TTS_LANG);

export function SpeechLangProvider({ lang, children }: { lang: string; children: ReactNode }) {
  return <SpeechLangContext.Provider value={lang}>{children}</SpeechLangContext.Provider>;
}

export function useSpeechLang(): string {
  return useContext(SpeechLangContext);
}
