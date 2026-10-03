import type { Content } from "@/lib/content/schema";
import { addDays, type DateKey } from "@/lib/engine/date";
import { completedLessonIds } from "@/lib/engine/today";
import { DEFAULT_PROFILE_ID, type Attempt, type State } from "@/lib/store/types";

/**
 * 디버그 패널 전용(NEXT_PUBLIC_DEBUG=true 일 때만 UI 가 노출된다): 1장부터 N장까지 아직 안 끝낸 장을
 * 전부 정답으로 완료 처리한다. ㄱ 8장 완료 화면을 폰에서 바로 보려는 용도.
 *
 * 오늘의 하루 한도(2장)에 걸리지 않도록, 새로 넣는 장은 오늘 이전의 서로 다른 날짜(오늘 -1일, -2일 …)에
 * 오래된 장부터 차례로 둔다. 이벤트(sheet_complete 등)는 남기지 않아 지표를 오염시키지 않는다.
 */
export function completeLessonsUpTo(state: State, content: Content, n: number, dateKey: DateKey): State {
  const done = new Set(completedLessonIds(state, content.pack.id));
  const missing = content.lessons.filter((l) => l.dayNo <= n && !done.has(l.id));
  const added: Attempt[] = missing.map((lesson, i) => {
    const day = addDays(dateKey, -(missing.length - i));
    const answers = lesson.quiz.map((q) => ({ targetItemId: q.targetItemId, correct: true }));
    return {
      id: `debug-${lesson.id}`,
      profileId: DEFAULT_PROFILE_ID,
      packId: content.pack.id,
      dateKey: day,
      kind: "lesson",
      lessonId: lesson.id,
      itemIds: lesson.itemIds,
      answers,
      score: answers.length,
      startedAt: `${day}T00:00:00.000Z`,
      finishedAt: `${day}T00:08:00.000Z`,
      completed: true,
    };
  });
  return added.length === 0 ? state : { ...state, attempts: [...state.attempts, ...added] };
}
