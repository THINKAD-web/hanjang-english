import { existsSync } from "node:fs";
import path from "node:path";
import { listPackIds, readSubjects } from "../node";
import { LESSON_TYPES, TTS_LANGS, type LessonType, type TtsLang } from "../schema";
import { newPlan, PACK_ID_RE, toJsonFile, type Plan } from "./plan";

/**
 * content:new — 새 팩 폴더 뼈대. pack.json(status soon) + 빈 items.json. 레슨은 content:csv / content:import 로 채운다.
 * 이미 폴더가 있으면 아무것도 쓰지 않는다 (덮어쓰기 금지).
 */

export type NewPackOptions = {
  packId: string;
  subjectId: string;
  title: string;
  level?: string;
  levelOrder?: number;
  order?: number;
  ttsLang?: TtsLang;
  lessonType?: LessonType;
};

export function planNewPack(root: string, o: NewPackOptions): Plan {
  const plan = newPlan();
  if (!PACK_ID_RE.test(o.packId)) plan.errors.push(`packId "${o.packId}" 는 소문자·숫자·하이픈만 쓸 수 있다 (예: en-kid-animals)`);
  if (existsSync(path.join(root, "packs", o.packId))) {
    plan.warnings.push(`content/packs/${o.packId} 가 이미 있어 아무것도 만들지 않는다`);
    return plan;
  }
  const subjects = readSubjects(root);
  const subject = subjects.find((s) => s.id === o.subjectId);
  if (!subject) plan.errors.push(`과목 ${o.subjectId} 가 content/subjects.json 에 없다 (있는 과목: ${subjects.map((s) => s.id).join(", ")})`);
  if (o.ttsLang && !TTS_LANGS.includes(o.ttsLang)) plan.errors.push(`ttsLang ${o.ttsLang} 는 ${TTS_LANGS.join(", ")} 중 하나`);
  if (o.lessonType && !LESSON_TYPES.includes(o.lessonType)) plan.errors.push(`lessonType ${o.lessonType} 는 ${LESSON_TYPES.join(", ")} 중 하나`);
  if (plan.errors.length) return plan;

  const siblings = listPackIds(root).length;
  const pack = {
    id: o.packId,
    subjectId: o.subjectId,
    title: o.title,
    level: o.level ?? "초급",
    levelOrder: o.levelOrder ?? 1,
    order: o.order ?? siblings + 1,
    ttsLang: o.ttsLang ?? (subject!.id.startsWith("ja") ? "ja-JP" : "en-US"),
    status: "soon",
    access: "free",
    rules: {
      itemsPerLesson: 8,
      sentencesPerLesson: 0,
      minItemsPerSentence: 0,
      quizPerLesson: 5,
      allowedQuizTypes: ["picture_choice", "meaning_choice", "listen_choice", "ox"],
      autoQuiz: true,
    },
  };
  plan.files.set(`packs/${o.packId}/pack.json`, toJsonFile(pack));
  plan.files.set(`packs/${o.packId}/items.json`, toJsonFile([]));
  return plan;
}
