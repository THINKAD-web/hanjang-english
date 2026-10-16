/**
 * npm run content:check
 * 모든 팩의 콘텐츠 규칙을 검사하고 docs/content-review.md (기본 팩 검수표) 를 생성한다. 에러가 있으면 exit 1.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PACK_ID } from "@/lib/content/defaults";
import { buildAll } from "@/lib/content/node";
import { renderReviewMarkdown } from "@/lib/content/review";

const root = process.cwd();
const result = buildAll();

if (result.errors.length) {
  console.error(`content:check 실패 (${result.errors.length}건)`);
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}

// 검수표는 지금 실제로 서비스하는 기본 팩(en-kid-giyeok) 기준으로 생성한다.
const content = result.contents.find((c) => c.pack.id === DEFAULT_PACK_ID);
if (!content) {
  console.error(`content:check 실패: 기본 팩 ${DEFAULT_PACK_ID} 가 없다`);
  process.exit(1);
}
writeFileSync(join(root, "docs/content-review.md"), renderReviewMarkdown(content));

const pending = content.lessons.filter((l) => !l.reviewed).map((l) => `L${l.order}`);
console.log(`content:check 통과 — 팩 ${result.contents.length}개, 아이템 ${content.items.length}개, 레슨 ${content.lessons.length}장`);
console.log(`검수표: docs/content-review.md${pending.length ? ` (검수 대기: ${pending.join(", ")})` : ""}`);
