/**
 * npm run content:report -- <packId> [--dry-run]
 * 팩 하나의 검수표를 docs/content-review/<packId>.md 로 쓴다 (사람이 눈으로 보는 용도).
 */
import { buildAll } from "@/lib/content/node";
import { parseArgs } from "@/lib/content/tools/plan";
import { planReport } from "@/lib/content/tools/report";
import { finish } from "./content-tools";

const { positional, flags } = parseArgs(process.argv.slice(2), []);
const [packId] = positional;
if (!packId) {
  console.error("사용법: npm run content:report -- <packId> [--dry-run]");
  process.exit(1);
}
const result = buildAll();
const content = result.contents.find((c) => c.pack.id === packId);
if (!content) {
  console.error(`팩 ${packId} 를 읽지 못했다.${result.errors.length ? "\n" + result.errors.filter((e) => e.startsWith(`[${packId}]`)).map((e) => `  - ${e}`).join("\n") : ""}`);
  process.exit(1);
}
console.log(`content:report ${packId}`);
finish(planReport(content), process.cwd(), flags.has("dry-run"));
