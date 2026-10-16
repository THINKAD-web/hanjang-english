import { describe, expect, it } from "vitest";
import { buildLessonQuiz, buildReviewQuiz, shuffleSheetOptions } from "@/lib/engine/quizgen";
import { loadContent } from "./node";
import golden from "./__golden__/en-kid-giyeok.json";

/**
 * 골든 회귀: 대량 개발 리팩터링(스키마·폴더·로더 교체) 전의 en-kid-giyeok 결과와 지금 결과가 같아야 한다.
 * 스냅샷(JSON)은 리팩터링 직전 코드로 만든 것이라 이 테스트에서 고치지 않는다.
 * 필드 이름이 바뀌는 커밋은 아래 view() 의 매핑만 바꾼다 (focus → intro, dayNo → order 등).
 */

const content = loadContent("en-kid-giyeok");
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function viewLesson(l: (typeof content.lessons)[number]) {
  return {
    id: l.id,
    packId: l.packId,
    dayNo: l.order,
    title: l.title,
    // intro {title, content} ↔ 예전 focus {label, lines[2]}
    focus: l.intro ? { label: l.intro.title, lines: l.intro.content.split("\n") } : undefined,
    itemIds: l.itemIds,
    sentences: l.sentences,
    quiz: l.quiz,
    reviewed: l.reviewed,
  };
}

describe("en-kid-giyeok 골든 (리팩터링 전 결과와 동일)", () => {
  it("팩 메타 (안정 필드)", () => {
    const p = content.pack;
    expect(plain({ id: p.id, title: p.title, brandLabel: p.brandLabel, unitKey: p.unitKey, unitLabel: p.unitLabel, lessonCount: p.lessonCount, status: p.status })).toEqual(
      golden.pack,
    );
  });

  it("아이템 52개 전부 동일", () => {
    expect(plain(content.items)).toEqual(golden.items);
  });

  it("레슨 8장의 intro·아이템·문장·퀴즈가 의미상 동일", () => {
    expect(plain(content.lessons.map(viewLesson))).toEqual(golden.lessons);
  });

  it("같은 날짜의 퀴즈 보기 순서(seed 셔플)가 동일", () => {
    for (const [date, byLesson] of Object.entries(golden.shuffled)) {
      for (const l of content.lessons) {
        expect(plain(shuffleSheetOptions(buildLessonQuiz(l, content, date), date, l.id)), `${date} ${l.id}`).toEqual(
          (byLesson as Record<string, unknown>)[l.id],
        );
      }
    }
  });

  it("오답 삽입 문항(5번)이 동일", () => {
    const l2 = content.lessons[1];
    for (const [itemId, expected] of Object.entries(golden.injected)) {
      expect(plain(shuffleSheetOptions(buildLessonQuiz(l2, content, "2026-10-06", itemId), "2026-10-06", l2.id)), itemId).toEqual(expected);
    }
  });

  it("복습장 5문항이 동일", () => {
    for (const { date, quiz } of golden.review.quiz) {
      expect(plain(shuffleSheetOptions(buildReviewQuiz(golden.review.itemIds, content, date), date, "review")), date).toEqual(quiz);
    }
  });
});
