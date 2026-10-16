import { readFileSync } from "node:fs";
import path from "node:path";
import { planCsv } from "./csv";
import { planImport } from "./import-bundle";
import { newPlan, readJsonIfExists, toJsonFile, type Plan } from "./plan";
import { planNewPack } from "./scaffold";
import type { Item, LessonType, TtsLang } from "../schema";

/**
 * content:seed — content/seed/seeds.json 에 적힌 시드 팩을 content/packs/ 에 만든다.
 * 시드는 "데이터만 넣으면 팩이 생긴다" 는 것을 보이는 예시이자 화면 검증용 테스트 콘텐츠다.
 * 모든 레슨은 testOnly: true · reviewed: false 라서 공개(Production)에는 나가지 않는다.
 *
 *  - { type: "bundle", file }  → content:import 와 같은 경로 (덮어쓰기 허용, 검수 완료 레슨은 보호)
 *  - { type: "csv", file, packId, pack, size, lessonType, kind } → content:new + content:csv 와 같은 경로
 */

export type SeedEntry =
  | { type: "bundle"; file: string }
  | {
      type: "csv";
      file: string;
      packId: string;
      /** pack.json 에 덮어쓸 필드 (rules 는 기본 rules 위에 합친다) */
      pack: Record<string, unknown> & { rules?: Record<string, unknown> };
      size: number;
      lessonType: LessonType;
      kind: Item["kind"];
    };

export function planSeed(root: string): Plan {
  const plan = newPlan();
  const seedDir = path.join(root, "seed");
  const entries = readJsonIfExists(path.join(seedDir, "seeds.json")) as SeedEntry[] | undefined;
  if (!entries) {
    plan.errors.push("content/seed/seeds.json 이 없다");
    return plan;
  }

  for (const entry of entries) {
    const label = entry.type === "bundle" ? entry.file : entry.packId;
    const sub = entry.type === "bundle" ? planBundle(root, seedDir, entry) : planCsvEntry(root, seedDir, entry);
    for (const [f, c] of sub.files) plan.files.set(f, c);
    plan.warnings.push(...sub.warnings.map((w) => `[${label}] ${w}`));
    plan.errors.push(...sub.errors.map((e) => `[${label}] ${e}`));
  }
  if (plan.errors.length) plan.files.clear();
  return plan;
}

function planBundle(root: string, seedDir: string, e: Extract<SeedEntry, { type: "bundle" }>): Plan {
  const bundle = JSON.parse(readFileSync(path.join(seedDir, e.file), "utf8"));
  return planImport(root, bundle, { force: true, forceReviewed: false });
}

function planCsvEntry(root: string, seedDir: string, e: Extract<SeedEntry, { type: "csv" }>): Plan {
  const plan = newPlan();
  // 팩이 이미 있으면 그 pack.json 을 그대로 쓴다 (사람이 고친 값을 시드가 덮어쓰지 않는다)
  const existing = readJsonIfExists(path.join(root, "packs", e.packId, "pack.json"));
  let packJson = existing;
  if (existing === undefined) {
    const scaffold = planNewPack(root, {
      packId: e.packId,
      subjectId: String(e.pack.subjectId),
      title: String(e.pack.title),
      ttsLang: e.pack.ttsLang as TtsLang | undefined,
    });
    plan.errors.push(...scaffold.errors);
    plan.warnings.push(...scaffold.warnings);
    if (scaffold.errors.length) return plan;
    const base = JSON.parse(scaffold.files.get(`packs/${e.packId}/pack.json`)!) as { rules: Record<string, unknown> };
    packJson = { ...base, ...e.pack, rules: { ...base.rules, ...e.pack.rules } };
    plan.files.set(`packs/${e.packId}/pack.json`, toJsonFile(packJson));
    plan.files.set(`packs/${e.packId}/items.json`, toJsonFile([]));
  }
  const csv = planCsv(root, readFileSync(path.join(seedDir, e.file), "utf8"), {
    packId: e.packId,
    size: e.size,
    lessonType: e.lessonType,
    kind: e.kind,
    testOnly: true,
    forceReviewed: false,
    packJson,
  });
  for (const [f, c] of csv.files) plan.files.set(f, c);
  plan.warnings.push(...csv.warnings);
  plan.errors.push(...csv.errors);
  return plan;
}
