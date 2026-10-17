import { describe, expect, it } from "vitest";
import { meaningPrompt, objectParticle, topicParticle } from "./josa";

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

describe("숫자로 끝나는 말과 을/를", () => {
  it.each([
    ["덧셈 1", "은", "을"],
    ["덧셈 2", "는", "를"],
    ["덧셈 3", "은", "을"],
    ["뺄셈 6", "은", "을"],
    ["뺄셈 9", "는", "를"],
    ["공책", "은", "을"],
    ["소리", "는", "를"],
  ] as const)("%s → %s / %s", (text, topic, object) => {
    expect(topicParticle(text)).toBe(topic);
    expect(objectParticle(text)).toBe(object);
  });
});
