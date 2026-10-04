/**
 * 부모 PIN. 이 PIN 은 아이가 실수로 부모 화면에 들어오는 것을 막는 문일 뿐이며 보안 기능이 아니다.
 * (4자리 숫자는 해시를 알아도 금방 찾을 수 있고, 저장소도 이 기기의 localStorage 하나뿐이다.)
 */

export const PIN_LENGTH = 4;

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** SubtleCrypto SHA-256 → 16진 문자열. 앱 이름을 앞에 붙여 다른 곳의 같은 숫자와 해시가 겹치지 않게 한다. */
export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`hanjang:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPin(pin: string, hash: string | null): Promise<boolean> {
  if (!hash || !isValidPin(pin)) return false;
  return (await hashPin(pin)) === hash;
}

/** "PIN을 잊었어요" 확인 문제: 두 자리 × 한 자리 곱셈 (예 37 × 6). */
export type MultiplyChallenge = { a: number; b: number; answer: number };

export function makeMultiplyChallenge(rng: () => number = Math.random): MultiplyChallenge {
  const a = 10 + Math.floor(rng() * 90); // 10..99
  const b = 2 + Math.floor(rng() * 8); // 2..9
  return { a, b, answer: a * b };
}

export function checkMultiplyAnswer(challenge: MultiplyChallenge, input: string): boolean {
  const trimmed = input.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) === challenge.answer;
}
