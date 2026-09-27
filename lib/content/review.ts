import type { Content, Item, Quiz } from "./schema";

/** docs/content-review.md 본문. 사람 검수용 표. */

const TYPE_LABEL: Record<Quiz["type"], string> = {
  picture_choice: "그림 보고 고르기",
  meaning_choice: "뜻 보고 고르기",
  fill_blank: "빈칸 채우기",
  listen_choice: "듣고 고르기",
  ox: "O/X",
};

const cell = (s: string) => s.replace(/\|/g, "\\|");

function question(q: Quiz, target: Item | undefined): string {
  switch (q.type) {
    case "picture_choice":
      return `${target?.emoji ?? "(그림)"}`;
    case "meaning_choice":
      return q.prompt;
    case "fill_blank":
      return q.sentence;
    case "listen_choice":
      return `🔊 ${target?.text ?? q.targetItemId}`;
    case "ox":
      return q.statement;
  }
}

function options(q: Quiz): string {
  if (q.type === "ox") return "O / X";
  return q.options.map((o) => (o === q.answer ? `**${o}**` : o)).join(" / ");
}

function answer(q: Quiz): string {
  if (q.type === "ox") return q.answer ? "O" : "X";
  return q.answer;
}

export function renderReviewMarkdown(content: Content): string {
  const { pack, lessons, itemsById, items } = content;
  const out: string[] = [];
  out.push(
    `# 콘텐츠 검수표 — ${pack.brandLabel} (${pack.title} · ${pack.unitLabel})`,
    "",
    "> `npm run content:check` 가 자동 생성한다. 직접 수정하지 말 것. 콘텐츠는 `content/` 의 JSON 을 고친다.",
    "> 검수가 끝난 장은 JSON 의 `reviewed` 를 `true` 로 바꾼다.",
    "> 보기 순서는 JSON 그대로 표시한다. 화면에서는 날짜·장·문항 번호 seed 로 섞여서 나온다.",
    "",
    `아이템 ${items.length}개 · 레슨 ${lessons.length}장`,
    "",
    "| 장 | 제목 | 포커스 | 검수 |",
    "|---|---|---|---|",
    ...lessons.map((l) => `| L${l.dayNo} | ${cell(l.title)} | ${cell(l.focus.label)} | ${l.reviewed ? "✅ 완료" : "⏳ 대기"} |`),
    "",
  );

  for (const l of lessons) {
    out.push(
      `## L${l.dayNo} — ${l.title} ${l.reviewed ? "✅" : "⏳ 검수 대기"}`,
      "",
      `**오늘의 포커스 (${l.focus.label})**`,
      "",
      `1. ${l.focus.lines[0]}`,
      `2. ${l.focus.lines[1]}`,
      "",
      "| # | 아이템 | 뜻 | 그림 | 태그 | 그림 문항 |",
      "|---|---|---|---|---|---|",
    );
    l.itemIds.forEach((id, i) => {
      const it = itemsById.get(id);
      out.push(
        it
          ? `| ${i + 1} | ${it.text} | ${cell(it.meaningKo)} | ${it.emoji ?? "—"} | ${it.tags.join(", ")} | ${it.imageable ? "가능" : "불가"} |`
          : `| ${i + 1} | ⚠️ ${id} | | | | |`,
      );
    });
    out.push("", "**예문**", "");
    l.sentences.forEach((s, i) => {
      const used = s.itemIds.map((id) => itemsById.get(id)?.text ?? id).join(", ");
      out.push(`${i + 1}. ${s.text} (${s.meaningKo}) — _${used}_`);
    });
    out.push("", "**퀴즈**", "", "| # | 유형 | 대상 | 문제 | 보기 | 정답 |", "|---|---|---|---|---|---|");
    l.quiz.forEach((q, i) => {
      const t = itemsById.get(q.targetItemId);
      out.push(
        `| ${i + 1} | ${TYPE_LABEL[q.type]} | ${t?.text ?? q.targetItemId} | ${cell(question(q, t))} | ${cell(options(q))} | ${answer(q)} |`,
      );
    });
    out.push("");
  }
  return out.join("\n");
}
