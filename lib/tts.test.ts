import { afterEach, describe, expect, it, vi } from "vitest";

type FakeUtterance = { text: string; onstart?: () => void; onend?: () => void; onerror?: (e: { error: string }) => void };

function installSpeech(speakImpl: (u: FakeUtterance) => void) {
  class Utterance {
    constructor(public text: string) {}
  }
  const speechSynthesis = { getVoices: () => [], cancel() {}, resume() {}, speak: speakImpl };
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("window", { speechSynthesis, SpeechSynthesisUtterance: Utterance });
}

async function loadTts() {
  vi.resetModules();
  return import("./tts");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("speak", () => {
  it("재생이 끝나면 true", async () => {
    installSpeech((u) => {
      setTimeout(() => u.onstart?.(), 5);
      setTimeout(() => u.onend?.(), 10);
    });
    const { speak } = await loadTts();
    await expect(speak("grape")).resolves.toBe(true);
  });

  it("speechSynthesis.speak 가 예외를 던져도 reject 하지 않고 false (진행이 막히면 안 됨)", async () => {
    installSpeech(() => {
      throw new TypeError("not supported");
    });
    const { speak } = await loadTts();
    await expect(speak("grape")).resolves.toBe(false);
  });

  it("시작하지 않으면(음성 없음) 타임아웃 후 false", async () => {
    vi.useFakeTimers();
    installSpeech(() => {});
    const { speak } = await loadTts();
    const p = speak("grape");
    await vi.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toBe(false);
  });

  it("시작했는데 onend 가 안 오면(iOS) 상한 시간 뒤 true", async () => {
    vi.useFakeTimers();
    installSpeech((u) => setTimeout(() => u.onstart?.(), 5));
    const { speak } = await loadTts();
    const p = speak("grape");
    await vi.advanceTimersByTimeAsync(9000);
    await expect(p).resolves.toBe(true);
  });

  it("speechSynthesis 가 없는 기기는 false", async () => {
    vi.stubGlobal("window", {});
    const { speak, ttsSupported } = await loadTts();
    expect(ttsSupported()).toBe(false);
    await expect(speak("grape")).resolves.toBe(false);
  });
});
