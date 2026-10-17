/**
 * 베타 테스트용 팩 대량 공개 — content:check 통과 후 Production 에서 열리게 메타·레슨을 맞춘다.
 * npm run content:beta-expand
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { contentRoot } from "@/lib/content/node";
import { planCsv } from "@/lib/content/tools/csv";
import { applyPlan, toJsonFile } from "@/lib/content/tools/plan";
import { planNewPack } from "@/lib/content/tools/scaffold";
import type { Item, LessonType } from "@/lib/content/schema";

const root = contentRoot();
const beta = path.join(root, "seed", "beta");

type CsvPack = {
  packId: string;
  subjectId: string;
  title: string;
  csv: string;
  size: number;
  lessonType: LessonType;
  kind: Item["kind"];
  ttsLang?: string;
  level?: string;
  levelOrder?: number;
  order?: number;
  unitLabel?: string;
  tagLabel?: string;
  rules?: Record<string, unknown>;
  exists?: boolean;
};

const KID_CSV: CsvPack[] = [
  {
    packId: "en-kid-colors",
    subjectId: "en-kid",
    title: "어린이 영어 · 색깔",
    csv: "en-kid-colors.csv",
    size: 6,
    lessonType: "vocab",
    kind: "word",
    order: 3,
    unitLabel: "색깔",
    tagLabel: "색",
    rules: { itemsPerLesson: 6, allowedQuizTypes: ["picture_choice", "meaning_choice", "listen_choice", "ox"] },
  },
  {
    packId: "en-kid-numbers",
    subjectId: "en-kid",
    title: "어린이 영어 · 숫자",
    csv: "en-kid-numbers.csv",
    size: 6,
    lessonType: "vocab",
    kind: "word",
    order: 4,
    unitLabel: "숫자",
    tagLabel: "수",
  },
  {
    packId: "en-kid-family",
    subjectId: "en-kid",
    title: "어린이 영어 · 가족",
    csv: "en-kid-family.csv",
    size: 6,
    lessonType: "vocab",
    kind: "word",
    order: 5,
    unitLabel: "가족",
    tagLabel: "관계",
  },
  {
    packId: "ja-kid-hiragana",
    subjectId: "ja-kid",
    title: "어린이 일본어 · 히라가나",
    csv: "ja-kid-hiragana.csv",
    size: 5,
    lessonType: "phonics",
    kind: "kana",
    ttsLang: "ja-JP",
    order: 1,
    unitLabel: "あ",
    tagLabel: "행",
    exists: true,
    rules: {
      itemsPerLesson: 5,
      quizPerLesson: 5,
      allowedQuizTypes: ["meaning_choice", "listen_choice", "ox"],
      autoQuiz: true,
    },
  },
  {
    packId: "science-kid-daily",
    subjectId: "science-kid",
    title: "어린이 상식 · 자연",
    csv: "science-kid-daily.csv",
    size: 6,
    lessonType: "vocab",
    kind: "word",
    ttsLang: "ko-KR",
    order: 1,
    unitLabel: "자연",
    tagLabel: "날씨",
  },
  {
    packId: "ko-kid-nieun",
    subjectId: "ko-kid",
    title: "어린이 한글 · 자음·모음",
    csv: "ko-kid-nieun.csv",
    size: 6,
    lessonType: "phonics",
    kind: "word",
    ttsLang: "ko-KR",
    order: 1,
    unitLabel: "ㄱㄴ",
    tagLabel: "글자",
  },
];

const ADULT_CSV: CsvPack[] = [
  {
    packId: "ja-adult-travel",
    subjectId: "ja-adult",
    title: "성인 일본어 · 여행",
    csv: "ja-adult-travel.csv",
    size: 6,
    lessonType: "vocab",
    kind: "phrase",
    ttsLang: "ja-JP",
    order: 2,
    unitLabel: "travel",
    tagLabel: "상황",
    exists: true,
    rules: {
      itemsPerLesson: 6,
      allowedQuizTypes: ["meaning_choice", "listen_choice", "ox"],
      autoQuiz: true,
    },
  },
  {
    packId: "en-adult-meeting",
    subjectId: "en-adult",
    title: "성인 영어 · 회의",
    csv: "en-adult-meeting.csv",
    size: 6,
    lessonType: "vocab",
    kind: "phrase",
    order: 2,
    unitLabel: "meeting",
    tagLabel: "회의",
    rules: { itemsPerLesson: 6, allowedQuizTypes: ["meaning_choice", "listen_choice", "ox"], autoQuiz: true },
  },
  {
    packId: "en-adult-email",
    subjectId: "en-adult",
    title: "성인 영어 · 이메일",
    csv: "en-adult-email.csv",
    size: 6,
    lessonType: "vocab",
    kind: "phrase",
    order: 3,
    unitLabel: "email",
    tagLabel: "메일",
  },
  {
    packId: "en-adult-present",
    subjectId: "en-adult",
    title: "성인 영어 · 발표",
    csv: "en-adult-present.csv",
    size: 6,
    lessonType: "vocab",
    kind: "phrase",
    order: 4,
    unitLabel: "present",
    tagLabel: "발표",
  },
  {
    packId: "en-adult-dining",
    subjectId: "en-adult",
    title: "성인 영어 · 식사",
    csv: "en-adult-dining.csv",
    size: 6,
    lessonType: "vocab",
    kind: "phrase",
    order: 5,
    unitLabel: "dining",
    tagLabel: "식사",
  },
  {
    packId: "en-adult-smalltalk",
    subjectId: "en-adult",
    title: "성인 영어 · 스몰톡",
    csv: "en-adult-smalltalk.csv",
    size: 6,
    lessonType: "vocab",
    kind: "phrase",
    order: 6,
    unitLabel: "chat",
    tagLabel: "대화",
  },
  {
    packId: "zh-adult-greeting",
    subjectId: "zh-adult",
    title: "성인 중국어 · 인사",
    csv: "zh-adult-greeting.csv",
    size: 6,
    lessonType: "vocab",
    kind: "hanzi",
    ttsLang: "zh-CN",
    order: 1,
    unitLabel: "问候",
    tagLabel: "인사",
    rules: { itemsPerLesson: 6, allowedQuizTypes: ["meaning_choice", "listen_choice", "ox"], autoQuiz: true },
  },
  {
    packId: "ko-adult-manner",
    subjectId: "ko-adult",
    title: "성인 한국어 · 예절",
    csv: "ko-adult-manner.csv",
    size: 6,
    lessonType: "vocab",
    kind: "phrase",
    ttsLang: "ko-KR",
    order: 1,
    unitLabel: "예절",
    tagLabel: "말하기",
  },
  {
    packId: "ja-adult-shop",
    subjectId: "ja-adult",
    title: "성인 일본어 · 쇼핑",
    csv: "ja-adult-shop.csv",
    size: 6,
    lessonType: "vocab",
    kind: "phrase",
    ttsLang: "ja-JP",
    order: 3,
    unitLabel: "shop",
    tagLabel: "쇼핑",
  },
];

function mergePlan(...parts: ReturnType<typeof planNewPack>[]) {
  const files = new Map<string, string>();
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const p of parts) {
    for (const [k, v] of p.files) files.set(k, v);
    errors.push(...p.errors);
    warnings.push(...p.warnings);
  }
  return { files, errors, warnings };
}

function patchPackJson(packId: string, patch: Record<string, unknown>) {
  const full = path.join(root, "packs", packId, "pack.json");
  const cur = JSON.parse(readFileSync(full, "utf8")) as Record<string, unknown>;
  const rules = {
    ...(cur.rules as object),
    ...((patch.rules as object | undefined) ?? {}),
    autoQuiz: (patch.rules as { autoQuiz?: boolean } | undefined)?.autoQuiz ?? (cur.rules as { autoQuiz?: boolean })?.autoQuiz ?? true,
  };
  const next: Record<string, unknown> = { ...cur, rules, status: "live" };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "rules" || v === undefined) continue;
    next[k] = v;
  }
  if (!next.ttsLang) {
    const sid = String(next.subjectId ?? "");
    next.ttsLang = sid.startsWith("ja")
      ? "ja-JP"
      : sid.startsWith("zh")
        ? "zh-CN"
        : sid.startsWith("ko") || sid.startsWith("science")
          ? "ko-KR"
          : "en-US";
  }
  writeFileSync(full, toJsonFile(next));
}

function openAllLessons(packId: string) {
  const dir = path.join(root, "packs", packId, "lessons");
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((x) => /^\d+\.json$/.test(x))) {
    const full = path.join(dir, f);
    const lesson = JSON.parse(readFileSync(full, "utf8")) as { reviewed?: boolean; testOnly?: boolean };
    lesson.reviewed = true;
    lesson.testOnly = false;
    writeFileSync(full, `${JSON.stringify(lesson, null, 2)}\n`);
  }
}

function openLessonRange(packId: string, maxOrder: number) {
  const dir = path.join(root, "packs", packId, "lessons");
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((x) => /^\d+\.json$/.test(x))) {
    const order = Number(f.slice(0, -5));
    const full = path.join(dir, f);
    const lesson = JSON.parse(readFileSync(full, "utf8")) as { reviewed?: boolean; testOnly?: boolean };
    if (order <= maxOrder) {
      lesson.reviewed = true;
      lesson.testOnly = false;
    }
    writeFileSync(full, `${JSON.stringify(lesson, null, 2)}\n`);
  }
}

function ensureCsvPack(spec: CsvPack) {
  const plans = [];
  if (!spec.exists) {
    const scaffold = planNewPack(root, {
      packId: spec.packId,
      subjectId: spec.subjectId,
      title: spec.title,
      ttsLang: spec.ttsLang as "en-US" | undefined,
      level: spec.level,
      levelOrder: spec.levelOrder,
      order: spec.order,
    });
    plans.push(scaffold);
    if (scaffold.errors.length) throw new Error(scaffold.errors.join("; "));
    applyPlan(scaffold, root, { dryRun: false });
  }
  patchPackJson(spec.packId, {
    title: spec.title,
    subjectId: spec.subjectId,
    level: spec.level ?? "초급",
    levelOrder: spec.levelOrder ?? 1,
    order: spec.order,
    ttsLang: spec.ttsLang,
    unitLabel: spec.unitLabel,
    tagLabel: spec.tagLabel,
    rules: spec.rules ?? { itemsPerLesson: spec.size },
  });

  const csvPath = path.join(beta, spec.csv);
  const csvPlan = planCsv(root, readFileSync(csvPath, "utf8"), {
    packId: spec.packId,
    size: spec.size,
    lessonType: spec.lessonType,
    kind: spec.kind,
    testOnly: false,
    forceReviewed: true,
  });
  if (csvPlan.errors.length) throw new Error(`${spec.packId}: ${csvPlan.errors.join("; ")}`);
  applyPlan(csvPlan, root, { dryRun: false });
  openAllLessons(spec.packId);
}

function writeMathMulPack() {
  const packId = "math-kid-mul-1";
  if (!existsSync(path.join(root, "packs", packId))) {
    const scaffold = planNewPack(root, {
      packId,
      subjectId: "math-kid",
      title: "어린이 수학 · 곱셈 1",
      ttsLang: "ko-KR",
      level: "초등 2",
      levelOrder: 1,
      order: 4,
    });
    if (scaffold.errors.length) throw new Error(scaffold.errors.join("; "));
    applyPlan(scaffold, root, { dryRun: false });
  }
  patchPackJson(packId, {
    title: "어린이 수학 · 곱셈 1",
    unitLabel: "곱셈",
    tagLabel: "연산",
    rules: {
      itemsPerLesson: 6,
      quizPerLesson: 5,
      allowedQuizTypes: ["fill_blank"],
      autoQuiz: true,
    },
  });
  const intro = { title: "곱셈", content: "곱하기 문제를 풀어요\n식을 보고 알맞은 수를 맞혀 보세요" };
  mkdirSync(path.join(root, "packs", packId, "lessons"), { recursive: true });
  for (let order = 1; order <= 3; order++) {
    const lesson = {
      order,
      title: `곱셈 ${order}`,
      type: "math",
      intro,
      generator: { kind: "arithmetic", op: "×", count: 6, min: 1, max: order === 1 ? 3 : order === 2 ? 5 : 9 },
      reviewed: true,
      testOnly: false,
    };
    writeFileSync(path.join(root, "packs", packId, "lessons", `${String(order).padStart(2, "0")}.json`), `${JSON.stringify(lesson, null, 2)}\n`);
  }
}

console.log("content:beta-expand — subjects 확인 후 팩 생성");
for (const spec of [...KID_CSV, ...ADULT_CSV]) {
  console.log(`  · ${spec.packId}`);
  ensureCsvPack(spec);
}
writeMathMulPack();

console.log("기존 팩 메타 공개");
openLessonRange("en-kid-animals", 3);
openLessonRange("math-kid-sub-1", 3);
// en-adult-travel · ja-adult-hiragana-1 공개 범위 유지 (5장)
openLessonRange("en-adult-travel", 5);
openLessonRange("ja-adult-hiragana-1", 5);

console.log("완료 — npm run content:check 실행");
