import { z } from "zod";

/**
 * 콘텐츠 스키마. 형태(shape)만 검증한다.
 * 장 사이의 참조·개수·중복 같은 규칙은 lib/content/check.ts 에서 검사한다.
 */

export const SOUNDS = ["gr", "g", "gl", "-g", "k"] as const;
export const SoundSchema = z.enum(SOUNDS);
export type Sound = z.infer<typeof SoundSchema>;

export const WordSchema = z
  .object({
    id: z.string().regex(/^[a-z]+-[a-z]+$/, "id 는 '팩접두어-단어' 형식 (예: g-grape)"),
    text: z.string().min(1),
    meaning: z.string().min(1),
    sound: SoundSchema,
    emoji: z.string().min(1).optional(),
    image: z.string().startsWith("/").optional(),
    audio: z.string().startsWith("/").optional(),
    imageable: z.boolean(),
  })
  .strict()
  .refine((w) => !w.imageable || Boolean(w.emoji || w.image), {
    message: "imageable: true 이면 emoji 또는 image 가 있어야 한다",
  });
export type Word = z.infer<typeof WordSchema>;

export const WordsFileSchema = z.array(WordSchema);

const threeOptions = z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]);

export const PictureChoiceSchema = z
  .object({ type: z.literal("picture_choice"), targetWordId: z.string(), options: threeOptions, answer: z.string() })
  .strict();

export const MeaningChoiceSchema = z
  .object({
    type: z.literal("meaning_choice"),
    targetWordId: z.string(),
    prompt: z.string().min(1),
    options: threeOptions,
    answer: z.string(),
  })
  .strict();

export const FillBlankSchema = z
  .object({
    type: z.literal("fill_blank"),
    targetWordId: z.string(),
    sentence: z.string().includes("____", { message: "sentence 에 ____ 가 있어야 한다" }),
    options: threeOptions,
    answer: z.string(),
  })
  .strict();

export const ListenChoiceSchema = z
  .object({ type: z.literal("listen_choice"), targetWordId: z.string(), options: threeOptions, answer: z.string() })
  .strict();

export const OxSchema = z
  .object({ type: z.literal("ox"), targetWordId: z.string(), statement: z.string().min(1), answer: z.boolean() })
  .strict();

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

export const SentenceSchema = z
  .object({ en: z.string().min(1), ko: z.string().min(1), wordIds: z.array(z.string()) })
  .strict();
export type Sentence = z.infer<typeof SentenceSchema>;

export const LessonSchema = z
  .object({
    id: z.string().regex(/^[a-z]+-\d{2}$/),
    packId: z.string(),
    dayNo: z.number().int().min(1).max(8),
    title: z.string().min(1),
    soundIntro: z.object({ label: z.string().min(1), lines: z.tuple([z.string().min(1), z.string().min(1)]) }).strict(),
    wordIds: z.array(z.string()),
    sentences: z.array(SentenceSchema),
    quiz: z.array(QuizSchema),
    reviewed: z.boolean(),
  })
  .strict();
export type Lesson = z.infer<typeof LessonSchema>;

export const PackSchema = z
  .object({
    id: z.string(),
    consonant: z.string().length(1),
    title: z.string().min(1),
    lessonCount: z.number().int().positive(),
  })
  .strict();
export type Pack = z.infer<typeof PackSchema>;

export type Content = {
  pack: Pack;
  words: Word[];
  wordsById: ReadonlyMap<string, Word>;
  /** dayNo 오름차순 */
  lessons: Lesson[];
};
