import { describe, expect, it } from "vitest";
import type { Manifest, ManifestLesson, ManifestPack } from "@/lib/content/bundle";
import type { Pack } from "@/lib/content/schema";
import { addProfile, switchProfile } from "@/lib/parent/account";
import { createInitialState, type Attempt, type State } from "@/lib/store/types";
import {
  activeProfile,
  audienceOf,
  continuePackId,
  inProgressPacks,
  isOpenPack,
  isUnlocked,
  levelsOf,
  packProgressOf,
  packsOf,
  subjectsOf,
} from "./catalog";

const lessons = (id: string, n: number): ManifestLesson[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${id}-${String(i + 1).padStart(2, "0")}`, order: i + 1, title: "t", type: "vocab", reviewed: true, testOnly: false }));

const pack = (id: string, over: Partial<Pack> & { n?: number } = {}): ManifestPack => {
  const { n = 4, ...rest } = over;
  return {
    id,
    subjectId: "en-kid",
    title: id,
    level: "초급",
    levelOrder: 1,
    order: 1,
    tagLabel: "소리",
    ttsLang: "en-US",
    status: "live",
    access: "free",
    rules: { itemsPerLesson: 8, sentencesPerLesson: 2, minItemsPerSentence: 2, quizPerLesson: 5, allowedQuizTypes: ["meaning_choice"], allowQuizTypeSubstitution: false, autoQuiz: false },
    lessonCount: n,
    ...rest,
    lessons: lessons(id, n),
  };
};

const manifest: Manifest = {
  version: 1,
  subjects: [
    { id: "en-kid", name: "어린이 영어", audience: "kid", order: 1 },
    { id: "math-kid", name: "어린이 수학", audience: "kid", order: 2 },
    { id: "en-adult", name: "성인 영어", audience: "adult", order: 1 },
    { id: "empty-kid", name: "빈 과목", audience: "kid", order: 3 },
  ],
  packs: [
    pack("en-kid-giyeok", { n: 8 }),
    pack("en-kid-animals", { order: 2, unlock: { afterPackId: "en-kid-giyeok" } }),
    pack("en-kid-advanced", { level: "중급", levelOrder: 2 }),
    pack("math-kid-add", { subjectId: "math-kid" }),
    pack("en-adult-travel", { subjectId: "en-adult", status: "soon", n: 0 }),
  ],
};

const attempt = (packId: string, lessonId: string, startedAt: string, profileId = "child"): Attempt => ({
  id: `${packId}-${lessonId}-${startedAt}`,
  profileId,
  packId,
  dateKey: startedAt.slice(0, 10),
  kind: "lesson",
  lessonId,
  itemIds: [],
  answers: [],
  score: 0,
  startedAt,
  finishedAt: startedAt,
  completed: true,
});

const withAttempts = (s: State, ...a: Attempt[]): State => ({ ...s, attempts: [...s.attempts, ...a] });
const track = (s: State, packId: string, profileId = "child"): State => ({ ...s, tracks: [...s.tracks, { profileId, packId, status: "active" }] });

describe("과목 · 레벨 · 팩 목록", () => {
  it("대상(아이/성인)별 과목, 팩이 없는 과목은 뺀다", () => {
    expect(subjectsOf(manifest, "kid").map((s) => s.id)).toEqual(["en-kid", "math-kid"]);
    expect(subjectsOf(manifest, "adult").map((s) => s.id)).toEqual(["en-adult"]);
  });

  it("레벨 칩은 levelOrder 순서, 같은 레벨은 하나", () => {
    expect(levelsOf(manifest, "en-kid")).toEqual([
      { level: "초급", levelOrder: 1 },
      { level: "중급", levelOrder: 2 },
    ]);
  });

  it("레벨 안 팩은 order 순서", () => {
    expect(packsOf(manifest, "en-kid", 1).map((p) => p.id)).toEqual(["en-kid-giyeok", "en-kid-animals"]);
  });

  it("프로필 종류 → 대상", () => {
    expect(audienceOf({ type: "child" })).toBe("kid");
    expect(audienceOf({ type: "self" })).toBe("adult");
  });
});

describe("진행 · 잠금", () => {
  it("완료한 장 수는 현재 프로필의 것만 센다", () => {
    let s = createInitialState("en-kid-giyeok");
    s = withAttempts(s, attempt("en-kid-giyeok", "en-kid-giyeok-01", "2026-10-12T01:00:00Z"), attempt("en-kid-giyeok", "en-kid-giyeok-02", "2026-10-13T01:00:00Z", "other"));
    expect(packProgressOf(s, manifest.packs[0])).toEqual({ done: 1, total: 8 });
  });

  it("앞 팩을 끝내야 열린다", () => {
    const animals = manifest.packs[1];
    let s = createInitialState("en-kid-giyeok");
    expect(isUnlocked(s, animals, manifest)).toBe(false);
    s = withAttempts(s, ...Array.from({ length: 8 }, (_, i) => attempt("en-kid-giyeok", `en-kid-giyeok-0${i + 1}`, `2026-10-1${i}T01:00:00Z`)));
    expect(isUnlocked(s, animals, manifest)).toBe(true);
    expect(isUnlocked(s, manifest.packs[0], manifest)).toBe(true); // unlock 없는 팩은 항상 열림
  });

  it("앞 팩이 목록에 없으면(비공개) 잠긴 채로 둔다", () => {
    expect(isUnlocked(createInitialState("x"), { unlock: { afterPackId: "ghost" } }, manifest)).toBe(false);
  });
});

describe("내 팩 · 이어서", () => {
  it("진행 중인 팩만 최근 순으로 최대 3개", () => {
    let s = createInitialState("en-kid-giyeok");
    s = track(track(track(s, "en-kid-animals"), "math-kid-add"), "en-kid-advanced");
    s = withAttempts(
      s,
      attempt("en-kid-giyeok", "en-kid-giyeok-01", "2026-10-12T01:00:00Z"),
      attempt("math-kid-add", "math-kid-add-01", "2026-10-14T01:00:00Z"),
      attempt("en-kid-animals", "en-kid-animals-01", "2026-10-13T01:00:00Z"),
    );
    expect(inProgressPacks(s, manifest).map((p) => p.id)).toEqual(["math-kid-add", "en-kid-animals", "en-kid-giyeok"]);
    expect(inProgressPacks(s, manifest, 2)).toHaveLength(2);
  });

  it("끝낸 팩은 빠지고, 준비 중 팩은 들어오지 않는다", () => {
    let s = createInitialState("en-kid-giyeok");
    s = track(s, "en-adult-travel");
    s = withAttempts(s, ...Array.from({ length: 8 }, (_, i) => attempt("en-kid-giyeok", `en-kid-giyeok-0${i + 1}`, `2026-10-1${i}T01:00:00Z`)));
    expect(inProgressPacks(s, manifest)).toEqual([]);
  });

  it("이어서: 마지막으로 연 팩 → 진행 중 팩 → (아이면) 기본 팩 → 없으면 null", () => {
    let kid = createInitialState("en-kid-giyeok");
    expect(continuePackId(kid, manifest)).toBe("en-kid-giyeok");
    kid = track({ ...kid, activePackId: "math-kid-add" }, "math-kid-add");
    expect(continuePackId(kid, manifest)).toBe("math-kid-add");
    // 보이지 않게 된 팩(예: Debug 에서 열었다가 Production)이면 다른 팩으로
    const stale = { ...kid, activePackId: "gone", tracks: [...kid.tracks, { profileId: "child", packId: "gone", status: "active" as const }] };
    expect(continuePackId(stale, manifest)).toBe("en-kid-giyeok");

    const adult = switchProfile(addProfile(createInitialState("en-kid-giyeok"), { name: "나", type: "self" }), "p-2");
    expect(continuePackId(adult, manifest)).toBeNull();
  });
});

describe("프로필 추가 · 전환", () => {
  it("추가해도 지금 프로필은 그대로, 전환하면 그 프로필의 마지막 팩으로", () => {
    let s = createInitialState("en-kid-giyeok");
    s = addProfile(s, { name: " 엄마 ", type: "self" });
    expect(s.profiles.map((p) => p.id)).toEqual(["child", "p-2"]);
    expect(s.profiles[1]).toEqual({ id: "p-2", type: "self", name: "엄마" });
    expect(s.activeProfileId).toBe("child");

    s = switchProfile(s, "p-2");
    expect(activeProfile(s).id).toBe("p-2");
    expect(s.activePackId).toBeNull();

    s = switchProfile(s, "child");
    expect(s.activePackId).toBe("en-kid-giyeok");
  });

  it("아이 프로필은 학년 기본 3, 모르는 id 전환은 무시", () => {
    let s = addProfile(createInitialState("x"), { name: "", type: "child" });
    expect(s.profiles[1]).toEqual({ id: "p-2", type: "child", grade: 3 });
    expect(switchProfile(s, "nope")).toBe(s);
    s = addProfile(s, { name: "b", type: "child", grade: 4 });
    expect(s.profiles[2].id).toBe("p-3");
  });

  it("프로필마다 기록이 분리된다 (전환 후 완료 장 수 0)", () => {
    let s = withAttempts(createInitialState("en-kid-giyeok"), attempt("en-kid-giyeok", "en-kid-giyeok-01", "2026-10-12T01:00:00Z"));
    s = switchProfile(addProfile(s, { name: "나", type: "self" }), "p-2");
    expect(packProgressOf(s, manifest.packs[0]).done).toBe(0);
  });
});

describe("Debug 에서만 열리는 준비 중 팩 (성인 영어 출장)", () => {
  const travel = { ...pack("en-adult-travel", { subjectId: "en-adult", status: "soon", n: 8 }) };
  const withTravel: Manifest = { ...manifest, packs: [...manifest.packs.filter((p) => p.id !== "en-adult-travel"), travel] };
  const adultWithTrack = (): State => {
    let s = switchProfile(addProfile(createInitialState("en-kid-giyeok"), { name: "나", type: "self" }), "p-2");
    s = track(s, "en-adult-travel", "p-2");
    return withAttempts(s, attempt("en-adult-travel", "en-adult-travel-01", "2026-10-12T01:00:00Z", "p-2"));
  };

  it("isOpenPack: Production 은 live 만, Debug 는 레슨 있는 soon 도", () => {
    expect(isOpenPack(travel, { debug: false })).toBe(false);
    expect(isOpenPack(travel, { debug: true })).toBe(true);
    expect(isOpenPack({ ...travel, lessons: [] }, { debug: true })).toBe(false);
    expect(isOpenPack(manifest.packs[0], { debug: false })).toBe(true);
  });

  it("Debug: 시작한 출장 팩이 내 팩·이어서에 나오고, Production 에서는 나오지 않는다", () => {
    const s = adultWithTrack();
    expect(inProgressPacks(s, withTravel, 3, { debug: true }).map((p) => p.id)).toEqual(["en-adult-travel"]);
    expect(continuePackId(s, withTravel, { debug: true })).toBe("en-adult-travel");
    expect(inProgressPacks(s, withTravel, 3, { debug: false })).toEqual([]);
    expect(continuePackId(s, withTravel, { debug: false })).toBeNull();
  });
});
