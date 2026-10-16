import { renderReviewMarkdown } from "../review";
import type { Content } from "../schema";
import { newPlan, type Plan } from "./plan";

/** content:report — 팩 하나의 검수표를 docs/content-review/{packId}.md 로. (루트는 저장소 루트, 콘텐츠 루트 아님) */
export function reportFile(packId: string): string {
  return `docs/content-review/${packId}.md`;
}

export function planReport(content: Content): Plan {
  const plan = newPlan();
  plan.files.set(reportFile(content.pack.id), renderReviewMarkdown(content));
  return plan;
}
