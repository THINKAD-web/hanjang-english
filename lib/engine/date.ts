/**
 * 날짜 판단은 전부 Asia/Seoul 기준 "YYYY-MM-DD" 키로 한다.
 * 기기 타임존이나 UTC 에 기대지 않도록 Date 를 직접 비교하지 말고 이 모듈의 키만 쓴다.
 */

export type DateKey = string;

const TIME_ZONE = "Asia/Seoul";
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const seoulFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 주어진 시각의 서울 날짜 키. */
export function todayKey(now: Date = new Date()): DateKey {
  // en-CA 로케일은 YYYY-MM-DD 로 포맷한다.
  return seoulFormatter.format(now);
}

/** 형식과 달력상 유효성(2월 30일 등)을 모두 검사한다. */
export function isDateKey(value: string): value is DateKey {
  const m = DATE_KEY_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = new Date(Date.UTC(y, mo - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === mo - 1 && utc.getUTCDate() === d;
}

function toUtcDate(key: DateKey): Date {
  if (!isDateKey(key)) throw new Error(`Invalid date key: ${key}`);
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 월=0 … 일=6. */
export function weekdayIndex(key: DateKey): number {
  return (toUtcDate(key).getUTCDay() + 6) % 7;
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** "9월 26일 (토)" */
export function formatDateLabel(key: DateKey): string {
  const [, m, d] = key.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAY_LABELS[weekdayIndex(key)]})`;
}

/**
 * 오늘 날짜 키를 정한다. 디버그 모드에서만 `?date=` 로 덮어쓸 수 있다.
 * 잘못된 값이면 무시하고 실제 오늘을 쓴다.
 */
export function resolveDateKey(
  dateParam: string | null | undefined,
  { debug, now = new Date() }: { debug: boolean; now?: Date },
): DateKey {
  if (debug && dateParam && isDateKey(dateParam)) return dateParam;
  return todayKey(now);
}
