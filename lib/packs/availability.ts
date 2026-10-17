import type { Loadable } from "@/lib/content/use-content";
import type { Content } from "@/lib/content/schema";
import { defaultVisibility, type Visibility } from "@/lib/content/visibility";

/** 학습·목차 화면을 막는 이유. null 이면 열 수 있다 (로딩·fetch 실패는 null). */
export type PackBlockReason = "missing" | "locked" | "soon" | "empty";

const BLOCK_COPY: Record<PackBlockReason, { title: string; body: string }> = {
  missing: { title: "팩을 찾을 수 없어요", body: "주소가 잘못됐거나 아직 공개되지 않은 팩이에요." },
  locked: { title: "아직 잠긴 팩이에요", body: "앞 팩을 먼저 끝내면 열려요." },
  soon: { title: "준비 중인 팩이에요", body: "조금만 기다려 주세요. 공개되면 팩 목록에 보여요." },
  empty: { title: "아직 공개된 장이 없어요", body: "검수가 끝난 장이 생기면 여기서 시작할 수 있어요." },
};

export function packBlockCopy(reason: PackBlockReason): { title: string; body: string } {
  return BLOCK_COPY[reason];
}

/**
 * 이 팩 화면(학습·목차)을 열 수 없는 이유.
 * 알 수 없는 팩 · 레슨이 하나도 없는 팩 · 아직 잠긴 팩 · (Production 에서) 준비 중 팩.
 * 불러오는 중이거나 실패한 경우는 null — 화면이 스켈레톤/실패 안내를 보여준다.
 * Debug 에서는 레슨이 있으면 준비 중(soon) 팩도 열린다 (검수 전 콘텐츠 확인용).
 */
export function packBlockReason(
  pack: Loadable<Content>,
  locked: boolean,
  v: Visibility = defaultVisibility(),
): PackBlockReason | null {
  if (pack.status === "missing") return "missing";
  if (locked) return "locked";
  if (pack.status !== "ready") return null;
  if (pack.data.lessons.length === 0) return "empty";
  if (pack.data.pack.status !== "live" && !v.debug) return "soon";
  return null;
}

export function packUnavailable(pack: Loadable<Content>, locked: boolean, v: Visibility = defaultVisibility()): boolean {
  return packBlockReason(pack, locked, v) !== null;
}
