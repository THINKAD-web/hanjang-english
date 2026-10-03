import { describe, expect, it } from "vitest";
import { weekStamps } from "@/lib/engine/progress";
import { content, doLesson, doReview, freshState, lessonId, MON, packId, SUN, TUE, WED } from "@/lib/engine/__fixtures__/state";
import { toggleWrongReview } from "./account";
import { attemptLabel, currentWrong, listedWrongIds, todaySummary, trickyTags, weekSummary, wrongWordById } from "./summary";

describe("오늘 요약", () => {
  it("푼 게 없으면 done=false", () => {
    expect(todaySummary(freshState(), content, MON)).toEqual({ done: false, attempts: [], wrong: [] });
  });

  it("장 완료: 점수와 오늘 틀린 단어(철자+뜻)", () => {
    const s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow"] });
    const t = todaySummary(s, content, MON);
    expect(t.done).toBe(true);
    expect(t.attempts).toEqual([{ kind: "lesson", total: 5, correct: 4 }]);
    expect(attemptLabel(t.attempts[0])).toBe("5문제 중 4개 맞았어요");
    expect(t.wrong).toEqual([{ itemId: "g-grow", text: "grow", meaningKo: "자라다", reviewOn: true }]);
  });

  it("다른 날 기록은 오늘 요약에 섞이지 않는다", () => {
    const s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow"] });
    expect(todaySummary(s, content, TUE).done).toBe(false);
  });

  it("복습장은 '복습 N문제 중 M개'", () => {
    const s = doReview(freshState(), TUE, [
      { targetItemId: "g-grow", correct: false },
      { targetItemId: "g-grass", correct: true },
      { targetItemId: "g-grape", correct: true },
      { targetItemId: "g-green", correct: true },
    ]);
    const t = todaySummary(s, content, TUE);
    expect(t.attempts).toEqual([{ kind: "review", total: 4, correct: 3 }]);
    expect(attemptLabel(t.attempts[0])).toBe("복습 4문제 중 3개");
  });

  it("같은 날 두 장이면 장마다 한 줄, 틀린 단어는 중복 없이", () => {
    let s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow"] });
    s = doReview(s, MON, [
      { targetItemId: "g-grow", correct: false },
      { targetItemId: "g-grass", correct: false },
    ]);
    const t = todaySummary(s, content, MON);
    expect(t.attempts).toHaveLength(2);
    expect(t.wrong.map((w) => w.itemId)).toEqual(["g-grow", "g-grass"]);
  });

  it("토글을 끈 단어도 오늘 목록에는 남고(다시 켜기 위해) reviewOn=false", () => {
    let s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow"] });
    s = toggleWrongReview(s, packId, "g-grow", false, MON);
    expect(todaySummary(s, content, MON).wrong[0]).toMatchObject({ itemId: "g-grow", reviewOn: false });
    expect(currentWrong(s, content)).toEqual([]);
  });
});

describe("현재 오답", () => {
  it("활성 오답만, 오래된 순", () => {
    let s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow", "g-grass"] });
    s = doReview(s, TUE, [{ targetItemId: "g-grape", correct: false }]);
    expect(currentWrong(s, content).map((w) => w.text)).toEqual(["grass", "grow", "grape"]);
  });
});

describe("현재 오답 목록: 끈 단어도 되돌릴 수 있게 남긴다", () => {
  it("pinned 가 없으면 활성 오답 그대로", () => {
    expect(listedWrongIds(["a", "b"], [])).toEqual(["a", "b"]);
  });

  it("끈 단어는 원래 자리에 남고, 새로 활성이 된 id 는 뒤에 붙는다", () => {
    // 처음 [a,b,c] 를 보여주고 b 를 끔 → 활성은 [a,c], pinned 는 [a,b,c]
    expect(listedWrongIds(["a", "c"], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(listedWrongIds(["a", "c", "d"], ["a", "b", "c"])).toEqual(["a", "b", "c", "d"]);
  });

  it("전부 꺼도 목록은 남는다 (활성 개수와는 별개)", () => {
    expect(listedWrongIds([], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("끈 단어는 wrongWordById 로 reviewOn=false 로 조회되고, 다시 켜면 true", () => {
    let s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow"] });
    s = toggleWrongReview(s, packId, "g-grow", false, MON);
    expect(wrongWordById(s, content, "g-grow")).toMatchObject({ text: "grow", reviewOn: false });
    s = toggleWrongReview(s, packId, "g-grow", true, MON);
    expect(wrongWordById(s, content, "g-grow")).toMatchObject({ reviewOn: true });
    expect(wrongWordById(s, content, "nope")).toBeNull();
  });
});

describe("이번 주", () => {
  it("칸은 홈 도장과 같은 함수 결과, 완료 장 수는 이번 주 완료 Attempt 수", () => {
    let s = doLesson(freshState(), lessonId(1), MON, {});
    s = doLesson(s, lessonId(2), TUE, {});
    s = doLesson(s, lessonId(3), "2026-09-14", {}); // 지난주
    const w = weekSummary(s, content, WED);
    expect(w.stamps).toEqual(weekStamps(s, WED, packId));
    expect(w.stamps.map((c) => c.stamped)).toEqual([true, true, false, false, false, false, false]);
    expect(w.doneCount).toBe(2);
  });

  it("완료하지 않은 시도는 세지 않는다", () => {
    const s = doLesson(freshState(), lessonId(1), MON, { completed: false });
    expect(weekSummary(s, content, MON).doneCount).toBe(0);
  });
});

describe("가장 많이 틀린 소리", () => {
  it("오답이 없으면 빈 배열(줄을 숨긴다)", () => {
    expect(trickyTags(doLesson(freshState(), lessonId(1), MON, {}), content, MON)).toEqual([]);
  });

  it("틀린 답의 tags 를 세어 많은 순 상위 2개", () => {
    const s = doReview(freshState(), MON, [
      { targetItemId: "g-grow", correct: false },
      { targetItemId: "g-grass", correct: false },
      { targetItemId: "g-glass", correct: false },
      { targetItemId: "g-goat", correct: false },
      { targetItemId: "g-grape", correct: true },
    ]);
    // gr 2, gl 1, g 1 → 동률(gl, g)은 태그 오름차순이라 g 가 먼저
    expect(trickyTags(s, content, MON)).toEqual(["gr", "g"]);
  });

  it("입력 순서가 달라도 결과가 같다 (정렬 규칙 고정)", () => {
    const a = doReview(freshState(), MON, [
      { targetItemId: "g-glass", correct: false },
      { targetItemId: "g-goat", correct: false },
    ]);
    const b = doReview(freshState(), MON, [
      { targetItemId: "g-goat", correct: false },
      { targetItemId: "g-glass", correct: false },
    ]);
    expect(trickyTags(a, content, MON)).toEqual(["g", "gl"]);
    expect(trickyTags(b, content, MON)).toEqual(["g", "gl"]);
  });

  it("지난주 오답은 이번 주 집계에 넣지 않는다", () => {
    const s = doReview(freshState(), "2026-09-14", [{ targetItemId: "g-grow", correct: false }]);
    expect(trickyTags(s, content, SUN)).toEqual([]);
  });
});
