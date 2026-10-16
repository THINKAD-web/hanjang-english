/**
 * npm run content:build  (prebuild · predev 에서 자동 실행)
 * content/ 의 모든 팩을 정규화·검증해서 public/content/ 에 쓴다.
 *   public/content/manifest.json        과목, 팩 메타(+계산된 lessonCount), 레슨 목록 요약
 *   public/content/packs/{packId}.json  레슨 본문 전체 (팩 하나 = 파일 하나)
 * 산출물은 git 에 커밋하지 않는다. 같은 입력이면 항상 같은 출력이다.
 * NEXT_PUBLIC_DEBUG=true 가 아니면 공개되지 않는 팩·레슨(시드, 검수 전)은 산출물에서도 뺀다 (lib/content/visibility.ts).
 */
import { buildAll, writeBuild } from "@/lib/content/node";
import { defaultVisibility } from "@/lib/content/visibility";

const result = buildAll();
if (result.errors.length) {
  console.error(`content:build 실패 (${result.errors.length}건)`);
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}
const visibility = defaultVisibility();
const { files } = writeBuild(result, undefined, visibility);
const lessons = result.contents.reduce((n, c) => n + c.lessons.length, 0);
console.log(
  `content:build — 팩 ${result.contents.length}개 · 레슨 ${lessons}장 → public/content (${files}개 파일, ${visibility.debug ? "Debug: 전부 포함" : "Production: 공개 콘텐츠만"})`,
);
