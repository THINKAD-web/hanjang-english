import { describe, expect, it } from "vitest";
import { checkContent, isPair, sentenceUsesWord } from "./check";
import { parseContent, rawGiyeok, type RawContent } from "./load";

// 테스트에서 JSON 을 일부러 망가뜨리기 위한 느슨한 타입.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = { pack: any; words: any[]; lessons: any[] };

/** 실제 콘텐츠를 복제해 한 군데만 망가뜨린다. */
function mutate(fn: (raw: Loose) => void): RawContent {
  const copy = structuredClone(rawGiyeok) as Loose;
  fn(copy);
  return copy;
}

describe("실제 ㄱ 팩 콘텐츠", () => {
  it("content:check 를 통과한다", () => {
    expect(checkContent(rawGiyeok)).toEqual([]);
  });

  it("단어 52개 = L1~L6 각 8개 + L7 신규 4개", () => {
    const c = parseContent(rawGiyeok);
    expect(c.words).toHaveLength(52);
    expect(c.words.filter((w) => w.sound === "k").map((w) => w.text)).toEqual(["coat", "cold", "class", "back"]);
  });

  it("L1 만 검수 완료", () => {
    const c = parseContent(rawGiyeok);
    expect(c.lessons.filter((l) => l.reviewed).map((l) => l.dayNo)).toEqual([1]);
  });
});

describe("규칙 위반을 잡는다", () => {
  const cases: [string, (raw: Loose) => void, RegExp][] = [
    ["단어 7개", (r) => r.lessons[0].wordIds.pop(), /단어는 정확히 8개/],
    ["없는 단어", (r) => (r.lessons[0].wordIds[0] = "g-nope"), /words.json 에 없는 단어/],
    ["문장 1개", (r) => r.lessons[0].sentences.pop(), /문장은 정확히 2개/],
    ["문장 단어 1개", (r) => (r.lessons[0].sentences[0].wordIds = ["g-grass"]), /2개 이상/],
    ["문장에 없는 단어 표시", (r) => (r.lessons[0].sentences[0].wordIds = ["g-grass", "g-grape"]), /에 grape 가 없다/],
    ["유형 중복", (r) => (r.lessons[0].quiz[4] = { ...r.lessons[0].quiz[3] }), /ox 유형은 정확히 1번/],
    ["정답이 보기에 없음", (r) => (r.lessons[0].quiz[0].answer = "green"), /보기에 없다/],
    ["보기 중복", (r) => (r.lessons[0].quiz[0].options = ["grass", "grass", "class"]), /보기 중복/],
    ["그림 불가 단어로 그림 문항", (r) => {
      r.lessons[0].quiz[0] = { type: "picture_choice", targetWordId: "g-ground", options: ["ground", "grass", "green"], answer: "ground" };
    }, /imageable: false/],
    ["다른 장 단어가 target", (r) => (r.lessons[0].quiz[1].targetWordId = "g-glow"), /이 장 단어가 아니다/],
    ["ox 정답 불일치", (r) => (r.lessons[0].quiz[4].answer = false), /맞지 않는다/],
    ["🪿 그림 문항", (r) => {
      r.lessons[2].quiz[0] = { type: "picture_choice", targetWordId: "g-goose", options: ["goose", "goat", "goal"], answer: "goose" };
    }, /렌더 위험/],
    ["words.json 에만 있는 단어", (r) => r.words.push({ id: "g-gap", text: "gap", meaning: "틈", sound: "-g", imageable: false }), /단어 수 53 ≠ 레슨이 참조하는 고유 단어 수 52/],
    ["L4 gr/gl 짝 부족", (r) => (r.lessons[3].quiz[1].options = ["glow", "glad", "globe"]), /gr-gl 짝 보기 문항이 2개 이상/],
    ["L7 g/k 짝 부족", (r) => (r.lessons[6].quiz[3].options = ["back", "big", "egg"]), /g-k 짝 보기 문항이 4개 이상/],
    ["imageable 인데 그림 없음", (r) => delete r.words[0].emoji, /emoji 또는 image/],
  ];

  it.each(cases)("%s", (_name, fn, re) => {
    const errors = checkContent(mutate(fn));
    expect(errors.join("\n")).toMatch(re);
  });
});

describe("보조 함수", () => {
  it("sentenceUsesWord 는 -s 변형을 인정하고 부분 문자열은 인정하지 않는다", () => {
    expect(sentenceUsesWord("Grandma grows grapes.", "grow")).toBe(true);
    expect(sentenceUsesWord("Grandma grows grapes.", "grape")).toBe(true);
    expect(sentenceUsesWord("The grasshopper jumps.", "grass")).toBe(false);
  });

  it("isPair", () => {
    expect(isPair("gr-gl", "grass", "glass")).toBe(true);
    expect(isPair("gr-gl", "glow", "grow")).toBe(true);
    expect(isPair("g-k", "goat", "coat")).toBe(true);
    expect(isPair("g-k", "bag", "back")).toBe(true);
    expect(isPair("g-k", "glass", "class")).toBe(true);
    expect(isPair("g-k", "bag", "big")).toBe(false);
  });
});
