import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE_ID, type Attempt, type WrongItem } from "@/lib/store/types";
import { activeItems, applyAttempt, dueItems, setReviewEnabled } from "./queue";

const PACK = "en-kid-giyeok";

function attempt(dateKey: string, answers: [string, boolean][], completed = true): Attempt {
  return {
    id: "x",
    profileId: DEFAULT_PROFILE_ID,
    packId: PACK,
    dateKey,
    kind: "review",
    itemIds: answers.map(([id]) => id),
    answers: answers.map(([targetItemId, correct]) => ({ targetItemId, correct })),
    score: answers.filter(([, c]) => c).length,
    startedAt: "",
    completed,
  };
}

describe("applyAttempt", () => {
  it("새로 틀린 아이템을 추가한다 (다음 날 복습)", () => {
    expect(applyAttempt([], attempt("2026-09-25", [["g-grow", false]]))).toEqual([
      {
        profileId: DEFAULT_PROFILE_ID,
        packId: PACK,
        itemId: "g-grow",
        wrongCount: 1,
        firstWrongDate: "2026-09-25",
        lastWrongDate: "2026-09-25",
        nextReviewDate: "2026-09-26",
        active: true,
      },
    ]);
  });

  it("다시 틀리면 wrongCount+1, 졸업했던 아이템도 재활성", () => {
    let q = applyAttempt([], attempt("2026-09-21", [["g-grow", false]]));
    q = applyAttempt(q, attempt("2026-09-22", [["g-grow", true]]));
    expect(q[0].active).toBe(false);
    q = applyAttempt(q, attempt("2026-09-24", [["g-grow", false]]));
    expect(q[0]).toMatchObject({ wrongCount: 2, firstWrongDate: "2026-09-21", lastWrongDate: "2026-09-24", nextReviewDate: "2026-09-25", active: true });
  });

  it("한 시도에서 같은 아이템을 틀리고 맞히면 틀린 쪽 우선", () => {
    let q = applyAttempt([], attempt("2026-09-21", [["g-grow", false]]));
    q = applyAttempt(q, attempt("2026-09-22", [["g-grow", true], ["g-grow", false]]));
    expect(q[0]).toMatchObject({ wrongCount: 2, active: true });
  });

  it("완료되지 않은 시도는 반영하지 않는다", () => {
    expect(applyAttempt([], attempt("2026-09-21", [["g-grow", false]], false))).toEqual([]);
  });

  it("큐에 없는 아이템을 맞힌 것은 아무 영향 없음", () => {
    expect(applyAttempt([], attempt("2026-09-21", [["g-grow", true]]))).toEqual([]);
  });

  it("다른 팩의 같은 itemId 는 섞이지 않는다", () => {
    const other = { ...attempt("2026-09-21", [["g-grow", false]]), packId: "ja-kid-hiragana" };
    let q = applyAttempt([], attempt("2026-09-21", [["g-grow", false]]));
    q = applyAttempt(q, other);
    expect(q).toHaveLength(2);
    expect(new Set(q.map((i) => i.packId))).toEqual(new Set([PACK, "ja-kid-hiragana"]));
  });
});

describe("조회", () => {
  const item = (over: Partial<WrongItem>): WrongItem => ({
    profileId: DEFAULT_PROFILE_ID,
    packId: PACK,
    itemId: "x",
    wrongCount: 1,
    firstWrongDate: "2026-09-21",
    lastWrongDate: "2026-09-21",
    nextReviewDate: "2026-09-22",
    active: true,
    ...over,
  });
  const q = [
    item({ itemId: "b", firstWrongDate: "2026-09-22", lastWrongDate: "2026-09-22", nextReviewDate: "2026-09-23" }),
    item({ itemId: "a" }),
    item({ itemId: "c", active: false }),
  ];

  it("activeItems 는 오래된 순", () => {
    expect(activeItems(q, PACK).map((i) => i.itemId)).toEqual(["a", "b"]);
  });

  it("dueItems 는 nextReviewDate ≤ 오늘", () => {
    expect(dueItems(q, "2026-09-22", PACK).map((i) => i.itemId)).toEqual(["a"]);
    expect(dueItems(q, "2026-09-23", PACK).map((i) => i.itemId)).toEqual(["a", "b"]);
  });

  it("setReviewEnabled OFF/ON", () => {
    expect(setReviewEnabled(q, PACK, "a", false).find((i) => i.itemId === "a")?.active).toBe(false);
    expect(setReviewEnabled(q, PACK, "c", true).find((i) => i.itemId === "c")?.active).toBe(true);
  });

  it("setReviewEnabled ON + today → nextReviewDate 가 다음 날, OFF 는 날짜를 건드리지 않는다", () => {
    const on = setReviewEnabled(q, PACK, "c", true, "2026-09-25").find((i) => i.itemId === "c")!;
    expect(on.active).toBe(true);
    expect(on.nextReviewDate).toBe("2026-09-26");
    const before = q.find((i) => i.itemId === "a")!;
    const off = setReviewEnabled(q, PACK, "a", false, "2026-09-25").find((i) => i.itemId === "a")!;
    expect(off.active).toBe(false);
    expect(off.nextReviewDate).toBe(before.nextReviewDate);
  });
});
