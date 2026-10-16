import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { content, packId } from "@/lib/engine/__fixtures__/state";
import { weekRange } from "@/lib/engine/date";
import { homeCta, packProgress, weekStamps } from "@/lib/engine/progress";
import { activeItems } from "@/lib/engine/queue";
import { completedLessonIds, decideToday } from "@/lib/engine/today";
import { BACKUP_PRE_V2, BACKUP_UNREADABLE, LocalProgressStore, STORAGE_KEY } from "./local";
import { migrateState } from "./migrate";
import { StateSchema } from "./types";

const FIXTURES = ["legacy-day1", "legacy-midweek", "legacy-complete"] as const;
const raw = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", `${name}.json`), "utf8");
const legacyOf = (name: string) => JSON.parse(raw(name));

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

describe.each(FIXTURES)("마이그레이션 %s", (name) => {
  const legacy = legacyOf(name);
  const result = migrateState(legacy)!;

  it("새 형식으로 올라가고 스키마를 통과한다", () => {
    expect(result.migrated).toBe(true);
    expect(StateSchema.safeParse(result.state).success).toBe(true);
    expect(result.state.activeProfileId).toBe("child");
    expect(result.state.activePackId).toBe(packId);
  });

  it("기록(attempts·오답 큐·이벤트·계정·프로필)은 새 필드(subjectId) 외에 한 글자도 바뀌지 않는다", () => {
    expect(result.state.attempts.map(({ subjectId, ...a }) => (subjectId === "en-kid" ? a : { ...a, subjectId }))).toEqual(legacy.attempts);
    expect(result.state.wrongQueue).toEqual(legacy.wrongQueue);
    expect(result.state.events).toEqual(legacy.events);
    expect(result.state.account).toEqual(legacy.account);
    expect(result.state.profiles).toEqual(legacy.profiles);
    expect(result.state.attempts.every((a) => a.subjectId === "en-kid")).toBe(true);
  });

  it("도장·진도·오답 수·오늘 판단이 이전 기록 그대로 계산된다", () => {
    const s = result.state;
    // 도장: 옛 기록의 완료 날짜 집합과 칸마다 일치
    const doneDates = new Set<string>(legacy.attempts.filter((a: { completed: boolean }) => a.completed).map((a: { dateKey: string }) => a.dateKey));
    for (const day of ["2026-09-21", "2026-09-24", "2026-09-27", "2026-09-30"]) {
      const cells = weekStamps(s, day);
      expect(cells.map((c) => c.stamped)).toEqual(weekRange(day).map((d) => doneDates.has(d)));
      expect(weekStamps(s, day, packId)).toEqual(cells);
    }
    // 진도: 완료한 장 id 가 옛 기록의 완료 순서와 같다
    const expectedLessons: string[] = [];
    for (const a of legacy.attempts) {
      if (a.completed && a.kind === "lesson" && !expectedLessons.includes(a.lessonId)) expectedLessons.push(a.lessonId);
    }
    expect(completedLessonIds(s, packId)).toEqual(expectedLessons);
    expect(packProgress(s, content).done).toBe(expectedLessons.length);
    // 오답: 활성 개수
    expect(activeItems(s.wrongQueue, packId, s.activeProfileId)).toHaveLength(
      legacy.wrongQueue.filter((w: { active: boolean }) => w.active).length,
    );
    // 오늘 판단이 던져지지 않고 CTA 가 만들어진다
    expect(() => homeCta(decideToday(s, "2026-10-05", content), content)).not.toThrow();
  });

  it("두 번 올려도 같다 (멱등)", () => {
    const again = migrateState(result.state)!;
    expect(again.migrated).toBe(false);
    expect(again.state).toEqual(result.state);
  });
});

describe("LocalProgressStore 마이그레이션", () => {
  it("옛 값을 읽으면 같은 키에 새 형식으로 저장하고 원본을 백업한다", async () => {
    const storage = memoryStorage();
    const original = raw("legacy-midweek");
    storage.raw.set(STORAGE_KEY, original);
    const state = await new LocalProgressStore(storage).load();
    expect(state.attempts).toHaveLength(legacyOf("legacy-midweek").attempts.length);
    expect(storage.raw.get(`${STORAGE_KEY}${BACKUP_PRE_V2}`)).toBe(original);
    expect(JSON.parse(storage.raw.get(STORAGE_KEY)!).stateVersion).toBe(2);
    // 다시 열어도 같은 상태, 백업은 그대로
    const again = await new LocalProgressStore(storage).load();
    expect(again).toEqual(state);
    expect(storage.raw.get(`${STORAGE_KEY}${BACKUP_PRE_V2}`)).toBe(original);
  });

  it("알아볼 수 없는 값은 지우지 않고 백업해 둔다", async () => {
    const storage = memoryStorage();
    storage.raw.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, attempts: ["x"] }));
    await new LocalProgressStore(storage).load();
    expect(storage.raw.get(`${STORAGE_KEY}${BACKUP_UNREADABLE}`)).toContain("99");
    storage.raw.set(STORAGE_KEY, "{not json");
    storage.raw.delete(`${STORAGE_KEY}${BACKUP_UNREADABLE}`);
    await new LocalProgressStore(storage).load();
    expect(storage.raw.get(`${STORAGE_KEY}${BACKUP_UNREADABLE}`)).toBe("{not json");
  });

  it("reset 은 백업까지 지운다", async () => {
    const storage = memoryStorage();
    storage.raw.set(STORAGE_KEY, raw("legacy-day1"));
    const store = new LocalProgressStore(storage);
    await store.load();
    await store.reset();
    expect([...storage.raw.keys()]).toEqual([]);
  });
});
