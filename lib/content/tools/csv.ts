import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { checkNormalized } from "../check";
import { normalizeContent, zodErrors } from "../normalize";
import { LESSON_TYPES, RawPackSchema, type Item, type LessonType } from "../schema";
import { newPlan, readJsonIfExists, toJsonFile, type Plan } from "./plan";

/**
 * content:csv — 한 줄에 아이템 하나인 CSV 를 레슨 파일로 쪼갠다.
 * 헤더: text,meaningKo,emoji,tags,imageable,reading   (text 만 필수. 나머지 열은 비워도 된다)
 *  - tags: `|` 또는 `;` 로 구분
 *  - imageable: true/false/1/0/yes/no. 비우면 emoji 가 있으면 true
 * 같은 CSV 를 다시 돌리면 같은 파일이 나온다 (아이템 id 는 text 에서 만든다).
 */

export const CSV_HEADER = ["text", "meaningKo", "emoji", "tags", "imageable", "reading"] as const;

/** RFC 4180 정도의 CSV: 따옴표 필드, "" 이스케이프, 필드 안 줄바꿈, BOM 제거. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

/** 아이템 id: 영문·숫자는 소문자 slug, 그 밖의 글자(가나·한자 등)는 코드포인트 16진수. 겹치면 -2, -3 … */
export function itemIdFor(text: string, taken: ReadonlySet<string>): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .split("")
      .map((ch) => (/[a-z0-9]/.test(ch) ? ch : /\s|[-_.'’]/.test(ch) ? "-" : `u${ch.codePointAt(0)!.toString(16)}`))
      .join("")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "item";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

const TRUE = new Set(["true", "1", "yes", "y", "o"]);
const FALSE = new Set(["false", "0", "no", "n", "x"]);

export type CsvOptions = {
  packId: string;
  size: number;
  lessonType: LessonType;
  kind: Item["kind"];
  testOnly: boolean;
  /** 이미 검수 완료(reviewed: true)된 레슨 파일을 바꿔도 되는가 */
  forceReviewed: boolean;
};

export function parseItems(csv: string, o: Pick<CsvOptions, "kind">, plan: Plan): Item[] {
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    plan.errors.push("CSV 가 비어 있다");
    return [];
  }
  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  if (col("text") < 0) plan.errors.push(`CSV 헤더에 text 열이 필요하다 (현재: ${header.join(",")}). 권장 헤더: ${CSV_HEADER.join(",")}`);
  const unknown = header.filter((h) => !(CSV_HEADER as readonly string[]).includes(h));
  if (unknown.length) plan.warnings.push(`알 수 없는 열을 무시한다: ${unknown.join(", ")}`);
  if (plan.errors.length) return [];

  const cell = (r: string[], name: string) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "");
  const items: Item[] = [];
  const taken = new Set<string>();
  const seenText = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const text = cell(r, "text");
    if (!text) return void plan.errors.push(`${line}행: text 가 비어 있다`);
    if (seenText.has(text)) return void plan.errors.push(`${line}행: "${text}" 가 CSV 안에서 중복이다`);
    seenText.add(text);

    const emoji = cell(r, "emoji");
    const flag = cell(r, "imageable").toLowerCase();
    if (flag && !TRUE.has(flag) && !FALSE.has(flag)) plan.errors.push(`${line}행: imageable "${flag}" 는 true/false 로 적는다`);
    const imageable = flag ? TRUE.has(flag) : Boolean(emoji);
    const id = itemIdFor(text, taken);
    taken.add(id);
    const meaningKo = cell(r, "meaningKo");
    const reading = cell(r, "reading");
    const tags = cell(r, "tags")
      .split(/[|;]/)
      .map((t) => t.trim())
      .filter(Boolean);
    items.push({
      id,
      kind: o.kind,
      text,
      ...(meaningKo ? { meaningKo } : {}),
      ...(reading ? { reading } : {}),
      ...(emoji ? { emoji } : {}),
      imageable,
      tags,
    });
  });
  return items;
}

export function planCsv(root: string, csv: string, o: CsvOptions): Plan {
  const plan = newPlan();
  if (!Number.isInteger(o.size) || o.size < 1) plan.errors.push(`--size 는 1 이상의 정수 (현재 ${o.size})`);
  if (!LESSON_TYPES.includes(o.lessonType)) plan.errors.push(`--type ${o.lessonType} 는 ${LESSON_TYPES.join(", ")} 중 하나`);

  const packDir = path.join(root, "packs", o.packId);
  const packJson = readJsonIfExists(path.join(packDir, "pack.json"));
  if (packJson === undefined) plan.errors.push(`content/packs/${o.packId}/pack.json 이 없다 — 먼저 npm run content:new ${o.packId} 로 팩을 만든다`);
  const pack = packJson === undefined ? null : RawPackSchema.safeParse(packJson);
  if (pack && !pack.success) plan.errors.push(...zodErrors("pack.json", pack.error));
  if (plan.errors.length) return plan;

  const items = parseItems(csv, o, plan);
  if (plan.errors.length) return plan;
  if (items.length === 0) {
    plan.errors.push("아이템이 하나도 없다");
    return plan;
  }

  const rules = pack!.success ? pack!.data.rules : null;
  if (rules && rules.itemsPerLesson !== o.size)
    plan.warnings.push(`--size ${o.size} 가 pack.rules.itemsPerLesson(${rules.itemsPerLesson}) 와 다르다 — content:check 에서 걸린다`);

  const chunks: Item[][] = [];
  for (let i = 0; i < items.length; i += o.size) chunks.push(items.slice(i, i + o.size));
  const last = chunks[chunks.length - 1];
  if (last.length < o.size)
    plan.warnings.push(`마지막 레슨(${chunks.length}번)이 아이템 ${last.length}개뿐이다 (규칙 ${o.size}개). 이대로는 content:check 가 규칙 위반으로 막는다 — CSV 에 ${o.size - last.length}개를 더하거나 빼 주세요`);

  const unitLabel = pack!.success ? (pack!.data.unitLabel ?? pack!.data.title) : o.packId;
  const lessonsDir = path.join(packDir, "lessons");
  chunks.forEach((chunk, i) => {
    const order = i + 1;
    const rel = `packs/${o.packId}/lessons/${String(order).padStart(2, "0")}.json`;
    const lesson = {
      order,
      title: `${unitLabel} ${order}`,
      type: o.lessonType,
      items: chunk,
      reviewed: false,
      testOnly: o.testOnly,
    };
    const existing = readJsonIfExists(path.join(root, rel)) as { reviewed?: boolean } | undefined;
    const next = toJsonFile(lesson);
    if (existing?.reviewed && JSON.stringify(existing) !== JSON.stringify(lesson) && !o.forceReviewed)
      plan.errors.push(`${rel}: 이미 검수 완료(reviewed: true)된 레슨이라 바꾸지 않는다 — 정말 바꾸려면 --force-reviewed`);
    plan.files.set(rel, next);
  });

  // 이번 CSV 보다 긴, 예전에 만든 레슨 파일은 지우지 않고 알려만 준다
  if (existsSync(lessonsDir)) {
    const stale = readdirSync(lessonsDir).filter((f) => /^\d+\.json$/.test(f) && Number(f.slice(0, -5)) > chunks.length);
    if (stale.length) plan.warnings.push(`CSV 보다 긴 기존 레슨 파일이 남아 있다: ${stale.join(", ")} (지우지 않았다)`);
  }

  // 미리 정규화·검사해서 문제를 쓰기 전에 보여 준다 (쓰기는 에러 없을 때만)
  const rawPack = packJson as { lessonCount?: number };
  if (rawPack.lessonCount !== undefined && rawPack.lessonCount !== chunks.length) {
    plan.files.set(`packs/${o.packId}/pack.json`, toJsonFile({ ...rawPack, lessonCount: chunks.length }));
    plan.warnings.push(`pack.json 의 lessonCount ${rawPack.lessonCount} → ${chunks.length} 로 고친다`);
  }
  const norm = normalizeContent({ pack: { ...rawPack, lessonCount: chunks.length }, lessons: [...plan.files].filter(([f]) => f.includes("/lessons/")).map(([, c]) => JSON.parse(c)) });
  if (!norm.content) plan.errors.push(...norm.errors);
  else {
    const ruleErrors = checkNormalized(norm.content);
    // 마지막 레슨 개수 부족은 위 경고로 이미 알렸다. 그 밖의 규칙 위반도 경고로 보여 주되 쓰기는 막지 않는다 (수정 후 다시 돌리면 된다).
    for (const e of ruleErrors) plan.warnings.push(`규칙: ${e}`);
  }

  if (plan.errors.length) plan.files.clear();
  return plan;
}
