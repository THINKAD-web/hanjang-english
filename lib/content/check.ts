import { verifyProblem } from "./arithmetic";
import { meaningChoicePrompt, meaningOf, quizAnswerOf } from "./item-text";
import { normalizeContent, type RawContent } from "./normalize";
import { SUBSTITUTE_FOR_PICTURE, type ChoiceQuiz, type Content, type Item, type Lesson, type PackRules, type PairSwap, type QuizType } from "./schema";

/**
 * content:check 규칙 (지시서 4-4 + 기획안 v2 5-5 예외 + 대량 개발 지시서 3-2).
 * 순수 함수 — 에러 메시지 목록을 돌려준다. 빈 배열이면 통과.
 * 개수·유형 규칙은 전부 `pack.rules` 를 읽는다 (코드에 박힌 숫자 없음).
 */

export { SUBSTITUTE_FOR_PICTURE };

/** 단어의 앞/끝을 a↔b 로 바꾸면 짝인가. 예) grass↔glass (prefix gr↔gl), bag↔back (suffix g↔ck). 순서는 상관없다. */
export function isPair(swaps: readonly PairSwap[], a: string, b: string): boolean {
  const test = (x: string, y: string) =>
    swaps.some((s) =>
      s.at === "prefix"
        ? x.startsWith(s.a) && y === `${s.b}${x.slice(s.a.length)}`
        : x.endsWith(s.a) && y === `${x.slice(0, x.length - s.a.length)}${s.b}`,
    );
  return test(a, b) || test(b, a);
}

function hasPair(swaps: readonly PairSwap[], options: readonly string[]): boolean {
  return options.some((a, i) => options.slice(i + 1).some((b) => isPair(swaps, a, b)));
}

/** 문장에 단어가 (s/es/ed/ing 변형 포함) 토큰으로 들어 있는가. grows→grow, greets→greet. */
export function sentenceUsesText(sentence: string, text: string): boolean {
  const tokens = sentence.toLowerCase().match(/[a-z']+/g) ?? [];
  const w = text.toLowerCase();
  return tokens.some((t) => t === w || [`${w}s`, `${w}es`, `${w}ed`, `${w}ing`].includes(t));
}

/**
 * 유형 구성 규칙 (기획안 5-5): requiredQuizTypes 는 1개씩.
 * 장 안에 imageable 아이템이 하나도 없고 allowQuizTypeSubstitution 이면 picture_choice 자리를
 * fill_blank·listen_choice 로 대체할 수 있다 — 둘은 각각 1개 이상, 합은 (원래 개수 + 1).
 * required 에 없는 유형은 allowedQuizTypes 안에서 자유롭게 쓴다.
 */
function checkQuizComposition(at: string, quiz: Lesson["quiz"], hasImageableItem: boolean, rules: PackRules, errors: string[]) {
  if (quiz.length !== rules.quizPerLesson) errors.push(`${at}: 퀴즈는 정확히 ${rules.quizPerLesson}개 (현재 ${quiz.length})`);

  const count = (t: QuizType) => quiz.filter((q) => q.type === t).length;
  for (const t of new Set(quiz.map((q) => q.type)))
    if (!rules.allowedQuizTypes.includes(t)) errors.push(`${at}: ${t} 유형은 이 팩에서 허용되지 않는다 (허용: ${rules.allowedQuizTypes.join(", ")})`);

  const required = rules.requiredQuizTypes ?? [];
  const substitute = rules.allowQuizTypeSubstitution && !hasImageableItem && required.includes("picture_choice");

  if (!substitute) {
    for (const type of required) {
      const n = count(type);
      if (n !== 1) errors.push(`${at}: ${type} 유형은 정확히 1번 (현재 ${n})`);
    }
    return;
  }

  const targets = SUBSTITUTE_FOR_PICTURE.filter((t) => required.includes(t));
  for (const type of required) {
    if (type === "picture_choice" || targets.includes(type)) continue;
    const n = count(type);
    if (n !== 1) errors.push(`${at}: ${type} 유형은 정확히 1번 (현재 ${n})`);
  }
  const picture = count("picture_choice");
  if (picture !== 0) errors.push(`${at}: imageable 아이템이 없는 장은 picture_choice 를 낼 수 없다 (현재 ${picture})`);
  const counts = targets.map((t) => count(t));
  if (counts.some((n) => n < 1))
    errors.push(
      `${at}: picture_choice 없는 장은 ${targets.join("·")} 가 각각 1번 이상이어야 한다 (현재 ${targets.map((t, i) => `${t} ${counts[i]}`).join(", ")})`,
    );
  const sum = counts.reduce((a, b) => a + b, 0);
  if (sum !== targets.length + 1) errors.push(`${at}: ${targets.join(" + ")} 합이 ${targets.length + 1}이어야 한다 (현재 ${sum})`);
}

/** 원본(raw) 콘텐츠를 정규화해서 규칙을 검사한다. */
export function checkContent(raw: RawContent): string[] {
  const { content, errors } = normalizeContent(raw);
  if (!content) return errors;
  return checkNormalized(content);
}

/** 이미 정규화된 콘텐츠(빌드 결과)를 검사한다. 자동 생성된 퀴즈도 같은 규칙으로 걸러진다. */
export function checkNormalized(content: Content): string[] {
  const errors: string[] = [];
  const { pack, items, lessons } = content;
  const rules = pack.rules;

  const byId = new Map<string, Item>();
  const texts = new Set<string>();
  for (const it of items) {
    byId.set(it.id, it);
    // 문제(problem)는 같은 식이 다른 레슨에 또 나올 수 있다 (id 만 고유하면 된다)
    if (it.kind === "problem") continue;
    if (texts.has(it.text)) errors.push(`items.json: text 중복 ${it.text}`);
    texts.add(it.text);
  }

  // 장 구성
  const orders = lessons.map((l) => l.order).sort((a, b) => a - b);
  orders.forEach((d, i) => {
    if (d !== i + 1) errors.push(`order 는 1..${lessons.length} 연속이어야 한다 (현재 ${orders.join(",")})`);
  });
  const seenIds = new Set<string>();

  const referenced = new Set<string>();

  for (const lesson of lessons) {
    const at = lesson.id;
    const expectedId = `${pack.id}-${String(lesson.order).padStart(2, "0")}`;
    if (lesson.id !== expectedId) errors.push(`${at}: id 는 ${expectedId} 이어야 한다`);
    if (seenIds.has(lesson.id)) errors.push(`${at}: 레슨 id 중복`);
    seenIds.add(lesson.id);
    if (lesson.packId !== pack.id) errors.push(`${at}: packId ${lesson.packId} ≠ ${pack.id}`);

    // 아이템
    const lessonItems = new Set(lesson.itemIds);
    if (lesson.itemIds.length !== rules.itemsPerLesson)
      errors.push(`${at}: 아이템은 정확히 ${rules.itemsPerLesson}개 (현재 ${lesson.itemIds.length})`);
    if (lessonItems.size !== lesson.itemIds.length) errors.push(`${at}: itemIds 중복`);
    let hasImageableItem = false;
    for (const id of lesson.itemIds) {
      referenced.add(id);
      const it = byId.get(id);
      if (!it) errors.push(`${at}: items.json 에 없는 아이템 ${id}`);
      else if (it.imageable) hasImageableItem = true;
    }

    // 문장
    if (lesson.sentences.length !== rules.sentencesPerLesson)
      errors.push(`${at}: 문장은 정확히 ${rules.sentencesPerLesson}개 (현재 ${lesson.sentences.length})`);
    lesson.sentences.forEach((s, i) => {
      const where = `${at}.sentences[${i}]`;
      if (s.itemIds.length < rules.minItemsPerSentence)
        errors.push(`${where}: 이 장 아이템을 ${rules.minItemsPerSentence}개 이상 써야 한다 (현재 ${s.itemIds.length})`);
      if (new Set(s.itemIds).size !== s.itemIds.length) errors.push(`${where}: itemIds 중복`);
      for (const id of s.itemIds) {
        if (!lessonItems.has(id)) errors.push(`${where}: ${id} 는 이 장 아이템이 아니다`);
        const it = byId.get(id);
        if (it && it.kind === "word" && !sentenceUsesText(s.text, it.text))
          errors.push(`${where}: "${s.text}" 에 ${it.text} 가 없다`);
      }
    });

    // 연산 문제: 정답을 다시 계산해 맞춰 보고, 한 레슨 안에서 같은 식이 두 번 나오지 않는지 본다
    const seenExpr = new Set<string>();
    for (const id of lesson.itemIds) {
      const it = byId.get(id);
      if (!it || it.kind !== "problem") continue;
      const problem = verifyProblem(it);
      if (problem) errors.push(`${at}.${id}: ${problem}`);
      const key = it.text.replace(/\s+/g, "");
      if (seenExpr.has(key)) errors.push(`${at}: 같은 식 "${it.text}" 가 두 번 나온다`);
      seenExpr.add(key);
    }

    // 스텝
    if (lesson.steps.includes("practice") && lesson.itemIds.some((id) => byId.get(id) && byId.get(id)!.kind !== "problem"))
      errors.push(`${at}: practice 스텝은 problem 아이템으로만 쓸 수 있다`);

    // 퀴즈
    checkQuizComposition(at, lesson.quiz, hasImageableItem, rules, errors);
    lesson.quiz.forEach((q, i) => {
      const where = `${at}.quiz[${i}](${q.type})`;
      const target = byId.get(q.targetItemId);
      if (!lessonItems.has(q.targetItemId)) errors.push(`${where}: targetItemId ${q.targetItemId} 는 이 장 아이템이 아니다`);
      if (!target) return;

      if (q.type === "ox") {
        const rhs = meaningOf(target);
        const correct = `${target.text} = ${rhs}`;
        if (!q.statement.startsWith(`${target.text} = `))
          errors.push(`${where}: statement 는 "${target.text} = …" 형식이어야 한다`);
        else if (q.answer !== (q.statement === correct))
          errors.push(`${where}: answer ${q.answer} 가 statement "${q.statement}" 와 맞지 않는다 (뜻: ${rhs})`);
        return;
      }

      checkChoice(q, target, texts, where, errors);
      if (q.type === "picture_choice" && !target.imageable)
        errors.push(`${where}: ${target.text} 는 imageable: false 라 그림 문항 불가`);
      if (q.type === "meaning_choice" && q.prompt !== meaningChoicePrompt(target))
        errors.push(`${where}: prompt 는 ${meaningChoicePrompt(target)} 이어야 한다 (현재 ${q.prompt})`);
      if (q.type === "fill_blank" && q.sentence.split("____").length !== 2)
        errors.push(`${where}: sentence 에 ____ 는 정확히 1개`);
    });

    for (const rule of rules.minimalPairs ?? []) {
      if (rule.lessonId !== lesson.id) continue;
      const n = lesson.quiz.filter((q) => q.type !== "ox" && hasPair(rule.swaps, q.options)).length;
      const label = rule.label ?? rule.swaps.map((s) => `${s.a}-${s.b}`).join("/");
      if (n < rule.minQuizzes) errors.push(`${at}: ${label} 짝 보기 문항이 ${rule.minQuizzes}개 이상이어야 한다 (현재 ${n})`);
    }
  }
  for (const rule of rules.minimalPairs ?? [])
    if (!lessons.some((l) => l.id === rule.lessonId)) errors.push(`pack.json: minimalPairs 의 레슨 ${rule.lessonId} 가 없다`);

  // items.json 아이템 수 = 레슨들이 참조하는 고유 아이템 수
  if (items.length !== referenced.size)
    errors.push(`items.json 아이템 수 ${items.length} ≠ 레슨이 참조하는 고유 아이템 수 ${referenced.size}`);
  for (const it of items) if (!referenced.has(it.id)) errors.push(`items.json: ${it.id} 는 어느 레슨에서도 쓰이지 않는다`);

  return errors;
}

function checkChoice(q: ChoiceQuiz, target: Item, texts: Set<string>, where: string, errors: string[]) {
  if (new Set(q.options).size !== q.options.length) errors.push(`${where}: 보기 중복 ${q.options.join("/")}`);
  if (!q.options.includes(q.answer)) errors.push(`${where}: answer "${q.answer}" 가 보기에 없다`);
  if (q.answer !== quizAnswerOf(target)) errors.push(`${where}: answer "${q.answer}" ≠ 대상 아이템 "${quizAnswerOf(target)}"`);
  for (const o of q.options) {
    if (target.kind === "problem") {
      if (!/^-?\d+$/.test(o)) errors.push(`${where}: 보기 "${o}" 는 숫자여야 한다`);
    } else if (!texts.has(o)) {
      errors.push(`${where}: 보기 "${o}" 가 items.json 에 없다`);
    }
  }
}
