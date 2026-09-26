import packJson from "@/content/giyeok/pack.json";
import wordsJson from "@/content/giyeok/words.json";
import lesson01 from "@/content/giyeok/lessons/01.json";
import lesson02 from "@/content/giyeok/lessons/02.json";
import lesson03 from "@/content/giyeok/lessons/03.json";
import lesson04 from "@/content/giyeok/lessons/04.json";
import lesson05 from "@/content/giyeok/lessons/05.json";
import lesson06 from "@/content/giyeok/lessons/06.json";
import lesson07 from "@/content/giyeok/lessons/07.json";
import lesson08 from "@/content/giyeok/lessons/08.json";
import { LessonSchema, PackSchema, WordsFileSchema, type Content } from "./schema";

export type RawContent = { pack: unknown; words: unknown; lessons: unknown[] };

/** 번들에 포함되는 ㄱ 팩 원본 JSON. 레슨 파일을 추가하면 여기에도 추가한다 (content:check 가 누락을 잡는다). */
export const rawGiyeok: RawContent = {
  pack: packJson,
  words: wordsJson,
  lessons: [lesson01, lesson02, lesson03, lesson04, lesson05, lesson06, lesson07, lesson08],
};

/** 스키마로 파싱하고 조회용 인덱스를 만든다. 형태가 틀리면 throw. 장 간 규칙은 check.ts 가 담당. */
export function parseContent(raw: RawContent): Content {
  const pack = PackSchema.parse(raw.pack);
  const words = WordsFileSchema.parse(raw.words);
  const lessons = raw.lessons.map((l) => LessonSchema.parse(l)).sort((a, b) => a.dayNo - b.dayNo);
  return { pack, words, wordsById: new Map(words.map((w) => [w.id, w])), lessons };
}

let cached: Content | null = null;

export function loadContent(): Content {
  cached ??= parseContent(rawGiyeok);
  return cached;
}
