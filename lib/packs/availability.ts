import type { Loadable } from "@/lib/content/use-content";
import type { Content } from "@/lib/content/schema";
import { defaultVisibility, type Visibility } from "@/lib/content/visibility";

/**
 * 이 팩 화면(학습·목차)을 열 수 없어서 /packs 로 돌려보내야 하는가.
 * 알 수 없는 팩 · 레슨이 하나도 없는 팩 · 아직 잠긴 팩 · (Production 에서) 준비 중 팩.
 * 불러오는 중이거나 실패한 경우는 "열 수 없음" 이 아니다 — 화면이 스켈레톤/실패 안내를 보여준다.
 * Debug 에서는 레슨이 있으면 준비 중(soon) 팩도 열린다 (검수 전 콘텐츠 확인용).
 */
export function packUnavailable(pack: Loadable<Content>, locked: boolean, v: Visibility = defaultVisibility()): boolean {
  if (pack.status === "missing" || locked) return true;
  if (pack.status !== "ready") return false;
  return pack.data.lessons.length === 0 || (pack.data.pack.status !== "live" && !v.debug);
}
