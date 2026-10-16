/**
 * 디스크(content/)에서 읽는 Node 전용 로더. 테스트·스크립트·빌드가 쓴다.
 * ⚠️ 브라우저 번들(components/ app/)에서는 import 하지 않는다 — 앱은 ContentRepository(fetch)만 쓴다.
 */
import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundleOf, manifestOf, type Manifest, type PackBundle } from "./bundle";
import { checkNormalized } from "./check";
import { normalizeContent, zodErrors, type RawContent } from "./normalize";
import { SubjectsFileSchema, type Content, type Subject } from "./schema";

export const contentRoot = (): string => path.join(process.cwd(), "content");
export const publicContentDir = (): string => path.join(process.cwd(), "public", "content");

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${path.relative(process.cwd(), file)}: JSON 을 읽을 수 없다 (${e instanceof Error ? e.message : String(e)})`);
  }
}

/** content/packs/ 아래에서 pack.json 이 있는 폴더 이름 = 자동 등록되는 팩. 정렬해서 항상 같은 순서. */
export function listPackIds(root: string = contentRoot()): string[] {
  const dir = path.join(root, "packs");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, "pack.json")))
    .map((d) => d.name)
    .sort();
}

export function readSubjects(root: string = contentRoot()): Subject[] {
  const parsed = SubjectsFileSchema.safeParse(readJson(path.join(root, "subjects.json")));
  if (!parsed.success) throw new Error(zodErrors("content/subjects.json", parsed.error).join("\n"));
  return parsed.data;
}

/** 팩 폴더의 pack.json · items.json(선택) · lessons/*.json(파일 이름순)을 그대로 읽는다. */
export function readRawPack(packId: string, root: string = contentRoot()): RawContent {
  const dir = path.join(root, "packs", packId);
  const itemsFile = path.join(dir, "items.json");
  const lessonsDir = path.join(dir, "lessons");
  const lessonFiles = existsSync(lessonsDir) ? readdirSync(lessonsDir).filter((f) => f.endsWith(".json")).sort() : [];
  return {
    pack: readJson(path.join(dir, "pack.json")),
    ...(existsSync(itemsFile) ? { items: readJson(itemsFile) } : {}),
    lessons: lessonFiles.map((f) => readJson(path.join(lessonsDir, f))),
  };
}

export type BuildResult = {
  manifest: Manifest;
  contents: Content[];
  bundles: Map<string, PackBundle>;
  errors: string[];
};

/** 모든 팩을 정규화·검증한다. 에러가 있어도 가능한 만큼 모아서 돌려준다 (호출한 쪽이 판단). */
export function buildAll(root: string = contentRoot()): BuildResult {
  const errors: string[] = [];
  let subjects: Subject[] = [];
  try {
    subjects = readSubjects(root);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  const subjectIds = new Set<string>();
  for (const s of subjects) {
    if (subjectIds.has(s.id)) errors.push(`content/subjects.json: 과목 id 중복 ${s.id}`);
    subjectIds.add(s.id);
  }

  const contents: Content[] = [];
  const packIds = new Set(listPackIds(root));
  for (const folder of listPackIds(root)) {
    const at = `[${folder}]`;
    let raw: RawContent;
    try {
      raw = readRawPack(folder, root);
    } catch (e) {
      errors.push(`${at} ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const { content, errors: nErrors } = normalizeContent(raw);
    if (!content) {
      errors.push(...nErrors.map((e) => `${at} ${e}`));
      continue;
    }
    const pack = content.pack;
    const packErrors = checkNormalized(content);
    if (pack.id !== folder) packErrors.push(`pack.json: id ${pack.id} 가 폴더 이름 ${folder} 와 다르다`);
    if (!subjectIds.has(pack.subjectId)) packErrors.push(`pack.json: subjectId ${pack.subjectId} 가 content/subjects.json 에 없다`);
    if (pack.status === "live" && content.lessons.length === 0) packErrors.push("pack.json: status live 인데 레슨이 하나도 없다");
    if (pack.unlock && !packIds.has(pack.unlock.afterPackId)) packErrors.push(`pack.json: unlock.afterPackId ${pack.unlock.afterPackId} 팩이 없다`);
    if (pack.unlock && pack.unlock.afterPackId === pack.id) packErrors.push("pack.json: unlock.afterPackId 가 자기 자신이다");
    errors.push(...packErrors.map((e) => `${at} ${e}`));
    contents.push(content);
  }

  return {
    manifest: manifestOf(subjects, contents),
    contents,
    bundles: new Map(contents.map((c) => [c.pack.id, bundleOf(c)])),
    errors,
  };
}

/** public/content 를 비우고 새로 쓴다. 같은 입력이면 항상 같은 바이트. */
export function writeBuild(result: BuildResult, outDir: string = publicContentDir()): { files: number } {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(path.join(outDir, "packs"), { recursive: true });
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(result.manifest) + "\n");
  let files = 1;
  for (const [packId, bundle] of result.bundles) {
    writeFileSync(path.join(outDir, "packs", `${packId}.json`), JSON.stringify(bundle) + "\n");
    files++;
  }
  return { files };
}

// ───────── 테스트·스크립트용 동기 로더 (화면은 쓰지 않는다) ─────────

const cache = new Map<string, Content>();

/** 팩 하나를 디스크에서 읽어 정규화한다. 형태가 틀리면 throw. */
export function loadContent(packId: string, root: string = contentRoot()): Content {
  const key = `${root}::${packId}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { content, errors } = normalizeContent(readRawPack(packId, root));
  if (!content) throw new Error(`콘텐츠 정규화 실패 [${packId}]:\n${errors.join("\n")}`);
  cache.set(key, content);
  return content;
}

/** 이미 읽은 raw 를 정규화한다 (테스트에서 일부러 망가뜨린 raw 용). */
export function parseContent(raw: RawContent): Content {
  const { content, errors } = normalizeContent(raw);
  if (!content) throw new Error(`콘텐츠 정규화 실패:\n${errors.join("\n")}`);
  return content;
}
