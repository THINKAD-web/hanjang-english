/** 같은 탭에서 이 시간 안의 재열람은 parent_view 를 한 번으로 센다. */
export const PARENT_VIEW_DEDUPE_MS = 10 * 60 * 1000;

export function shouldRecordParentView(lastAtMs: number | null, nowMs: number): boolean {
  if (lastAtMs === null || Number.isNaN(lastAtMs)) return true;
  // 시계가 거꾸로 간 경우(lastAt 이 미래)도 새 열람으로 센다.
  return nowMs - lastAtMs >= PARENT_VIEW_DEDUPE_MS || nowMs < lastAtMs;
}
