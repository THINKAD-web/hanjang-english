/**
 * 콘텐츠 도구 CLI 공통 부분: 계획 출력, --dry-run, 종료 코드.
 */
import { applyPlan, type Plan } from "@/lib/content/tools/plan";

export function finish(plan: Plan, root: string, dryRun: boolean): never {
  for (const w of plan.warnings) console.warn(`⚠️  ${w}`);
  if (plan.errors.length) {
    console.error(`실패 (${plan.errors.length}건) — 아무것도 쓰지 않았다`);
    for (const e of plan.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const { written, unchanged } = applyPlan(plan, root, { dryRun });
  const verb = dryRun ? "쓸 예정" : "씀";
  for (const f of written) console.log(`  ${dryRun ? "~" : "+"} ${f}`);
  console.log(`${dryRun ? "[dry-run] " : ""}${verb} ${written.length}개 · 그대로 ${unchanged.length}개`);
  process.exit(0);
}
