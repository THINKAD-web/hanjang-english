import { createInitialState, StateSchema, type ProgressStore, type State } from "./types";

export const STORAGE_KEY = "hanjang-state-v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * localStorage 구현. 사파리 사생활 보호 모드 등에서 storage 접근이 throw 할 수 있으므로
 * 모든 접근을 try/catch 하고, 실패하면 메모리에만 유지한다 (새로고침하면 사라짐).
 * 저장된 값이 스키마와 맞지 않으면 초기 상태로 시작한다.
 */
export class LocalProgressStore implements ProgressStore {
  private memory: State | null = null;

  constructor(
    private readonly storage: StorageLike | null = typeof window === "undefined" ? null : safeLocalStorage(),
    private readonly key: string = STORAGE_KEY,
  ) {}

  async load(): Promise<State> {
    const raw = this.read();
    if (raw != null) {
      try {
        const parsed = StateSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return (this.memory = parsed.data);
      } catch {
        // 깨진 JSON — 아래에서 초기 상태
      }
    }
    return (this.memory ??= createInitialState());
  }

  async save(state: State): Promise<void> {
    this.memory = state;
    try {
      this.storage?.setItem(this.key, JSON.stringify(state));
    } catch {
      // 용량 초과·접근 차단 — 메모리 상태로 계속 진행
    }
  }

  async update(fn: (state: State) => State): Promise<State> {
    const next = fn(await this.load());
    await this.save(next);
    return next;
  }

  async reset(): Promise<void> {
    this.memory = null;
    try {
      this.storage?.removeItem(this.key);
    } catch {
      // 무시
    }
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.load(), null, 2);
  }

  private read(): string | null {
    try {
      return this.storage?.getItem(this.key) ?? null;
    } catch {
      return null;
    }
  }
}

function safeLocalStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
