import type { Pack } from "./schema";

/** "ㄱ · 3/8장" 같은 진행 문구에 쓰는 단위 이름. unitLabel 이 없는 팩은 팩 제목으로 대신한다. */
export function unitLabelOf(pack: Pick<Pack, "unitLabel" | "title">): string {
  return pack.unitLabel ?? pack.title;
}
