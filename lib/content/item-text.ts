import { meaningPrompt } from "./josa";
import type { Item } from "./schema";

/**
 * 아이템 종류별로 "뜻 자리"와 "정답 글자"가 다르다. 퀴즈 생성·검증·검수표가 전부 이 함수들만 쓴다.
 * - word/phrase/hanzi: 뜻 = meaningKo, 정답 글자 = text
 * - kana: 뜻 자리 = reading(로마자), 정답 글자 = text
 * - problem: 뜻 자리 = answer(정답 숫자), 정답 글자 = answer
 */

export function meaningOf(item: Item): string {
  if (item.kind === "problem") return item.answer ?? "";
  if (item.kind === "kana") return item.reading ?? "";
  return item.meaningKo ?? "";
}

/** 이 아이템이 문제의 정답일 때 보기에 들어가는 글자. */
export function quizAnswerOf(item: Item): string {
  return item.kind === "problem" ? (item.answer ?? "") : item.text;
}

/** meaning_choice 문구. 한국어 뜻은 `"대문"은?`, 가나는 `"a" 소리가 나는 글자는?`. */
export function meaningChoicePrompt(item: Item): string {
  return item.kind === "kana" ? `"${meaningOf(item)}" 소리가 나는 글자는?` : meaningPrompt(meaningOf(item));
}

/** TTS 가 읽을 텍스트. */
export function speechOf(item: Item): string {
  return item.audioText ?? item.text;
}

/** 화면에 보여줄 설명 한 줄(카드 아래). 문제는 정답을 가리고 싶을 수 있으니 빈 문자열일 수 있다. */
export function captionOf(item: Item): string {
  if (item.kind === "problem") return "";
  if (item.kind === "kana") return item.reading ?? "";
  return item.meaningKo ?? "";
}
