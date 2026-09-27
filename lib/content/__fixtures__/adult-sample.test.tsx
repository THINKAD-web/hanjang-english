import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WordCard } from "@/components/word-card";
import { checkContent } from "@/lib/content/check";
import { parseContent } from "@/lib/content/load";
import { adultSample } from "./adult-sample";

/**
 * 성인 영어(문장) 샘플 1장 — 배포하지 않는 테스트 전용 콘텐츠.
 * 기획안 v2 8장: "성인 샘플 JSON 1장이 같은 화면에서 깨지지 않고 렌더되는 것"이 성공 기준.
 */

describe("성인 샘플 팩 (fixture, 배포하지 않음)", () => {
  it("content:check 를 통과한다 — picture_choice 없이도 5-5 예외가 허용한다", () => {
    expect(checkContent(adultSample)).toEqual([]);
  });

  it("그림 없는 문장 아이템도 WordCard 가 깨지지 않고 렌더된다", () => {
    const content = parseContent(adultSample);
    for (const item of content.items) {
      expect(item.imageable).toBe(false);
      expect(item.image).toBeUndefined();
      expect(item.emoji).toBeUndefined();
      const html = renderToStaticMarkup(<WordCard word={item} />);
      expect(html).toContain(item.meaningKo);
      // 그림이 없으니 <img> 나 이모지 <span role="img"> 가 나오면 안 된다
      expect(html).not.toContain("<img");
      expect(html).not.toContain('role="img"');
    }
  });

  it("긴 영어 문장도 카드 텍스트로 그대로 렌더된다", () => {
    const content = parseContent(adultSample);
    const hold = content.itemsById.get("adt-hold")!;
    const html = renderToStaticMarkup(<WordCard word={hold} />);
    expect(html).toContain("Could you hold on a second?");
  });
});
