import { z } from "zod";

/**
 * 콘텐츠 스키마 (기획안 v2 5장). 형태(shape)만 검증한다.
 * 팩 사이·장 사이의 참조·개수·중복 같은 규칙은 lib/content/check.ts 에서 검사한다.
 */

export const LANGUAGES = ["en", "ja", "zh"] as const;
export const LanguageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof LanguageSchema>;

export const AUDIENCES = ["kid", "adult"] as const;
export const AudienceSchema = z.enum(AUDIENCES);
export type Audience = z.infer<typeof AudienceSchema>;

export const ITEM_KINDS = ["word", "phrase", "hanzi"] as const;
export const ItemKindSchema = z.enum(ITEM_KINDS);
export type ItemKind = z.infer<typeof ItemKindSchema>;

export const ItemSchema = z
  .object({
    id: z.string().min(1),
    kind: ItemKindSchema,
    text: z.string().min(1),
    /** 카나 로마자·병음 등. 없으면 생략 (어린이 영어에는 없다) */
    reading: z.string().min(1).optional(),
    meaningKo: z.string().min(1),
    emoji: z.string().min(1).optional(),
    image: z.string().startsWith("/").optional(),
    audio: z.string().startsWith("/").optional(),
    imageable: z.boolean(),
    /** 약점 집계용 태그 (예: ["gr"], ["-g"]). 최소 1개 */
    tags: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .refine((it) => !it.imageable || Boolean(it.emoji || it.image), {
    message: "imageable: true 이면 emoji 또는 image 가 있어야 한다",
  });
export type Item = z.infer<typeof ItemSchema>;

export const ItemsFileSchema = z.array(ItemSchema);

const threeOptions = z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]);

export const PictureChoiceSchema = z
  .object({ type: z.literal("picture_choice"), targetItemId: z.string(), options: threeOptions, answer: z.string() })
  .strict();

export const MeaningChoiceSchema = z
  .object({
    type: z.literal("meaning_choice"),
    targetItemId: z.string(),
    prompt: z.string().min(1),
    options: threeOptions,
    answer: z.string(),
  })
  .strict();

export const FillBlankSchema = z
  .object({
    type: z.literal("fill_blank"),
    targetItemId: z.string(),
    sentence: z.string().includes("____", { message: "sentence 에 ____ 가 있어야 한다" }),
    options: threeOptions,
    answer: z.string(),
  })
  .strict();

export const ListenChoiceSchema = z
  .object({ type: z.literal("listen_choice"), targetItemId: z.string(), options: threeOptions, answer: z.string() })
  .strict();

export const OxSchema = z
  .object({ type: z.literal("ox"), targetItemId: z.string(), statement: z.string().min(1), answer: z.boolean() })
  .strict();

// 퀴즈 유형 이름은 기존 코드와 동일하게 유지한다 (이름을 바꾸는 작업은 하지 않는다 — 기획안 5-4).
export const QuizSchema = z.discriminatedUnion("type", [
  PictureChoiceSchema,
  MeaningChoiceSchema,
  FillBlankSchema,
  ListenChoiceSchema,
  OxSchema,
]);
export type Quiz = z.infer<typeof QuizSchema>;
export type QuizType = Quiz["type"];
export type ChoiceQuiz = Exclude<Quiz, { type: "ox" }>;

export const QUIZ_TYPES = [
  "picture_choice",
  "meaning_choice",
  "fill_blank",
  "listen_choice",
  "ox",
] as const satisfies readonly QuizType[];

/** 그림 문항의 정답이 될 수 있는 아이템인가. */
export function canBePictureQuiz(item: Item): boolean {
  return item.imageable;
}

export const SentenceSchema = z
  .object({
    text: z.string().min(1),
    reading: z.string().min(1).optional(),
    meaningKo: z.string().min(1),
    itemIds: z.array(z.string()),
  })
  .strict();
export type Sentence = z.infer<typeof SentenceSchema>;

/** 오늘의 소리 / 오늘의 패턴 / 오늘의 한자 — 팩마다 이름은 다르지만 형태는 같다. */
export const FocusSchema = z.object({ label: z.string().min(1), lines: z.tuple([z.string().min(1), z.string().min(1)]) }).strict();
export type Focus = z.infer<typeof FocusSchema>;

export const LessonSchema = z
  .object({
    id: z.string().min(1),
    packId: z.string().min(1),
    dayNo: z.number().int().min(1),
    title: z.string().min(1),
    focus: FocusSchema,
    itemIds: z.array(z.string()),
    sentences: z.array(SentenceSchema),
    quiz: z.array(QuizSchema),
    reviewed: z.boolean(),
  })
  .strict();
export type Lesson = z.infer<typeof LessonSchema>;

export const PackSchema = z
  .object({
    id: z.string().min(1),
    language: LanguageSchema,
    audience: AudienceSchema,
    title: z.string().min(1),
    brandLabel: z.string().min(1),
    unitKey: z.string().min(1),
    unitLabel: z.string().min(1),
    lessonCount: z.number().int().positive(),
    status: z.enum(["live", "soon"]),
  })
  .strict();
export type Pack = z.infer<typeof PackSchema>;

/** /content/packs.json 한 행. contentPath 가 없으면 "준비 중" 표시용일 뿐 콘텐츠가 없다. */
export const PackSummarySchema = z
  .object({
    id: z.string().min(1),
    language: LanguageSchema,
    audience: AudienceSchema,
    title: z.string().min(1),
    brandLabel: z.string().min(1),
    unitLabel: z.string().min(1),
    status: z.enum(["live", "soon"]),
    contentPath: z.string().min(1).optional(),
  })
  .strict();
export type PackSummary = z.infer<typeof PackSummarySchema>;
export const PacksFileSchema = z.array(PackSummarySchema);

export type Content = {
  pack: Pack;
  items: Item[];
  itemsById: ReadonlyMap<string, Item>;
  /** dayNo 오름차순 */
  lessons: Lesson[];
};
