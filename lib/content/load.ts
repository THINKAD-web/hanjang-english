import packsJson from "@/content/packs.json";
import enKidGiyeokPack from "@/content/en/kid/giyeok/pack.json";
import enKidGiyeokItems from "@/content/en/kid/giyeok/items.json";
import enKidGiyeokLesson01 from "@/content/en/kid/giyeok/lessons/01.json";
import enKidGiyeokLesson02 from "@/content/en/kid/giyeok/lessons/02.json";
import enKidGiyeokLesson03 from "@/content/en/kid/giyeok/lessons/03.json";
import enKidGiyeokLesson04 from "@/content/en/kid/giyeok/lessons/04.json";
import enKidGiyeokLesson05 from "@/content/en/kid/giyeok/lessons/05.json";
import enKidGiyeokLesson06 from "@/content/en/kid/giyeok/lessons/06.json";
import enKidGiyeokLesson07 from "@/content/en/kid/giyeok/lessons/07.json";
import enKidGiyeokLesson08 from "@/content/en/kid/giyeok/lessons/08.json";
import { ItemsFileSchema, LessonSchema, PackSchema, PacksFileSchema, type Content, type PackSummary } from "./schema";

export type RawContent = { pack: unknown; items: unknown; lessons: unknown[] };

/**
 * 실제 콘텐츠가 있는 팩만 여기 등록한다. `content/packs.json` 에는 "준비 중" 팩도 나열되지만
 * 실제 파일이 없으므로 이 레지스트리에는 없다. 팩을 추가하면 여기에도 등록한다
 * (누락되면 content:check 가 잡는다).
 */
export const CONTENT_REGISTRY: Record<string, RawContent> = {
  "en-kid-giyeok": {
    pack: enKidGiyeokPack,
    items: enKidGiyeokItems,
    lessons: [
      enKidGiyeokLesson01,
      enKidGiyeokLesson02,
      enKidGiyeokLesson03,
      enKidGiyeokLesson04,
      enKidGiyeokLesson05,
      enKidGiyeokLesson06,
      enKidGiyeokLesson07,
      enKidGiyeokLesson08,
    ],
  },
};

/** 지금 실제로 서비스하는(콘텐츠가 있는) 팩 id. 홈의 "이어서" 카드가 기본으로 쓴다. */
export const DEFAULT_PACK_ID = "en-kid-giyeok";

/** 스키마로 파싱하고 조회용 인덱스를 만든다. 형태가 틀리면 throw. 팩 간 규칙은 check.ts 가 담당. */
export function parseContent(raw: RawContent): Content {
  const pack = PackSchema.parse(raw.pack);
  const items = ItemsFileSchema.parse(raw.items);
  const lessons = raw.lessons.map((l) => LessonSchema.parse(l)).sort((a, b) => a.dayNo - b.dayNo);
  return { pack, items, itemsById: new Map(items.map((it) => [it.id, it])), lessons };
}

const cache = new Map<string, Content>();

export function loadContent(packId: string = DEFAULT_PACK_ID): Content {
  const cached = cache.get(packId);
  if (cached) return cached;
  const raw = CONTENT_REGISTRY[packId];
  if (!raw) throw new Error(`콘텐츠가 없는 팩: ${packId}`);
  const parsed = parseContent(raw);
  cache.set(packId, parsed);
  return parsed;
}

export function loadPacksSummary(): PackSummary[] {
  return PacksFileSchema.parse(packsJson);
}

/** 홈·팩 목록에서 "지금 열려 있는" 팩만 (status: live, 콘텐츠 있음). */
export function loadLivePacks(): PackSummary[] {
  return loadPacksSummary().filter((p) => p.status === "live" && p.id in CONTENT_REGISTRY);
}
