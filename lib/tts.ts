"use client";

/**
 * 영어 음성 재생. 단어에 audio(mp3) 가 있으면 mp3, 없으면 Web Speech API (en-US, 0.8배속).
 *
 * iOS Safari 는 사용자가 탭한 핸들러 안에서 처음 재생해야 이후 재생이 허용된다.
 * 그래서 "시작" 탭 핸들러에서 첫 단어를 바로 speak() 하고, 이후 단어는 화면 전환 시 자동 재생한다.
 *
 * speak() 는 절대 reject 하지 않는다. 재생했으면 true, 못 했으면 false.
 * 기기에 음성이 없거나 onend 가 오지 않는 경우에도 진행이 막히지 않도록 타임아웃을 둔다.
 */

export const TTS_RATE = 0.8;
/** 음성을 못 쓰는 기기에서 "다음" 을 켜기까지 기다리는 시간 */
export const NO_TTS_DELAY_MS = 1500;
/** speak 후 이 시간 안에 시작하지 않으면 재생 실패로 본다 */
const START_TIMEOUT_MS = 2500;
/** 시작은 했는데 끝 이벤트가 오지 않을 때의 상한 (iOS 에서 onend 누락 사례) */
const MAX_UTTERANCE_MS = 8000;

export function ttsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.speechSynthesis) &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function englishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined && cachedVoice !== null) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null; // 아직 로드 전 — lang 만 지정해서 재생
  cachedVoice =
    voices.find((v) => v.lang === "en-US" && v.localService) ??
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
  return cachedVoice;
}

function speakWithSynthesis(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    let started = false;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(startTimer);
      clearTimeout(maxTimer);
      resolve(ok);
    };

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = TTS_RATE;
    const voice = englishVoice();
    if (voice) u.voice = voice;
    u.onstart = () => {
      started = true;
    };
    u.onend = () => finish(true);
    u.onerror = (e) => finish(e.error === "interrupted" || e.error === "canceled" ? started : false);

    const startTimer = setTimeout(() => {
      if (!started) finish(false);
    }, START_TIMEOUT_MS);
    const maxTimer = setTimeout(() => finish(started), MAX_UTTERANCE_MS);

    try {
      synth.cancel();
      // Chrome 에서 가끔 paused 상태로 멈추는 문제
      synth.resume();
      synth.speak(u);
    } catch {
      finish(false);
    }
  });
}

let currentAudio: HTMLAudioElement | null = null;

function playAudio(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    currentAudio?.pause();
    const audio = new Audio(src);
    currentAudio = audio;
    const maxTimer = setTimeout(() => resolve(true), MAX_UTTERANCE_MS);
    audio.onended = () => {
      clearTimeout(maxTimer);
      resolve(true);
    };
    audio.onerror = () => {
      clearTimeout(maxTimer);
      resolve(false);
    };
    audio.play().catch(() => {
      clearTimeout(maxTimer);
      resolve(false);
    });
  });
}

/** 영어 텍스트(또는 mp3)를 재생하고 끝나면 resolve. 실패해도 reject 하지 않고 false. */
export async function speak(text: string, audioSrc?: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (audioSrc && (await playAudio(audioSrc))) return true;
    if (!ttsSupported()) return false;
    return await speakWithSynthesis(text);
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  currentAudio?.pause();
  if (ttsSupported()) window.speechSynthesis.cancel();
}

/** 음성 목록을 미리 불러온다 (Chrome/Android 는 비동기 로드). */
export function warmUpVoices(): void {
  if (!ttsSupported()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    cachedVoice = undefined;
  });
}
