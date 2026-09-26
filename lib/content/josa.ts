/**
 * 한국어 조사 은/는.
 * 뜻이 "무리, 모둠" 처럼 여러 개면 마지막 뜻, "풀(접착제)" 처럼 괄호 설명이 붙으면 괄호 앞 낱말로 판단한다.
 * 마지막 글자가 한글이 아니면 받침 없음(는)으로 본다.
 */

function lastHangul(text: string): string | undefined {
  const core = text.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const last = core.split(",").pop()?.trim() ?? core;
  return last.at(-1);
}

export function hasBatchim(text: string): boolean {
  const ch = lastHangul(text);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** "대문" → "은", "주다" → "는" */
export function topicParticle(text: string): "은" | "는" {
  return hasBatchim(text) ? "은" : "는";
}

/** meaning_choice 문제 문구: `"대문"은?` */
export function meaningPrompt(meaning: string): string {
  return `"${meaning}"${topicParticle(meaning)}?`;
}
