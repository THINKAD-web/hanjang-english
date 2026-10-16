import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 콘텐츠 도구들이 공유하는 "쓸 파일 계획". 도구는 먼저 계획(어떤 파일에 어떤 내용)을 만들고, 에러가 없을 때만 적용한다.
 * 적용은 멱등이다 — 이미 같은 내용이면 건드리지 않는다. --dry-run 이면 아무것도 쓰지 않고 무엇이 바뀔지만 알려 준다.
 */

export type Plan = {
  /** 콘텐츠 루트 기준 상대 경로 → 파일 내용 */
  files: Map<string, string>;
  warnings: string[];
  errors: string[];
};

export const newPlan = (): Plan => ({ files: new Map(), warnings: [], errors: [] });

/** 사람이 편집하는 JSON 파일 형식: 2칸 들여쓰기 + 끝 줄바꿈. */
export const toJsonFile = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";

export type ApplyResult = { written: string[]; unchanged: string[] };

export function applyPlan(plan: Plan, root: string, opts: { dryRun?: boolean } = {}): ApplyResult {
  const written: string[] = [];
  const unchanged: string[] = [];
  for (const [rel, content] of [...plan.files].sort(([a], [b]) => a.localeCompare(b))) {
    const file = path.join(root, rel);
    if (existsSync(file) && readFileSync(file, "utf8") === content) {
      unchanged.push(rel);
      continue;
    }
    written.push(rel);
    if (opts.dryRun) continue;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return { written, unchanged };
}

/** 이미 있는 JSON 파일을 읽는다. 없으면 undefined. */
export function readJsonIfExists(file: string): unknown {
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8"));
}

export const PACK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export type Args = { positional: string[]; flags: Map<string, string | true> };

/** `--size 8 --dry-run file.csv` → positional [file.csv], flags {size:"8", dry-run:true}. */
export function parseArgs(argv: readonly string[], valueFlags: readonly string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const name = a.slice(2);
    if (valueFlags.includes(name)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`--${name} 에 값이 필요하다`);
      flags.set(name, v);
    } else {
      flags.set(name, true);
    }
  }
  return { positional, flags };
}
