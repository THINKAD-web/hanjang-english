import type { Content, Quiz, Word } from "./schema";

/** docs/content-review.md 본문. 사람 검수용 표. */

const TYPE_LABEL: Record<Quiz["type"], string> = {
  picture_choice: "그림 보고 고르기",
  meaning_choice: "뜻 보고 고르기",
  fill_blank: "빈칸 채우기",
  listen_choice: "듣고 고르기",
  ox: "O/X",
};

const cell = (s: string) => s.replace(/\|/g, "\\|");

function question(q: Quiz, target: Word | undefined): string {
  switch (q.type) {
    case "picture_choice":
      return `${target?.emoji ?? "(그림)"}`;
    case "meaning_choice":
      return q.prompt;
    case "fill_blank":
      return q.sentence;
    case "listen_choice":
      return `🔊 ${target?.text ?? q.targetWordId}`;
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
  const { pack, lessons, wordsById, words } = content;
  const out: string[] = [];
  out.push(
    `# 콘텐츠 검수표 — ${pack.title}`,
    "",
    "> `npm run content:check` 가 자동 생성한다. 직접 수정하지 말 것. 콘텐츠는 `content/` 의 JSON 을 고친다.",
    "> 검수가 끝난 장은 JSON 의 `reviewed` 를 `true` 로 바꾼다.",
    "> 보기 순서는 JSON 그대로 표시한다. 화면에서는 날짜·장·문항 번호 seed 로 섞여서 나온다.",
    "",
    `단어 ${words.length}개 · 레슨 ${lessons.length}장`,
    "",
    "| 장 | 제목 | 소리 | 검수 |",
    "|---|---|---|---|",
    ...lessons.map(
      (l) => `| L${l.dayNo} | ${cell(l.title)} | ${cell(l.soundIntro.label)} | ${l.reviewed ? "✅ 완료" : "⏳ 대기"} |`,
    ),
    "",
  );

  for (const l of lessons) {
    out.push(
      `## L${l.dayNo} — ${l.title} ${l.reviewed ? "✅" : "⏳ 검수 대기"}`,
      "",
      `**오늘의 소리 (${l.soundIntro.label})**`,
      "",
      `1. ${l.soundIntro.lines[0]}`,
      `2. ${l.soundIntro.lines[1]}`,
      "",
      "| # | 단어 | 뜻 | 그림 | 소리 | 그림 문항 |",
      "|---|---|---|---|---|---|",
    );
    l.wordIds.forEach((id, i) => {
      const w = wordsById.get(id);
      out.push(
        w
          ? `| ${i + 1} | ${w.text} | ${cell(w.meaning)} | ${w.emoji ?? "—"} | ${w.sound} | ${w.imageable ? "가능" : "불가"} |`
          : `| ${i + 1} | ⚠️ ${id} | | | | |`,
      );
    });
    out.push("", "**예문**", "");
    l.sentences.forEach((s, i) => {
      const used = s.wordIds.map((id) => wordsById.get(id)?.text ?? id).join(", ");
      out.push(`${i + 1}. ${s.en} (${s.ko}) — _${used}_`);
    });
    out.push("", "**퀴즈**", "", "| # | 유형 | 대상 | 문제 | 보기 | 정답 |", "|---|---|---|---|---|---|");
    l.quiz.forEach((q, i) => {
      const t = wordsById.get(q.targetWordId);
      out.push(
        `| ${i + 1} | ${TYPE_LABEL[q.type]} | ${t?.text ?? q.targetWordId} | ${cell(question(q, t))} | ${cell(options(q))} | ${answer(q)} |`,
      );
    });
    out.push("");
  }
  return out.join("\n");
}
