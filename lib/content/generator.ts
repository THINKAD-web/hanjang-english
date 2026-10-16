import { seededRandom, shuffle } from "@/lib/engine/rng";
import { OP_TAG, evaluate, formatExpression, hasBorrow, hasCarry, type Expression } from "./arithmetic";
import type { Generator, Item } from "./schema";

/**
 * 연산 문제 생성. 순수 함수 — 같은 (generator, lessonId) 면 항상 같은 문제.
 * 조건에 맞는 식을 전부 모은 뒤 seed 로 섞어 앞에서 count 개를 쓰므로 같은 식이 두 번 나올 수 없다.
 * (+, × 는 3+4 와 4+3 을 같은 식으로 보고 하나만 만든다. 어느 쪽이 앞에 올지는 seed 가 정한다.)
 */

export type GeneratedProblems = { items: Item[] } | { error: string };

export function candidateExpressions(g: Generator): Expression[] {
  const out: Expression[] = [];
  const { min, max, op } = g;
  if (op === "÷") {
    for (let b = Math.max(min, 1); b <= max; b++) for (let q = min; q <= max; q++) out.push({ a: b * q, op, b });
    return out;
  }
  for (let a = min; a <= max; a++) {
    for (let b = min; b <= max; b++) {
      if ((op === "+" || op === "×") && b < a) continue; // 교환법칙 짝은 하나만
      if (op === "+" && g.noCarry && hasCarry(a, b)) continue;
      if (op === "-") {
        if (a < b && !g.allowNegative) continue;
        if (g.noBorrow && (a < b || hasBorrow(a, b))) continue;
      }
      out.push({ a, op, b });
    }
  }
  return out;
}

export function generateProblems(g: Generator, lessonId: string): GeneratedProblems {
  const candidates = candidateExpressions(g);
  if (candidates.length < g.count)
    return { error: `${lessonId}: 조건에 맞는 식이 ${candidates.length}개뿐이라 ${g.count}개를 만들 수 없다 (범위 ${g.min}~${g.max}, ${g.op})` };

  const rng = seededRandom(`${g.seed ?? lessonId}:arithmetic`);
  const picked = shuffle(candidates, rng).slice(0, g.count);
  const items: Item[] = picked.map((e, i) => {
    // 교환법칙이 성립하는 연산은 피연산자 순서를 seed 로 뒤집는다
    const expr: Expression = (e.op === "+" || e.op === "×") && rng() < 0.5 ? { a: e.b, op: e.op, b: e.a } : e;
    const result = evaluate(expr);
    if (result === null) throw new Error(`생성기 버그: ${formatExpression(expr)} 를 계산할 수 없다`);
    const tags = [OP_TAG[e.op]];
    if (e.op === "+" && hasCarry(e.a, e.b)) tags.push("carry");
    if (e.op === "-" && e.a >= e.b && hasBorrow(e.a, e.b)) tags.push("borrow");
    return {
      id: `${lessonId}-p${String(i + 1).padStart(2, "0")}`,
      kind: "problem",
      text: formatExpression(expr),
      answer: String(result),
      imageable: false,
      tags,
    };
  });
  return { items };
}
