import { describe, expect, it } from "vitest";
import { loadContent } from "@/lib/content/node";
import { recordSheetComplete } from "./progress";
import { activeItems, dueItems } from "./queue";
import { buildLessonQuiz, buildReviewQuiz } from "./quizgen";
import { decideToday } from "./today";
import { createInitialState } from "@/lib/store/types";

/** 수학 팩에서 틀린 문제가 오답 큐에 들어가고 → 다음 날 복습에 나오는 흐름 (연산 문제는 id 가 레슨마다 달라 큐에서 구분된다). */
describe("수학 팩 오답 흐름", () => {
  const math = loadContent("math-kid-add-1");
  const first = math.lessons[0];
  const wrongId = first.quiz[0].targetItemId;

  const afterLesson = () =>
    recordSheetComplete(createInitialState("math-kid-add-1"), {
      attemptId: "a1",
      packId: math.pack.id,
      subjectId: math.pack.subjectId,
      dateKey: "2026-10-12",
      kind: "lesson",
      lessonId: first.id,
      itemIds: first.itemIds,
      answers: first.quiz.map((q) => ({ targetItemId: q.targetItemId, correct: q.targetItemId !== wrongId })),
      startedAt: "2026-10-12T00:00:00.000Z",
      finishedAt: "2026-10-12T00:08:00.000Z",
    });

  it("틀린 문제가 오답 큐에 들어가고 다음 날부터 복습 대상이 된다", () => {
    const s = afterLesson();
    expect(activeItems(s.wrongQueue, math.pack.id, s.activeProfileId).map((w) => w.itemId)).toEqual([wrongId]);
    expect(dueItems(s.wrongQueue, "2026-10-12", math.pack.id, s.activeProfileId)).toHaveLength(0);
    expect(dueItems(s.wrongQueue, "2026-10-13", math.pack.id, s.activeProfileId).map((w) => w.itemId)).toEqual([wrongId]);
  });

  it("다음 날 장에는 틀렸던 문제가 5번 문항으로 다시 나온다 (숫자 보기 3개, 정답 포함)", () => {
    const s = afterLesson();
    const decision = decideToday(s, "2026-10-13", math);
    expect(decision).toEqual({ kind: "lesson", lessonId: math.lessons[1].id, injectedItemId: wrongId });
    const quiz = buildLessonQuiz(math.lessons[1], math, "2026-10-13", wrongId);
    const injected = quiz[quiz.length - 1];
    expect(injected.targetItemId).toBe(wrongId);
    expect(injected.type).toBe("fill_blank");
    if (injected.type !== "fill_blank") return;
    expect(injected.options).toHaveLength(3);
    expect(injected.options.every((o) => /^\d+$/.test(o))).toBe(true);
    expect(injected.options).toContain(injected.answer);
    expect(injected.sentence).toBe(`${math.itemsById.get(wrongId)!.text} = ____`);
  });

  it("복습장도 연산 문제로 만들어진다", () => {
    const quiz = buildReviewQuiz(first.itemIds.slice(0, 5), math, "2026-10-17");
    expect(quiz).toHaveLength(5);
    expect(quiz.every((q) => q.type === "fill_blank" && q.options.every((o) => /^\d+$/.test(o)))).toBe(true);
  });
});
