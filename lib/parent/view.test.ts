import { describe, expect, it } from "vitest";
import { PARENT_VIEW_DEDUPE_MS, shouldRecordParentView } from "./view";

describe("parent_view 중복 계산", () => {
  const T = 1_000_000_000_000;

  it("처음 열면 기록한다", () => {
    expect(shouldRecordParentView(null, T)).toBe(true);
  });

  it("10분 안 재열람은 기록하지 않는다 (새로고침 포함)", () => {
    expect(shouldRecordParentView(T, T + 1)).toBe(false);
    expect(shouldRecordParentView(T, T + PARENT_VIEW_DEDUPE_MS - 1)).toBe(false);
  });

  it("10분이 지나면 다시 기록한다", () => {
    expect(shouldRecordParentView(T, T + PARENT_VIEW_DEDUPE_MS)).toBe(true);
  });

  it("저장된 시각이 깨졌거나 미래면 기록한다", () => {
    expect(shouldRecordParentView(Number.NaN, T)).toBe(true);
    expect(shouldRecordParentView(T + 5_000, T)).toBe(true);
  });
});
