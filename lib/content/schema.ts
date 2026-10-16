import { z } from "zod";

/**
 * 콘텐츠 스키마 (기획안 v2 5장 + 대량 개발 지시서 3장). 형태(shape)만 검증한다.
 * 팩 사이·장 사이의 참조·개수·중복 같은 규칙은 lib/content/check.ts 에서 검사한다.
 *
 * 두 층이다.
 * - raw(저작용): content/ 아래 사람이 편집하는 JSON. 인라인 아이템·생략 가능한 퀴즈 등 느슨하다.
 * - normalized(앱용): 빌드(normalize)가 정리한 결과. 앱과 엔진은 이것만 본다.
 */

export const AUDIENCES = ["kid", "adult"] as const;
export const AudienceSchema = z.enum(AUDIENCES);
export type Audience = z.infer<typeof AudienceSchema>;

// ───────────────────────── Subject ─────────────────────────

export const SubjectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    audience: AudienceSchema,
    icon: z.string().min(1).optional(),
    order: z.number().int(),
  })
  .strict();
export type Subject = z.infer<typeof SubjectSchema>;
export const SubjectsFileSchema = z.array(SubjectSchema);

// ───────────────────────── Item ─────────────────────────

export const ITEM_KINDS = ["word", "phrase", "hanzi", "kana", "problem"] as const;
export const ItemKindSchema = z.enum(ITEM_KINDS);
export type ItemKind = z.infer<typeof ItemKindSchema>;

export const ItemSchema = z
  .object({
    /** 팩 안에서 고유 */
    id: z.string().min(1),
    kind: ItemKindSchema,
    /** 단어/문장/가나/식("7 + 5") */
    text: z.string().min(1),
    /** kind=problem 일 때 정답 ("12") */
    answer: z.string().min(1).optional(),
    /** 로마자·발음. 가나는 필수 */
    reading: z.string().min(1).optional(),
    meaningKo: z.string().min(1).optional(),
    /** TTS 로 읽을 텍스트. 없으면 text */
    audioText: z.string().min(1).optional(),
    emoji: z.string().min(1).optional(),
    image: z.string().startsWith("/").optional(),
    audio: z.string().startsWith("/").optional(),
    imageable: z.boolean().default(false),
    /** 약점 집계용 태그 (예: ["gr"], ["-g"], ["carry"]) */
    tags: z.array(z.string().min(1)).default([]),
    /** 자유 필드 (렌더에 쓰지 않는다) */
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((it, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (it.kind === "word" || it.kind === "phrase" || it.kind === "hanzi") need(Boolean(it.meaningKo), "meaningKo", `${it.kind} 아이템은 meaningKo 가 필요하다`);
    if (it.kind === "kana") need(Boolean(it.reading), "reading", "kana 아이템은 reading(로마자)이 필요하다");
    if (it.kind === "problem") need(Boolean(it.answer), "answer", "problem 아이템은 answer(정답)가 필요하다");
    if (it.imageable) need(Boolean(it.emoji || it.image), "imageable", "imageable: true 이면 emoji 또는 image 가 있어야 한다");
  });
export type Item = z.infer<typeof ItemSchema>;

export const ItemsFileSchema = z.array(ItemSchema);

// ───────────────────────── Quiz (기존 5유형 유지) ─────────────────────────

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
export const QuizTypeSchema = z.enum(QUIZ_TYPES);

/** 장에 그림 가능한 아이템이 없을 때 picture_choice 자리를 대신할 수 있는 유형 (규칙: PackRules.allowQuizTypeSubstitution) */
export const SUBSTITUTE_FOR_PICTURE: readonly QuizType[] = ["fill_blank", "listen_choice"];

/** 그림 문항의 정답이 될 수 있는 아이템인가. */
export function canBePictureQuiz(item: Item): boolean {
  return item.imageable;
}

// ───────────────────────── Sentence · Intro · Steps ─────────────────────────

export const SentenceSchema = z
  .object({
    text: z.string().min(1),
    reading: z.string().min(1).optional(),
    meaningKo: z.string().min(1),
    itemIds: z.array(z.string()),
  })
  .strict();
export type Sentence = z.infer<typeof SentenceSchema>;

/** 레슨 첫 화면(오늘의 소리 / 오늘의 단어 / 오늘의 패턴 …). content 의 줄바꿈(\n)이 문단이 된다. */
export const IntroSchema = z
  .object({
    title: z.string().min(1),
    content: z.string().min(1),
    tip: z.string().min(1).optional(),
  })
  .strict();
export type Intro = z.infer<typeof IntroSchema>;

export const LESSON_TYPES = ["phonics", "vocab", "math", "grammar", "listening"] as const;
export const LessonTypeSchema = z.enum(LESSON_TYPES);
export type LessonType = z.infer<typeof LessonTypeSchema>;

export const STEP_TYPES = ["intro", "cards", "listen", "sentences", "practice", "patterns", "quiz"] as const;
export const StepTypeSchema = z.enum(STEP_TYPES);
export type StepType = z.infer<typeof StepTypeSchema>;

// ───────────────────────── Pack ─────────────────────────

export const TTS_LANGS = ["en-US", "ja-JP", "zh-CN", "ko-KR"] as const;
export const TtsLangSchema = z.enum(TTS_LANGS);
export type TtsLang = z.infer<typeof TtsLangSchema>;

/** 대립쌍(minimal pair) 한 칸: 단어의 앞(prefix) 또는 끝(suffix)을 a↔b 로 바꾸면 짝. 예) grass↔glass = prefix gr↔gl */
export const PairSwapSchema = z.object({ at: z.enum(["prefix", "suffix"]), a: z.string().min(1), b: z.string().min(1) }).strict();
export type PairSwap = z.infer<typeof PairSwapSchema>;

/** 이 레슨의 보기 있는 퀴즈 중 minQuizzes 개 이상은 swaps 중 하나로 짝이 되는 보기 쌍을 포함해야 한다. */
export const MinimalPairRuleSchema = z
  .object({
    lessonId: z.string().min(1),
    /** 검증 메시지에 쓰는 이름 ("gr-gl"). 없으면 swaps 로 만든다 */
    label: z.string().min(1).optional(),
    minQuizzes: z.number().int().min(1),
    swaps: z.array(PairSwapSchema).min(1),
  })
  .strict();
export type MinimalPairRule = z.infer<typeof MinimalPairRuleSchema>;

/**
 * 팩 규칙. 예전에 코드에 박혀 있던 숫자(8단어·문장 2개·퀴즈 5유형 1개씩)를 팩 데이터로 옮긴 것.
 * 규칙 검증(check.ts)과 자동 퀴즈(build)는 전부 이 값을 읽는다.
 */
export const PackRulesSchema = z
  .object({
    itemsPerLesson: z.number().int().min(1).default(8),
    sentencesPerLesson: z.number().int().min(0).default(2),
    /** 문장 하나가 써야 하는 이 장 아이템의 최소 개수 */
    minItemsPerSentence: z.number().int().min(0).default(2),
    quizPerLesson: z.number().int().min(1).default(5),
    allowedQuizTypes: z.array(QuizTypeSchema).min(1).default([...QUIZ_TYPES]),
    /** 반드시 1개씩 들어가야 하는 유형 (영어 어린이: 5유형 전부) */
    requiredQuizTypes: z.array(QuizTypeSchema).optional(),
    /** 그림 가능한 아이템이 없는 장에서 picture_choice 자리를 다른 유형으로 대체할 수 있는가 */
    allowQuizTypeSubstitution: z.boolean().default(false),
    /** quiz 를 생략하면 빌드가 자동 생성 */
    autoQuiz: z.boolean().default(false),
    minimalPairs: z.array(MinimalPairRuleSchema).optional(),
  })
  .strict();
export type PackRules = z.infer<typeof PackRulesSchema>;

const packShape = {
  /** 기존 id 는 절대 바꾸지 않는다 (저장된 진행 기록이 이 id 를 가리킨다) */
  id: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(1),
  /** "초급", "A1", "초등 1학년" 처럼 사람이 읽는 레벨 */
  level: z.string().min(1),
  /** 레벨 필터·정렬용 */
  levelOrder: z.number().int(),
  /** 같은 과목 안 순서 */
  order: z.number().int(),
  brandLabel: z.string().min(1).optional(),
  unitKey: z.string().min(1).optional(),
  unitLabel: z.string().min(1).optional(),
  /** 부모 요약의 "가장 많이 틀린 ○○" 에 들어가는 말 (소리, 받아올림 …) */
  tagLabel: z.string().min(1).default("소리"),
  ttsLang: TtsLangSchema,
  status: z.enum(["live", "soon"]),
  /** 표시만 한다. 결제 연결은 이번 범위가 아니다 */
  access: z.enum(["free", "paid"]).default("free"),
  /** 앞 팩을 끝내야 열린다 */
  unlock: z.object({ afterPackId: z.string().min(1) }).strict().optional(),
  rules: PackRulesSchema.default(PackRulesSchema.parse({})),
};

/** 앱이 쓰는 팩. lessonCount 는 빌드가 계산한 값이다. */
export const PackSchema = z.object({ ...packShape, lessonCount: z.number().int().min(0) }).strict();
export type Pack = z.infer<typeof PackSchema>;

/** content/packs/{id}/pack.json. lessonCount 는 적지 않아도 되고, 적혀 있으면 실제 레슨 수와 맞아야 한다. */
export const RawPackSchema = z.object({ ...packShape, lessonCount: z.number().int().min(0).optional() }).strict();
export type RawPack = z.infer<typeof RawPackSchema>;

// ───────────────────────── Generator (math) ─────────────────────────

export const ARITHMETIC_OPS = ["+", "-", "×", "÷"] as const;
export type ArithmeticOp = (typeof ARITHMETIC_OPS)[number];

/**
 * 연산 문제 생성기. 레슨에 `generator` 를 적으면 빌드가 problem 아이템 `count` 개를 만든다.
 * 같은 레슨이면 항상 같은 문제 (seed 기본값 = 레슨 id). 한 레슨 안에서 같은 식은 나오지 않는다.
 * - 피연산자는 모두 [min, max] 안. 나눗셈은 나누는 수·몫이 [min, max] (나누는 수 ≥ 1), 나뉘는 수 = 나누는 수 × 몫.
 * - noCarry: 덧셈에서 어느 자리도 받아올림이 없다. noBorrow: 뺄셈에서 어느 자리도 받아내림이 없다.
 * - allowNegative: false(기본)면 뺄셈 답이 음수가 되지 않는다.
 */
export const GeneratorSchema = z
  .object({
    kind: z.literal("arithmetic"),
    op: z.enum(ARITHMETIC_OPS),
    min: z.number().int().min(0),
    max: z.number().int().min(1).max(999),
    count: z.number().int().min(1).max(100),
    noCarry: z.boolean().default(false),
    noBorrow: z.boolean().default(false),
    allowNegative: z.boolean().default(false),
    seed: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((g, ctx) => {
    if (g.min > g.max) ctx.addIssue({ code: "custom", path: ["min"], message: "min 이 max 보다 클 수 없다" });
    if (g.noCarry && g.op !== "+") ctx.addIssue({ code: "custom", path: ["noCarry"], message: "noCarry 는 덧셈(+)에만 쓴다" });
    if (g.noBorrow && g.op !== "-") ctx.addIssue({ code: "custom", path: ["noBorrow"], message: "noBorrow 는 뺄셈(-)에만 쓴다" });
    if (g.allowNegative && g.op !== "-") ctx.addIssue({ code: "custom", path: ["allowNegative"], message: "allowNegative 는 뺄셈(-)에만 쓴다" });
  });
export type Generator = z.infer<typeof GeneratorSchema>;

// ───────────────────────── Lesson ─────────────────────────

/** 앱이 쓰는 레슨 (normalize 결과). itemIds·quiz·steps 가 항상 채워져 있다. */
export const LessonSchema = z
  .object({
    id: z.string().min(1),
    packId: z.string().min(1),
    order: z.number().int().min(1),
    title: z.string().min(1),
    type: LessonTypeSchema,
    intro: IntroSchema.optional(),
    itemIds: z.array(z.string()),
    sentences: z.array(SentenceSchema),
    steps: z.array(StepTypeSchema).min(1),
    quiz: z.array(QuizSchema),
    reviewed: z.boolean(),
    testOnly: z.boolean(),
  })
  .strict();
export type Lesson = z.infer<typeof LessonSchema>;

/** content/packs/{id}/lessons/NN.json — 인라인 items 또는 itemIds, quiz 생략(autoQuiz) 가능. */
export const RawLessonSchema = z
  .object({
    id: z.string().min(1).optional(),
    packId: z.string().min(1).optional(),
    order: z.number().int().min(1),
    title: z.string().min(1),
    type: LessonTypeSchema,
    intro: IntroSchema.optional(),
    items: z.array(ItemSchema).optional(),
    itemIds: z.array(z.string()).optional(),
    /** 문제를 직접 적는 대신 생성 규칙만 적는다 (items·itemIds 와 함께 쓸 수 없다) */
    generator: GeneratorSchema.optional(),
    sentences: z.array(SentenceSchema).default([]),
    steps: z.array(StepTypeSchema).min(1).optional(),
    quiz: z.array(QuizSchema).optional(),
    reviewed: z.boolean().default(false),
    /** 시드/테스트용. Production 노출 금지 */
    testOnly: z.boolean().default(false),
  })
  .strict();
export type RawLesson = z.infer<typeof RawLessonSchema>;

export type Content = {
  pack: Pack;
  items: Item[];
  itemsById: ReadonlyMap<string, Item>;
  /** order 오름차순 */
  lessons: Lesson[];
};
