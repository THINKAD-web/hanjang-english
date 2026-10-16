/**
 * 브랜드 이름은 아직 정해지지 않았다. 화면 제목·메타데이터·앱 이름 문자열은 전부 여기서만 가져다 쓰고,
 * 이름이 바뀌면 이 파일 한 곳만 고친다. (팩마다 다른 `brandLabel` 은 콘텐츠 JSON 의 데이터라 여기 두지 않는다.)
 */

export const BRAND = {
  /** 앱 이름 (홈 제목, 탭 제목 뒤에 붙는 이름) */
  appName: "오늘 한장",
  /** 지금 서비스하는 첫 상품 이름 (검색·공유용 설명에만 쓴다) */
  firstProductName: "한장영어",
} as const;

export const BRAND_DESCRIPTION = `하루에 한 장. ${BRAND.appName}의 첫 팩, ${BRAND.firstProductName}.`;

/** 탭 제목: "부모 요약 · 오늘 한장". 페이지 이름이 없으면 앱 이름만. */
export function pageTitle(page?: string): string {
  return page ? `${page} · ${BRAND.appName}` : BRAND.appName;
}
