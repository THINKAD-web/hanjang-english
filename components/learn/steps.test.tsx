import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_STEPS, resolveSteps } from "@/lib/content/lesson-steps";
import type { Item } from "@/lib/content/schema";
import { SpeechLangProvider } from "@/lib/tts-lang";
import { PatternsStep, PracticeStep } from "./steps";

const problem: Item = { id: "m1", kind: "problem", text: "3 + 4", answer: "7", imageable: false, tags: [] } as Item;
const pattern: Item = { id: "p1", kind: "phrase", text: "I like apples.", meaningKo: "나는 사과를 좋아해요.", imageable: false, tags: [] } as Item;

describe("스텝 기본값", () => {
  it("레슨 타입별 기본 스텝", () => {
    expect(DEFAULT_STEPS.phonics).toEqual(["intro", "cards", "listen", "sentences", "quiz"]);
    expect(DEFAULT_STEPS.vocab).toEqual(["intro", "cards", "listen", "sentences", "quiz"]);
    expect(DEFAULT_STEPS.listening).toEqual(["intro", "listen", "quiz"]);
    expect(DEFAULT_STEPS.grammar).toEqual(["intro", "patterns", "quiz"]);
    expect(DEFAULT_STEPS.math).toEqual(["intro", "practice", "quiz"]);
  });

  it("레슨이 steps 를 직접 지정하면 그것을 쓴다, intro/문장이 없으면 해당 단계는 빠진다", () => {
    expect(resolveSteps({ type: "math", sentences: [], steps: ["practice", "quiz"] })).toEqual(["practice", "quiz"]);
    expect(resolveSteps({ type: "vocab", sentences: [] })).toEqual(["cards", "listen", "quiz"]);
  });
});

describe("새 스텝 화면", () => {
  it("PracticeStep: 문제를 보여주고 답은 숨겨 둔다", () => {
    const html = renderToStaticMarkup(<PracticeStep problem={problem} index={0} total={8} onNext={() => {}} />);
    expect(html).toContain("3 + 4 = ?");
    expect(html).toContain("연습 1 / 8");
    expect(html).toContain("답 보기");
    expect(html).not.toContain(">7<");
  });

  it("PatternsStep: 문장과 뜻을 보여주고, 읽기 언어는 팩 설정을 따른다", () => {
    const html = renderToStaticMarkup(
      <SpeechLangProvider lang="ja-JP">
        <PatternsStep pattern={pattern} index={1} total={4} onNext={() => {}} />
      </SpeechLangProvider>,
    );
    expect(html).toContain("I like apples.");
    expect(html).toContain("나는 사과를 좋아해요.");
    expect(html).toContain('lang="ja"');
    expect(html).toContain("패턴 2 / 4");
  });
});
