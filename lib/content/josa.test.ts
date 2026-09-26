import { describe, expect, it } from "vitest";
import { meaningPrompt, topicParticle } from "./josa";

describe("topicParticle", () => {
  it.each([
    ["대문", "은"],
    ["추운", "은"],
    ["선물", "은"],
    ["주다", "는"],
    ["자라다", "는"],
    ["다리", "는"],
    // 여러 뜻이면 마지막 뜻
    ["무리, 모둠", "은"],
    ["골, 목표", "는"],
    ["반, 수업", "은"],
    // 괄호 설명은 무시
    ["풀(접착제)", "은"],
    // 한글이 아니면 받침 없음
    ["OK", "는"],
  ] as const)("%s → %s", (text, particle) => {
    expect(topicParticle(text)).toBe(particle);
  });
});

describe("meaningPrompt", () => {
  it("따옴표 + 조사 + 물음표", () => {
    expect(meaningPrompt("대문")).toBe('"대문"은?');
    expect(meaningPrompt("자라다")).toBe('"자라다"는?');
  });
});
