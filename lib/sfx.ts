"use client";

import { loadPrefs } from "@/lib/prefs/client";

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function tone(freq: number, durationMs: number, volume = 0.08): void {
  if (!loadPrefs().sfx) return;
  const ac = audioContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + durationMs / 1000);
  void ac.resume();
}

export function sfxCorrect(): void {
  tone(880, 90);
  setTimeout(() => tone(1175, 100), 80);
}

export function sfxWrong(): void {
  tone(220, 140, 0.06);
}

export function sfxStamp(): void {
  tone(523, 80);
  setTimeout(() => tone(784, 120), 70);
  setTimeout(() => tone(1047, 150), 140);
}
