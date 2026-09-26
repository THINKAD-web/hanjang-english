import { describe, expect, it } from "vitest";
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

describe("LocalProgressStore", () => {
  it("비어 있으면 초기 상태", async () => {
    expect(await new LocalProgressStore(memoryStorage()).load()).toEqual(createInitialState());
  });

  it("저장 후 새 인스턴스에서 불러온다 (새로고침)", async () => {
    const storage = memoryStorage();
    await new LocalProgressStore(storage).update((s) => ({ ...s, childGrade: 4 }));
    expect((await new LocalProgressStore(storage).load()).childGrade).toBe(4);
  });

  it("깨진 값이면 초기 상태", async () => {
    const storage = memoryStorage();
    storage.raw.set(STORAGE_KEY, "{not json");
    expect(await new LocalProgressStore(storage).load()).toEqual(createInitialState());
    storage.raw.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }));
    expect(await new LocalProgressStore(storage).load()).toEqual(createInitialState());
  });

  it("storage 가 막혀 있어도 메모리로 동작", async () => {
    const store = new LocalProgressStore(throwing);
    await store.update((s) => ({ ...s, childGrade: 4 }));
    expect((await store.load()).childGrade).toBe(4);
  });

  it("reset 후 초기 상태, exportJson 은 State JSON", async () => {
    const store = new LocalProgressStore(memoryStorage());
    await store.update((s) => ({ ...s, childGrade: 4 }));
    expect(JSON.parse(await store.exportJson()).childGrade).toBe(4);
    await store.reset();
    expect((await store.load()).childGrade).toBe(3);
  });
});
