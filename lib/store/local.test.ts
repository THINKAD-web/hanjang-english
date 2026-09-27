import { describe, expect, it } from "vitest";
import { DEFAULT_PACK_ID } from "@/lib/content/load";
import { LocalProgressStore, STORAGE_KEY } from "./local";
import { createInitialState } from "./types";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

const setGrade = (s: ReturnType<typeof createInitialState>, grade: 3 | 4) => ({
  ...s,
  profiles: s.profiles.map((p) => ({ ...p, grade })),
});
const gradeOf = (s: ReturnType<typeof createInitialState>) => s.profiles[0].grade;

describe("LocalProgressStore", () => {
  it("비어 있으면 초기 상태", async () => {
    expect(await new LocalProgressStore(memoryStorage()).load()).toEqual(createInitialState(DEFAULT_PACK_ID));
  });

  it("저장 후 새 인스턴스에서 불러온다 (새로고침)", async () => {
    const storage = memoryStorage();
    await new LocalProgressStore(storage).update((s) => setGrade(s, 4));
    expect(gradeOf(await new LocalProgressStore(storage).load())).toBe(4);
  });

  it("깨진 값이면 초기 상태", async () => {
    const storage = memoryStorage();
    storage.raw.set(STORAGE_KEY, "{not json");
    expect(await new LocalProgressStore(storage).load()).toEqual(createInitialState(DEFAULT_PACK_ID));
    storage.raw.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }));
    expect(await new LocalProgressStore(storage).load()).toEqual(createInitialState(DEFAULT_PACK_ID));
  });

  it("storage 가 막혀 있어도 메모리로 동작", async () => {
    const store = new LocalProgressStore(throwing);
    await store.update((s) => setGrade(s, 4));
    expect(gradeOf(await store.load())).toBe(4);
  });

  it("reset 후 초기 상태, exportJson 은 State JSON", async () => {
    const store = new LocalProgressStore(memoryStorage());
    await store.update((s) => setGrade(s, 4));
    expect(JSON.parse(await store.exportJson()).profiles[0].grade).toBe(4);
    await store.reset();
    expect(gradeOf(await store.load())).toBe(3);
  });
});
