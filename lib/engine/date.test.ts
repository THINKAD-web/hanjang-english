import { describe, expect, it } from "vitest";
import { formatDateLabel, isDateKey, resolveDateKey, todayKey, weekdayIndex } from "./date";

describe("todayKey", () => {
  it("월요일 00:30 KST 는 월요일로 판정한다 (UTC 로는 일요일 15:30)", () => {
    const now = new Date("2026-09-27T15:30:00Z"); // = 2026-09-28 (월) 00:30 KST
    const key = todayKey(now);
    expect(key).toBe("2026-09-28");
    expect(weekdayIndex(key)).toBe(0);
  });

  it("일요일 23:59 KST 는 아직 일요일이다", () => {
    expect(todayKey(new Date("2026-09-27T14:59:00Z"))).toBe("2026-09-27");
  });
});

describe("isDateKey", () => {
  it.each(["2026-09-26", "2024-02-29"])("%s 는 유효", (v) => expect(isDateKey(v)).toBe(true));
  it.each(["2026-9-26", "2026-02-30", "2025-02-29", "abc", ""])("%s 는 무효", (v) =>
    expect(isDateKey(v)).toBe(false),
  );
});

describe("weekdayIndex / formatDateLabel", () => {
  it("월=0, 토=5, 일=6", () => {
    expect(weekdayIndex("2026-09-21")).toBe(0);
    expect(weekdayIndex("2026-09-26")).toBe(5);
    expect(weekdayIndex("2026-09-27")).toBe(6);
  });

  it("한국어 날짜 라벨", () => {
    expect(formatDateLabel("2026-09-26")).toBe("9월 26일 (토)");
  });
});

describe("resolveDateKey", () => {
  const now = new Date("2026-09-26T03:00:00Z");

  it("디버그가 아니면 ?date= 를 무시한다", () => {
    expect(resolveDateKey("2026-10-01", { debug: false, now })).toBe("2026-09-26");
  });

  it("디버그면 유효한 ?date= 를 쓴다", () => {
    expect(resolveDateKey("2026-10-01", { debug: true, now })).toBe("2026-10-01");
  });

  it("디버그여도 잘못된 값은 무시한다", () => {
    expect(resolveDateKey("2026-02-30", { debug: true, now })).toBe("2026-09-26");
    expect(resolveDateKey(null, { debug: true, now })).toBe("2026-09-26");
  });
});
