import { describe, expect, it } from "vitest";
import { checkContent, isPair, sentenceUsesText } from "./check";
import { CONTENT_REGISTRY, parseContent, type RawContent } from "./load";

const rawGiyeok = CONTENT_REGISTRY["en-kid-giyeok"];

// 테스트에서 JSON 을 일부러 망가뜨리기 위한 느슨한 타입.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = { pack: any; items: any[]; lessons: any[] };

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

  it("아이템 52개 = L1~L6 각 8개 + L7 신규 4개", () => {
    const c = parseContent(rawGiyeok);
    expect(c.items).toHaveLength(52);
    expect(c.items.filter((it) => it.tags.includes("k")).map((it) => it.text)).toEqual(["coat", "cold", "class", "back"]);
  });

  it("L1~L8 모두 검수 완료", () => {
    const c = parseContent(rawGiyeok);
    expect(c.lessons.every((l) => l.reviewed)).toBe(true);
  });

  it("grass 는 실사가 생길 때까지 그림 없이 표시 (라이브 점검 조치)", () => {
    const c = parseContent(rawGiyeok);
    const grass = c.itemsById.get("g-grass")!;
    expect(grass.imageable).toBe(false);
    expect(grass.emoji).toBeUndefined();
  });

  it("L1 그림 문항 대상은 grape 다 (grass → grape, 라이브 점검 조치)", () => {
    const c = parseContent(rawGiyeok);
    const q = c.lessons[0].quiz.find((q) => q.type === "picture_choice")!;
    expect(q.targetItemId).toBe("g-grape");
  });
});

describe("규칙 위반을 잡는다", () => {
  const cases: [string, (raw: Loose) => void, RegExp][] = [
    ["아이템 7개", (r) => r.lessons[0].itemIds.pop(), /아이템은 정확히 8개/],
    ["없는 아이템", (r) => (r.lessons[0].itemIds[0] = "g-nope"), /items.json 에 없는 아이템/],
    ["문장 1개", (r) => r.lessons[0].sentences.pop(), /문장은 정확히 2개/],
    ["문장 아이템 1개", (r) => (r.lessons[0].sentences[0].itemIds = ["g-grass"]), /2개 이상/],
    ["문장에 없는 아이템 표시", (r) => (r.lessons[0].sentences[0].itemIds = ["g-grass", "g-grape"]), /에 grape 가 없다/],
    ["유형 중복", (r) => (r.lessons[0].quiz[4] = { ...r.lessons[0].quiz[3] }), /ox 유형은 정확히 1번/],
    ["정답이 보기에 없음", (r) => (r.lessons[0].quiz[0].answer = "great"), /보기에 없다/],
    ["보기 중복", (r) => (r.lessons[0].quiz[0].options = ["grass", "grass", "class"]), /보기 중복/],
    [
      "imageable false 아이템으로 그림 문항",
      (r) => {
        r.lessons[0].quiz[0] = { type: "picture_choice", targetItemId: "g-ground", options: ["ground", "grass", "green"], answer: "ground" };
      },
      /imageable: false/,
    ],
    ["다른 장 아이템이 target", (r) => (r.lessons[0].quiz[1].targetItemId = "g-glow"), /이 장 아이템이 아니다/],
    ["ox 정답 불일치", (r) => (r.lessons[0].quiz[4].answer = false), /맞지 않는다/],
    [
      "items.json 에만 있는 아이템",
      (r) => r.items.push({ id: "g-gap", kind: "word", text: "gap", meaningKo: "틈", tags: ["-g"], imageable: false }),
      /아이템 수 53 ≠ 레슨이 참조하는 고유 아이템 수 52/,
    ],
    ["L4 gr/gl 짝 부족", (r) => (r.lessons[3].quiz[1].options = ["glow", "glad", "globe"]), /gr-gl 짝 보기 문항이 2개 이상/],
    ["L7 g/k 짝 부족", (r) => (r.lessons[6].quiz[3].options = ["back", "big", "egg"]), /g-k 짝 보기 문항이 4개 이상/],
    ["조사 틀림", (r) => (r.lessons[2].quiz[1].prompt = '"대문"는?'), /"대문"은\? 이어야/],
    ["imageable 인데 그림 없음", (r) => delete r.items[0].emoji, /emoji 또는 image/],
    [
      "picture_choice 없는데 fill_blank·listen_choice 가 하나뿐",
      (r) => {
        // grass·ground·group·great 를 모두 imageable:false 로 만들어(사실상 이미 대부분 false) 그림 불가 장으로 만들고,
        // fill_blank 를 listen_choice 로 바꿔 fill_blank 가 0개가 되게 한다
        for (const id of r.lessons[0].itemIds) {
          const it = r.items.find((x: { id: string }) => x.id === id);
          it.imageable = false;
          delete it.emoji;
        }
        const fillIdx = r.lessons[0].quiz.findIndex((q: { type: string }) => q.type === "fill_blank");
        const fill = r.lessons[0].quiz[fillIdx];
        r.lessons[0].quiz[fillIdx] = { type: "listen_choice", targetItemId: fill.targetItemId, options: fill.options, answer: fill.answer };
      },
      /fill_blank·listen_choice 가 각각 1번 이상/,
    ],
  ];

  it.each(cases)("%s", (_name, fn, re) => {
    const errors = checkContent(mutate(fn));
    expect(errors.join("\n")).toMatch(re);
  });

  it("imageable 아이템이 없는 장은 picture_choice 를 fill_blank/listen_choice 로 대체할 수 있다 (기획안 5-5)", () => {
    const raw = mutate((r) => {
      for (const id of r.lessons[0].itemIds) {
        const it = r.items.find((x: { id: string }) => x.id === id);
        it.imageable = false;
        delete it.emoji;
      }
      const pictureIdx = r.lessons[0].quiz.findIndex((q: { type: string }) => q.type === "picture_choice");
      // picture_choice 자리를 listen_choice 로 대체 (fill_blank 는 이미 1개 있으니 listen_choice 를 2개로)
      r.lessons[0].quiz[pictureIdx] = { type: "listen_choice", targetItemId: "g-group", options: ["group", "grow", "great"], answer: "group" };
    });
    expect(checkContent(raw)).toEqual([]);
  });
});

describe("보조 함수", () => {
  it("sentenceUsesText 는 -s 변형을 인정하고 부분 문자열은 인정하지 않는다", () => {
    expect(sentenceUsesText("Grandma grows grapes.", "grow")).toBe(true);
    expect(sentenceUsesText("Grandma grows grapes.", "grape")).toBe(true);
    expect(sentenceUsesText("The grasshopper jumps.", "grass")).toBe(false);
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
