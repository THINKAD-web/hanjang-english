import { existsSync } from "node:fs";
import path from "node:path";
import { checkNormalized } from "../check";
import { normalizeContent, type RawContent } from "../normalize";
import { listPackIds, readSubjects } from "../node";
import { newPlan, PACK_ID_RE, readJsonIfExists, toJsonFile, type Plan } from "./plan";

/**
 * content:import — `{ pack, items?, lessons[] }` 한 덩어리 JSON(외부에서 받은 번들)을 content/packs/{id}/ 로 풀어 놓는다.
 * 먼저 정규화와 규칙 검사를 통과해야 하고, 통과 못 하면 아무것도 쓰지 않는다.
 *
 * 덮어쓰기 보호
 * - 이미 있는 packId 는 --force 없이는 거부한다.
 * - --force 여도 reviewed: true 인 기존 레슨을 바꾸는 번들은 --force-reviewed 가 있어야 한다.
 * - 같은 번들을 다시 가져오면 바뀌는 파일이 없다 (멱등).
 */

export type ImportOptions = { force: boolean; forceReviewed: boolean };

export function planImport(root: string, bundle: unknown, o: ImportOptions): Plan {
  const plan = newPlan();
  if (typeof bundle !== "object" || bundle === null || !("pack" in bundle) || !("lessons" in bundle) || !Array.isArray((bundle as RawContent).lessons)) {
    plan.errors.push("번들 JSON 은 { pack, items?, lessons: [...] } 모양이어야 한다");
    return plan;
  }
  const raw = bundle as RawContent;
  const packId = (raw.pack as { id?: unknown }).id;
  if (typeof packId !== "string" || !PACK_ID_RE.test(packId)) {
    plan.errors.push(`pack.id 는 소문자·숫자·하이픈 문자열이어야 한다 (현재 ${JSON.stringify(packId)})`);
    return plan;
  }

  const norm = normalizeContent(raw);
  if (!norm.content) {
    plan.errors.push(...norm.errors);
    return plan;
  }
  const content = norm.content;
  plan.errors.push(...checkNormalized(content));
  if (!readSubjects(root).some((s) => s.id === content.pack.subjectId))
    plan.errors.push(`pack.subjectId ${content.pack.subjectId} 가 content/subjects.json 에 없다`);
  if (content.pack.unlock && !listPackIds(root).includes(content.pack.unlock.afterPackId) && content.pack.unlock.afterPackId !== packId)
    plan.errors.push(`pack.unlock.afterPackId ${content.pack.unlock.afterPackId} 팩이 없다`);

  const packDir = path.join(root, "packs", packId);
  const exists = existsSync(path.join(packDir, "pack.json"));
  if (exists && !o.force) {
    plan.errors.push(`content/packs/${packId} 가 이미 있다 — 덮어쓰려면 --force (검수 완료된 레슨은 --force-reviewed 도 필요)`);
    return plan;
  }

  // 원본 번들 모양 그대로 쓴다 (정규화된 값이 아니라 저작용 raw). lessonCount 는 번들이 적은 대로.
  plan.files.set(`packs/${packId}/pack.json`, toJsonFile(raw.pack));
  if (raw.items !== undefined) plan.files.set(`packs/${packId}/items.json`, toJsonFile(raw.items));
  const written = new Set<string>();
  (raw.lessons as { order?: number; reviewed?: boolean }[]).forEach((lesson) => {
    const order = lesson.order as number;
    const rel = `packs/${packId}/lessons/${String(order).padStart(2, "0")}.json`;
    written.add(path.basename(rel));
    const existing = readJsonIfExists(path.join(root, rel)) as { reviewed?: boolean } | undefined;
    if (existing?.reviewed && JSON.stringify(existing) !== JSON.stringify(lesson) && !o.forceReviewed)
      plan.errors.push(`${rel}: 검수 완료(reviewed: true)된 레슨이라 바꾸지 않는다 — 정말 바꾸려면 --force-reviewed`);
    plan.files.set(rel, toJsonFile(lesson));
  });
  // 에러가 하나라도 있으면 아무것도 쓰지 않는다
  if (plan.errors.length) plan.files.clear();
  return plan;
}
