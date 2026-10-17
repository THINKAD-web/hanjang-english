import { describe, expect, it } from "vitest";
import { adultSample } from "@/lib/content/__fixtures__/adult-sample";
import { parseContent } from "@/lib/content/node";
import { DAILY_LIMIT, completedLessonIds, decideToday } from "./today";
import { ensureTrack, recordSheetComplete, recordSheetStart, weekStamps } from "./progress";
import { activeItems } from "./queue";
import { content as kid, doLesson, freshState, lessonId, MON, TUE, WED } from "./__fixtures__/state";

const adult = parseContent(adultSample);
const finish = (s: ReturnType<typeof freshState>, c: typeof adult, lessonIdOf: string, dateKey: string, wrong: string[] = []) =>
  recordSheetComplete(s, {
    attemptId: `t-${c.pack.id}-${lessonIdOf}-${dateKey}`,
    packId: c.pack.id,
    subjectId: c.pack.subjectId,
    dateKey,
    kind: "lesson",
    lessonId: lessonIdOf,
    itemIds: c.lessons.find((l) => l.id === lessonIdOf)!.itemIds,
    answers: [
      ...c.lessons.find((l) => l.id === lessonIdOf)!.quiz.map((q) => ({ targetItemId: q.targetItemId, correct: !wrong.includes(q.targetItemId) })),
    ],
    startedAt: `${dateKey}T00:00:00.000Z`,
    finishedAt: `${dateKey}T00:08:00.000Z`,
  });

describe("팩 독립", () => {
  it("A 팩에서 하루 한도를 채워도 B 팩은 그대로 열려 있다", () => {
    let s = freshState();
    for (let i = 1; i <= DAILY_LIMIT; i++) s = doLesson(s, lessonId(i), MON);
    expect(decideToday(s, MON, kid).kind).toBe("dailyLimit");
    expect(decideToday(s, MON, adult)).toEqual({ kind: "lesson", lessonId: adult.lessons[0].id });
  });

  it("A 팩의 오답·완료 장은 B 팩에 섞이지 않는다", () => {
    let s = freshState();
    s = doLesson(s, lessonId(1), MON, { wrong: [kid.lessons[0].quiz[0].targetItemId] });
    s = finish(s, adult, adult.lessons[0].id, TUE);
    expect(completedLessonIds(s, kid.pack.id)).toEqual([lessonId(1)]);
    expect(completedLessonIds(s, adult.pack.id)).toEqual([adult.lessons[0].id]);
    expect(activeItems(s.wrongQueue, adult.pack.id, s.activeProfileId)).toHaveLength(0);
    expect(activeItems(s.wrongQueue, kid.pack.id, s.activeProfileId)).toHaveLength(1);
  });

  it("주간 도장은 모든 팩을 합치고, 팩을 지정하면 그 팩만 센다", () => {
    let s = freshState();
    s = doLesson(s, lessonId(1), MON);
    s = finish(s, adult, adult.lessons[0].id, WED);
    const stamped = (cells: ReturnType<typeof weekStamps>) => cells.filter((c) => c.stamped).map((c) => c.dateKey);
    expect(stamped(weekStamps(s, WED))).toEqual([MON, WED]);
    expect(stamped(weekStamps(s, WED, kid.pack.id))).toEqual([MON]);
    expect(stamped(weekStamps(s, WED, adult.pack.id))).toEqual([WED]);
  });

  it("프로필이 다르면 기록이 섞이지 않는다", () => {
    let s = freshState();
    s = doLesson(s, lessonId(1), MON);
    const other = { ...s, profiles: [...s.profiles, { id: "me", type: "self" as const }], activeProfileId: "me" };
    expect(completedLessonIds(other, kid.pack.id)).toEqual([]);
    expect(weekStamps(other, MON).some((c) => c.stamped)).toBe(false);
    expect(decideToday(other, MON, kid)).toEqual({ kind: "lesson", lessonId: lessonId(1) });
  });
});

describe("Track 자동 생성", () => {
  it("처음 시작하는 팩이면 Track 이 만들어지고 activePackId 가 바뀐다", () => {
    const s0 = freshState();
    expect(s0.tracks).toHaveLength(1);
    const s1 = recordSheetStart(s0, { packId: adult.pack.id, subjectId: adult.pack.subjectId, dateKey: MON, at: `${MON}T00:00:00.000Z` });
    expect(s1.tracks).toHaveLength(2);
    expect(s1.tracks[1]).toEqual({ profileId: "child", packId: adult.pack.id, subjectId: "en-adult", status: "active" });
    expect(s1.activePackId).toBe(adult.pack.id);
  });

  it("이미 있는 Track 은 중복으로 만들지 않는다", () => {
    const s = ensureTrack(ensureTrack(freshState(), kid.pack.id), kid.pack.id);
    expect(s.tracks).toHaveLength(1);
  });

  it("완료 기록에 subjectId 가 남는다", () => {
    const s = finish(freshState(), adult, adult.lessons[0].id, MON);
    expect(s.attempts[0].subjectId).toBe("en-adult");
    expect(s.tracks.some((t) => t.packId === adult.pack.id)).toBe(true);
  });
});
