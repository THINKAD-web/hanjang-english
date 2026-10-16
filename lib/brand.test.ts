import { describe, expect, it } from "vitest";
import { BRAND, BRAND_DESCRIPTION, pageTitle } from "./brand";

describe("brand", () => {
  it("탭 제목은 '페이지 · 앱 이름', 페이지 이름이 없으면 앱 이름만", () => {
    expect(pageTitle("부모 요약")).toBe(`부모 요약 · ${BRAND.appName}`);
    expect(pageTitle()).toBe(BRAND.appName);
  });

  it("설명 문구가 앱 이름과 첫 상품 이름에서 만들어진다 (이름만 바꾸면 따라 바뀐다)", () => {
    expect(BRAND_DESCRIPTION).toContain(BRAND.appName);
    expect(BRAND_DESCRIPTION).toContain(BRAND.firstProductName);
  });

  it("지금 이름은 그대로 (이번 작업에서 이름을 바꾸지 않는다)", () => {
    expect(BRAND.appName).toBe("오늘 한장");
    expect(BRAND.firstProductName).toBe("한장영어");
  });
});
