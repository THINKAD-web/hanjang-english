import { DEFAULT_PACK_ID } from "@/lib/content/defaults";
import { migrateState } from "./migrate";
import { createInitialState, type ProgressStore, type State } from "./types";

export const STORAGE_KEY = "hanjang-state-v2";
/** 마이그레이션 직전 원본 / 읽을 수 없어서 건너뛴 원본. 사용자가 직접 복구할 수 있게 남긴다. */
export const BACKUP_PRE_V2 = "-pre-v2-backup";
export const BACKUP_UNREADABLE = "-unreadable-backup";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * localStorage 구현. 사파리 사생활 보호 모드 등에서 storage 접근이 throw 할 수 있으므로
 * 모든 접근을 try/catch 하고, 실패하면 메모리에만 유지한다 (새로고침하면 사라짐).
 * 옛 형식은 읽는 즉시 새 형식으로 올려 다시 저장하되, 올리기 전 원본을 백업 키에 한 번 보관한다.
 * 알아볼 수 없는 값은 지우지 않고 백업 키에 보관한 채 초기 상태로 시작한다 (기록을 잃지 않는다).
 */
export class LocalProgressStore implements ProgressStore {
  private memory: State | null = null;

  constructor(
    private readonly storage: StorageLike | null = typeof window === "undefined" ? null : safeLocalStorage(),
    private readonly key: string = STORAGE_KEY,
    private readonly defaultPackId: string = DEFAULT_PACK_ID,
  ) {}

  async load(): Promise<State> {
    const raw = this.read();
    if (raw != null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // 깨진 JSON — 아래에서 백업하고 초기 상태
      }
      const result = parsed === undefined ? null : migrateState(parsed);
      if (result) {
        if (result.migrated) {
          this.backup(BACKUP_PRE_V2, raw);
          await this.save(result.state);
        }
        return (this.memory = result.state);
      }
      this.backup(BACKUP_UNREADABLE, raw);
    }
    return (this.memory ??= createInitialState(this.defaultPackId));
  }

  async save(state: State): Promise<void> {
    this.memory = state;
    try {
      this.storage?.setItem(this.key, JSON.stringify(state));
    } catch {
      // 용량 초과·접근 차단 — 메모리 상태로 계속 진행 (새로고침 시 유실될 수 있음)
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
      this.storage?.removeItem(`${this.key}${BACKUP_PRE_V2}`);
      this.storage?.removeItem(`${this.key}${BACKUP_UNREADABLE}`);
    } catch {
      // 무시
    }
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.load(), null, 2);
  }

  /** 이미 백업이 있으면 덮어쓰지 않는다 (가장 처음 원본이 가장 값지다). */
  private backup(suffix: string, raw: string): void {
    try {
      const key = `${this.key}${suffix}`;
      if (this.storage?.getItem(key) == null) this.storage?.setItem(key, raw);
    } catch {
      // 무시
    }
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
