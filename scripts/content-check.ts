/**
 * npm run content:check
 * 콘텐츠 규칙을 검사하고 docs/content-review.md (검수표) 를 생성한다. 에러가 있으면 exit 1.
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkContent } from "@/lib/content/check";
import { CONTENT_REGISTRY, DEFAULT_PACK_ID, loadPacksSummary, parseContent } from "@/lib/content/load";
import { renderReviewMarkdown } from "@/lib/content/review";

const root = process.cwd();
const errors: string[] = [];

// packs.json 에 실린 "live" 팩은 모두 CONTENT_REGISTRY 에도 등록되어 있어야 한다 (그 반대도).
const summaries = loadPacksSummary();
const liveSummaries = summaries.filter((p) => p.status === "live");
for (const s of liveSummaries) {
  if (!(s.id in CONTENT_REGISTRY)) errors.push(`content/packs.json: ${s.id} 는 status live 인데 콘텐츠 레지스트리에 없다`);
}
for (const packId of Object.keys(CONTENT_REGISTRY)) {
  if (!summaries.some((s) => s.id === packId)) errors.push(`content/packs.json 에 ${packId} 가 없다`);
}

for (const [packId, raw] of Object.entries(CONTENT_REGISTRY)) {
  const summary = summaries.find((s) => s.id === packId);
  const at = `[${packId}]`;
  errors.push(...checkContent(raw).map((e) => `${at} ${e}`));

  // 레슨 JSON 을 추가하고 load.ts 에 import 하지 않은 경우를 잡는다.
  if (summary?.contentPath) {
    const lessonDir = join(root, "content", summary.contentPath, "lessons");
    const lessonFiles = readdirSync(lessonDir).filter((f) => f.endsWith(".json"));
    if (lessonFiles.length !== raw.lessons.length)
      errors.push(`${at} content/${summary.contentPath}/lessons 파일 ${lessonFiles.length}개 ≠ load.ts 에 등록된 레슨 ${raw.lessons.length}개`);
  }
}

if (errors.length) {
  console.error(`content:check 실패 (${errors.length}건)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// 검수표는 지금 실제로 서비스하는 기본 팩(en-kid-giyeok) 기준으로 생성한다.
const content = parseContent(CONTENT_REGISTRY[DEFAULT_PACK_ID]);
const outPath = join(root, "docs/content-review.md");
writeFileSync(outPath, renderReviewMarkdown(content));

const pending = content.lessons.filter((l) => !l.reviewed).map((l) => `L${l.dayNo}`);
console.log(`content:check 통과 — 팩 ${Object.keys(CONTENT_REGISTRY).length}개, 아이템 ${content.items.length}개, 레슨 ${content.lessons.length}장`);
console.log(`검수표: docs/content-review.md${pending.length ? ` (검수 대기: ${pending.join(", ")})` : ""}`);
