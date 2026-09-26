import { describe, expect, it } from "vitest";
import { todayKey } from "./date";
import { buildLessonQuiz } from "./quizgen";
import { setReviewEnabled } from "./queue";
import { buildReviewWordIds, decideSheet, decideToday, pickReviewSentences } from "./today";
import {
  content,
  doLesson,
  doReview,
  freshState,
  FRI,
  lessonId,
  MON,
  NEXT_MON,
  SAT,
  SUN,
  THU,
  TUE,
  WED,
} from "./__fixtures__/state";

const L1_WORDS = content.lessons[0].wordIds;

describe("6-5 필수 테스트", () => {
  it("평일 첫날 → L1", () => {
    expect(decideToday(freshState(), MON, content)).toEqual({ kind: "lesson", lessonId: lessonId(1) });
  });

  it("L1 완료 후 같은 날 → doneToday, canDoExtra: false", () => {
    const s = doLesson(freshState(), lessonId(1), MON);
    expect(decideToday(s, MON, content)).toEqual({ kind: "doneToday", canDoExtra: false });
  });

  it("전날(평일) 미완료 → 오늘 2장째 허용, 3장째 dailyLimit", () => {
    let s = doLesson(freshState(), lessonId(1), MON);
    // 화요일은 건너뜀
    s = doLesson(s, lessonId(2), WED);
    expect(decideToday(s, WED, content)).toEqual({ kind: "doneToday", canDoExtra: true });
    expect(decideSheet(s, WED, content)).toEqual({ kind: "lesson", lessonId: lessonId(3) });
    s = doLesson(s, lessonId(3), WED);
    expect(decideToday(s, WED, content)).toEqual({ kind: "dailyLimit" });
  });

  it("토요일, 오답 1개 → 복습장 (오답 먼저, 이번 주 단어로 채움)", () => {
    let s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow"] });
    s = doLesson(s, lessonId(2), TUE);
    const d = decideToday(s, SAT, content);
    expect(d.kind).toBe("review");
    if (d.kind !== "review") return;
    expect(d.wordIds[0]).toBe("g-grow");
    expect(d.wordIds).toHaveLength(8);
    expect(new Set(d.wordIds).size).toBe(8);
    // 채운 단어는 이번 주에 배운 L1 → L2 순
    expect(d.wordIds.slice(1)).toEqual(L1_WORDS.filter((id) => id !== "g-grow"));
  });

  it("오답 3개 → 평일에도 복습장", () => {
    const s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grass", "g-grow", "g-grape"] });
    const d = decideToday(s, TUE, content);
    expect(d.kind).toBe("review");
    if (d.kind !== "review") return;
    expect(d.wordIds.slice(0, 3).sort()).toEqual(["g-grape", "g-grass", "g-grow"]);
  });

  it("오답 1개 → 다음 장 5번 문항이 그 단어로 교체", () => {
    const s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow"] });
    const d = decideToday(s, TUE, content);
    expect(d).toEqual({ kind: "lesson", lessonId: lessonId(2), injectedWordId: "g-grow" });

    const lesson = content.lessons[1];
    const quiz = buildLessonQuiz(lesson, content, TUE, "g-grow");
    expect(quiz).toHaveLength(5);
    expect(quiz.slice(0, 4)).toEqual(lesson.quiz.slice(0, 4));
    expect(quiz[4].targetWordId).toBe("g-grow");
    expect(["meaning_choice", "listen_choice"]).toContain(quiz[4].type);
  });

  it("같은 날 틀리고 맞힌 단어는 졸업하지 않는다", () => {
    let s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow"] });
    // 같은 날 두 번째 시도에서 맞힘
    s = doReview(s, MON, [{ targetWordId: "g-grow", correct: true }]);
    expect(s.wrongQueue.find((i) => i.wordId === "g-grow")?.active).toBe(true);
    // 다른 날 맞히면 졸업
    s = doReview(s, TUE, [{ targetWordId: "g-grow", correct: true }]);
    expect(s.wrongQueue.find((i) => i.wordId === "g-grow")?.active).toBe(false);
  });

  it("8장 완료 + 오답 0 → packComplete", () => {
    let s = freshState();
    const days = [MON, TUE, WED, THU, FRI, NEXT_MON, "2026-09-29", "2026-09-30"];
    days.forEach((d, i) => (s = doLesson(s, lessonId(i + 1), d)));
    expect(decideToday(s, "2026-10-01", content)).toEqual({ kind: "packComplete" });
  });

  it("월요일 00:30 KST 는 월요일로 판정 → 주말 복습이 아니라 장", () => {
    const now = new Date("2026-09-27T15:30:00Z"); // 월 00:30 KST, UTC 로는 일요일
    let s = doLesson(freshState(), lessonId(1), FRI, { wrong: ["g-grow"] });
    s = doReview(s, SAT, [{ targetWordId: "g-grass", correct: true }]);
    expect(decideToday(s, todayKey(now), content)).toEqual({
      kind: "lesson",
      lessonId: lessonId(2),
      injectedWordId: "g-grow",
    });
  });
});

describe("경계 케이스 (설계 요약 4장 승인안)", () => {
  it("8장 완료 + 활성 오답 → 복습이 먼저", () => {
    let s = freshState();
    const days = [MON, TUE, WED, THU, FRI, NEXT_MON, "2026-09-29", "2026-09-30"];
    days.forEach((d, i) => (s = doLesson(s, lessonId(i + 1), d, i === 7 ? { wrong: ["g-frog"] } : {})));
    const d = decideToday(s, "2026-10-01", content);
    expect(d.kind).toBe("review");
    if (d.kind === "review") expect(d.wordIds[0]).toBe("g-frog");
  });

  it("첫 실행이 토요일이라 배운 것이 없으면 L1", () => {
    expect(decideToday(freshState(), SAT, content)).toEqual({ kind: "lesson", lessonId: lessonId(1) });
  });

  it("중간 이탈한 장은 다시 처음부터 같은 장", () => {
    const s = doLesson(freshState(), lessonId(1), MON, { completed: false });
    expect(decideToday(s, MON, content)).toEqual({ kind: "lesson", lessonId: lessonId(1) });
  });

  it("중간 이탈만 있어도 첫 사용일로 친다 (다음 날 밀린 날 판정)", () => {
    let s = doLesson(freshState(), lessonId(1), MON, { completed: false });
    s = doLesson(s, lessonId(1), TUE);
    expect(decideToday(s, TUE, content)).toEqual({ kind: "doneToday", canDoExtra: true });
  });

  it("월요일에 완료, 지난 금요일을 밀렸으면 한 장 더", () => {
    let s = doLesson(freshState(), lessonId(1), THU);
    s = doLesson(s, lessonId(2), NEXT_MON);
    expect(decideToday(s, NEXT_MON, content)).toEqual({ kind: "doneToday", canDoExtra: true });
  });

  it("복습장 완료도 그날의 한 장으로 인정", () => {
    let s = doLesson(freshState(), lessonId(1), FRI);
    s = doReview(s, SAT, [{ targetWordId: "g-grass", correct: true }]);
    expect(decideToday(s, SAT, content)).toEqual({ kind: "doneToday", canDoExtra: false });
  });

  it("오늘 틀린 단어는 같은 날 한 장 더 할 때 삽입하지 않는다 (nextReviewDate 는 내일)", () => {
    let s = doLesson(freshState(), lessonId(1), MON);
    s = doLesson(s, lessonId(2), WED, { wrong: ["g-gift"] });
    expect(decideSheet(s, WED, content)).toEqual({ kind: "lesson", lessonId: lessonId(3) });
  });

  it("오답 5개 이상이면 이번 주 단어로 채우지 않는다", () => {
    const wrong = L1_WORDS.slice(0, 5);
    const s = doLesson(freshState(), lessonId(1), MON, { wrong });
    expect(buildReviewWordIds(s, SUN, content).sort()).toEqual([...wrong].sort());
  });

  it("부모가 OFF 한 단어는 다음 날 복습에서 빠진다", () => {
    let s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow", "g-grass", "g-grape"] });
    s = { ...s, wrongQueue: setReviewEnabled(s.wrongQueue, "g-grow", false) };
    // 활성 오답 2개 → 평일 복습 문턱(3) 미만이라 다음 장 + 오래된 오답 삽입
    const d = decideToday(s, TUE, content);
    expect(d.kind).toBe("lesson");
    if (d.kind === "lesson") expect(d.injectedWordId).not.toBe("g-grow");
    expect(buildReviewWordIds(s, SAT, content)).not.toContain("g-grow");
  });

  it("졸업한 단어도 복습장 채우기에서 빠진다", () => {
    let s = doLesson(freshState(), lessonId(1), MON, { wrong: ["g-grow"] });
    s = doReview(s, TUE, [{ targetWordId: "g-grow", correct: true }]);
    expect(buildReviewWordIds(s, SAT, content)).not.toContain("g-grow");
  });

  it("복습장 예문은 복습 단어가 많이 든 문장 순", () => {
    const sentences = pickReviewSentences(["g-grandma", "g-grow", "g-grape"], content);
    expect(sentences.map((x) => x.en)).toEqual(["Grandma grows grapes."]);
    const two = pickReviewSentences(["g-grandma", "g-grow", "g-grass", "g-green"], content);
    // 동점(2개씩)이면 팩 순서
    expect(two.map((x) => x.en)).toEqual(["The grass is green.", "Grandma grows grapes."]);
  });
});
