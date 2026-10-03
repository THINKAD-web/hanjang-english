import { describe, expect, it } from "vitest";
import { checkMultiplyAnswer, hashPin, isValidPin, makeMultiplyChallenge, verifyPin } from "./pin";

describe("PIN 형식", () => {
  it("숫자 4자리만 유효", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("0000")).toBe(true);
    for (const bad of ["", "123", "12345", "12a4", "12 4", "１２３４"]) expect(isValidPin(bad)).toBe(false);
  });
});

describe("PIN 해시 저장·검증", () => {
  it("같은 PIN 은 같은 SHA-256(64자 16진), 다른 PIN 은 다른 해시", async () => {
    const a = await hashPin("1234");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPin("1234")).toBe(a);
    expect(await hashPin("1235")).not.toBe(a);
  });

  it("해시에 PIN 원문이 들어 있지 않다", async () => {
    expect(await hashPin("1234")).not.toContain("1234");
  });

  it("맞는 PIN 통과, 틀린 PIN 거부", async () => {
    const hash = await hashPin("4821");
    expect(await verifyPin("4821", hash)).toBe(true);
    expect(await verifyPin("4822", hash)).toBe(false);
  });

  it("저장된 해시가 없거나 형식이 틀리면 거부", async () => {
    expect(await verifyPin("1234", null)).toBe(false);
    expect(await verifyPin("12", await hashPin("12"))).toBe(false);
  });
});

describe("PIN 분실 곱셈 확인 문제", () => {
  it("두 자리 × 한 자리 범위, answer = a × b", () => {
    const lo = makeMultiplyChallenge(() => 0);
    expect(lo).toEqual({ a: 10, b: 2, answer: 20 });
    const hi = makeMultiplyChallenge(() => 0.999999);
    expect(hi).toEqual({ a: 99, b: 9, answer: 891 });
    for (let i = 0; i < 200; i++) {
      const c = makeMultiplyChallenge();
      expect(c.a).toBeGreaterThanOrEqual(10);
      expect(c.a).toBeLessThanOrEqual(99);
      expect(c.b).toBeGreaterThanOrEqual(2);
      expect(c.b).toBeLessThanOrEqual(9);
      expect(c.answer).toBe(c.a * c.b);
    }
  });

  it("매번 달라진다", () => {
    const seen = new Set(Array.from({ length: 30 }, () => {
      const c = makeMultiplyChallenge();
      return `${c.a}x${c.b}`;
    }));
    expect(seen.size).toBeGreaterThan(5);
  });

  it("정답 검증: 맞으면 통과, 틀리거나 숫자가 아니면 거부", () => {
    const c = { a: 37, b: 6, answer: 222 };
    expect(checkMultiplyAnswer(c, "222")).toBe(true);
    expect(checkMultiplyAnswer(c, " 222 ")).toBe(true);
    for (const bad of ["221", "", "abc", "22 2", "222.0", "-222"]) expect(checkMultiplyAnswer(c, bad)).toBe(false);
  });
});
