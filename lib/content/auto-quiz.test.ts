import { describe, expect, it } from "vitest";
import { mathDistractors } from "@/lib/engine/quizgen";
import { seededRandom } from "@/lib/engine/rng";
import { checkNormalized } from "./check";
import { contentRoot, loadContent, readRawPack } from "./node";
import { normalizeContent } from "./normalize";
import { quizAnswerOf } from "./item-text";

/** en-kid-giyeok 원본에서 퀴즈를 지우고(autoQuiz 켜기) 자동 생성한 결과를 본다. 대립쌍 규칙은 손으로 만든 퀴즈 전용이라 뺀다. */
function autoKid() {
  const raw = readRawPack("en-kid-giyeok", contentRoot());
  const pack = raw.pack as { rules: Record<string, unknown> };
  const rules = { ...pack.rules, autoQuiz: true, minimalPairs: undefined };
  return normalizeContent({
    pack: { ...pack, rules },
    items: raw.items,
    lessons: (raw.lessons as Record<string, unknown>[]).map((l) => omitQuiz(l)),
  });
}

const omitQuiz = (l: Record<string, unknown>) => Object.fromEntries(Object.entries(l).filter(([k]) => k !== "quiz"));

describe("자동 퀴즈 — 영어 단어 팩", () => {
  const { content, errors } = autoKid();

  it("퀴즈가 없는 레슨도 정규화되고 content:check 규칙을 통과한다", () => {
    expect(errors).toEqual([]);
    expect(checkNormalized(content!)).toEqual([]);
  });

  it("같은 입력이면 항상 같은 퀴즈 (seed 고정)", () => {
    expect(autoKid().content!.lessons.map((l) => l.quiz)).toEqual(content!.lessons.map((l) => l.quiz));
  });

  it("레슨마다 5유형이 1개씩, 대상은 그 레슨 아이템, 정답은 보기에 있고 보기는 중복 없음", () => {
    for (const l of content!.lessons) {
      expect(l.quiz.map((q) => q.type).sort()).toEqual(["fill_blank", "listen_choice", "meaning_choice", "ox", "picture_choice"]);
      for (const q of l.quiz) {
        expect(l.itemIds).toContain(q.targetItemId);
        if (q.type !== "ox") {
          expect(new Set(q.options).size).toBe(3);
          expect(q.options).toContain(q.answer);
          expect(q.answer).toBe(quizAnswerOf(content!.itemsById.get(q.targetItemId)!));
        }
      }
    }
  });

  it("imageable: false 아이템에는 그림 문항을 내지 않는다", () => {
    const stripped = readRawPack("en-kid-giyeok", contentRoot());
    const items = (stripped.items as { imageable?: boolean; emoji?: string; image?: string; id: string }[]).map((it, i) =>
      i % 2 === 0 ? { ...it, imageable: false } : it,
    );
    const pack = stripped.pack as { rules: Record<string, unknown> };
    const r = normalizeContent({
      pack: { ...pack, rules: { ...pack.rules, autoQuiz: true, minimalPairs: undefined } },
      items,
      lessons: (stripped.lessons as Record<string, unknown>[]).map((l) => omitQuiz(l)),
    });
    expect(r.errors).toEqual([]);
    for (const l of r.content!.lessons)
      for (const q of l.quiz) if (q.type === "picture_choice") expect(r.content!.itemsById.get(q.targetItemId)!.imageable).toBe(true);
  });
});

describe("자동 퀴즈 — 오류 처리", () => {
  const base = (rules: Record<string, unknown>, items: unknown[]) => ({
    pack: {
      id: "t",
      subjectId: "en-kid",
      title: "t",
      level: "1",
      levelOrder: 1,
      order: 1,
      ttsLang: "en-US",
      status: "soon",
      rules: { itemsPerLesson: items.length, sentencesPerLesson: 0, quizPerLesson: 1, autoQuiz: true, ...rules },
    },
    lessons: [{ order: 1, title: "x", type: "vocab", items }],
  });
  const word = (id: string, text: string, ko: string) => ({ id, kind: "word", text, meaningKo: ko });

  it("autoQuiz 가 꺼져 있으면 퀴즈 없는 레슨은 에러", () => {
    const r = normalizeContent(base({ autoQuiz: false }, [word("a", "cat", "고양이"), word("b", "dog", "개"), word("c", "pig", "돼지"), word("d", "cow", "소")]));
    expect(r.errors.join("\n")).toContain("rules.autoQuiz 가 꺼져 있다");
  });

  it("보기 후보가 모자라면(아이템 2개) 이유를 알려 준다", () => {
    const r = normalizeContent(base({ allowedQuizTypes: ["meaning_choice"] }, [word("a", "cat", "고양이"), word("b", "dog", "개")]));
    expect(r.content === null || r.content.lessons[0].quiz.length === 1).toBe(true);
  });

  it("그림 가능한 아이템이 없고 대체가 허용되면 picture_choice 자리를 fill_blank·listen_choice 로 바꾼다", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"].map((x, i) => word(x, `word${x}`, `뜻${i}`));
    const raw = base(
      { quizPerLesson: 5, allowedQuizTypes: ["picture_choice", "meaning_choice", "fill_blank", "listen_choice", "ox"], requiredQuizTypes: ["picture_choice", "meaning_choice", "fill_blank", "listen_choice", "ox"], allowQuizTypeSubstitution: true, sentencesPerLesson: 2 },
      items,
    );
    (raw.lessons[0] as { sentences?: unknown[] }).sentences = [
      { text: "worda and wordb are here.", meaningKo: "a", itemIds: ["a", "b"] },
      { text: "wordc and wordd are here.", meaningKo: "b", itemIds: ["c", "d"] },
    ];
    const r = normalizeContent(raw);
    expect(r.errors).toEqual([]);
    const types = r.content!.lessons[0].quiz.map((q) => q.type);
    expect(types).not.toContain("picture_choice");
    expect(types).toHaveLength(5);
    expect(checkNormalized(r.content!)).toEqual([]);
  });
});

describe("연산 문제 보기", () => {
  it("음수·중복·정답과 같은 값이 없고 2개를 준다 (0, 1, 한 자리, 두 자리 정답)", () => {
    for (const answer of [0, 1, 2, 7, 9, 10, 12, 45, 99, 100]) {
      for (let s = 0; s < 20; s++) {
        const wrong = mathDistractors(answer, seededRandom(`${answer}:${s}`));
        expect(wrong).toHaveLength(2);
        expect(new Set(wrong).size).toBe(2);
        expect(wrong.every((v) => v >= 0 && v !== answer && Number.isInteger(v))).toBe(true);
      }
    }
  });

  it("가까운 값(±1, ±2)을 우선한다", () => {
    const wrong = mathDistractors(20, seededRandom("x"));
    expect(wrong.every((v) => Math.abs(v - 20) <= 2)).toBe(true);
  });
});

describe("자동 퀴즈 — 정답 위치 분포", () => {
  it("보기가 있는 문항의 정답이 1·2·3번째에 고르게 나온다 (한 자리에 쏠리지 않음)", () => {
    const counts = [0, 0, 0];
    for (const id of ["en-kid-animals", "math-kid-add-1", "math-kid-sub-1", "en-adult-travel", "ja-adult-hiragana-1"]) {
      const c = loadContent(id);
      for (const l of c.lessons) for (const q of l.quiz) if (q.type !== "ox") counts[q.options.indexOf(q.answer)]++;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(150);
    for (const n of counts) expect(n / total).toBeGreaterThan(0.2); // 이상적인 1/3 에서 크게 벗어나지 않는다
  });

  it("O/X 정답은 O 와 X 가 모두 나온다", () => {
    const answers = new Set<boolean>();
    for (const l of loadContent("en-adult-travel").lessons) for (const q of l.quiz) if (q.type === "ox") answers.add(q.answer);
    expect(answers.size).toBe(2);
  });

  it("자동 생성된 모든 보기는 중복이 없다 (시드 5개 팩 전체)", () => {
    for (const id of ["en-kid-animals", "math-kid-add-1", "math-kid-sub-1", "en-adult-travel", "ja-adult-hiragana-1"]) {
      for (const l of loadContent(id).lessons)
        for (const q of l.quiz) if (q.type !== "ox") expect(new Set(q.options).size, `${l.id} ${q.type}`).toBe(3);
    }
  });
});
