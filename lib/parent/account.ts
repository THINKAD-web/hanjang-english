import { setReviewEnabled } from "@/lib/engine/queue";
import type { DateKey } from "@/lib/engine/date";
import { DEFAULT_PROFILE_ID, type State } from "@/lib/store/types";

/** 부모 화면이 바꾸는 상태. 진도·점수·오답은 읽기만 하고, 여기서 쓰는 건 PIN 해시·학년·오답 토글·초기화뿐이다. */

export function setParentPin(state: State, pinHash: string): State {
  return { ...state, account: { ...state.account, pinHash } };
}

export function setGrade(state: State, grade: 3 | 4): State {
  return { ...state, profiles: state.profiles.map((p) => (p.id === DEFAULT_PROFILE_ID ? { ...p, grade } : p)) };
}

/** 오답 단어의 "내일 복습에 넣기" 토글. ON 으로 되돌리면 nextReviewDate 는 오늘 기준 다음 날. */
export function toggleWrongReview(state: State, packId: string, itemId: string, on: boolean, today: DateKey): State {
  return { ...state, wrongQueue: setReviewEnabled(state.wrongQueue, packId, itemId, on, today) };
}

/**
 * 전체 초기화: 진행 기록(Attempt·오답 큐·이벤트)만 지운다.
 * 부모 PIN·학년·트랙은 설정이므로 남긴다 — 초기화했다고 PIN 이 사라지면 곧바로 새 PIN 을 또 정해야 한다.
 */
export function resetProgress(state: State): State {
  return { ...state, attempts: [], wrongQueue: [], events: [] };
}
