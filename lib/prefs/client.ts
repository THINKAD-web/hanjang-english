"use client";

const PREFS_KEY = "hanjang-prefs-v1";

export type ClientPrefs = { sfx: boolean };

const DEFAULT: ClientPrefs = { sfx: true };

function readRaw(): ClientPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<ClientPrefs>;
    return { sfx: parsed.sfx !== false };
  } catch {
    return DEFAULT;
  }
}

export function loadPrefs(): ClientPrefs {
  if (typeof window === "undefined") return DEFAULT;
  return readRaw();
}

export function savePrefs(next: ClientPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // 무시
  }
}

export function setSfxEnabled(on: boolean): ClientPrefs {
  const next = { ...loadPrefs(), sfx: on };
  savePrefs(next);
  return next;
}
