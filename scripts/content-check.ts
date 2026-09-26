/**
 * npm run content:check
 * 콘텐츠 규칙을 검사하고 docs/content-review.md (검수표) 를 생성한다. 에러가 있으면 exit 1.
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkContent } from "@/lib/content/check";
import { parseContent, rawGiyeok } from "@/lib/content/load";
import { renderReviewMarkdown } from "@/lib/content/review";

const root = process.cwd();
const errors = checkContent(rawGiyeok);

// 레슨 JSON 을 추가하고 load.ts 에 import 하지 않은 경우를 잡는다.
const lessonFiles = readdirSync(join(root, "content/giyeok/lessons")).filter((f) => f.endsWith(".json"));
if (lessonFiles.length !== rawGiyeok.lessons.length)
  errors.push(`content/giyeok/lessons 파일 ${lessonFiles.length}개 ≠ load.ts 에 등록된 레슨 ${rawGiyeok.lessons.length}개`);

if (errors.length) {
  console.error(`content:check 실패 (${errors.length}건)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const content = parseContent(rawGiyeok);
const outPath = join(root, "docs/content-review.md");
writeFileSync(outPath, renderReviewMarkdown(content));

const pending = content.lessons.filter((l) => !l.reviewed).map((l) => `L${l.dayNo}`);
console.log(`content:check 통과 — 단어 ${content.words.length}개, 레슨 ${content.lessons.length}장`);
console.log(`검수표: docs/content-review.md${pending.length ? ` (검수 대기: ${pending.join(", ")})` : ""}`);
