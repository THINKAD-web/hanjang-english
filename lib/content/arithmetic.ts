import type { ArithmeticOp, Item } from "./schema";

/**
 * 연산 문제 식 ("7 + 5", "12 - 4", "3 × 4", "12 ÷ 3") 읽기와 다시 계산하기.
 * 생성기가 만든 정답도, 사람이 손으로 적은 problem 아이템의 정답도 이 함수로 검산한다.
 */

export const OP_TAG: Record<ArithmeticOp, string> = { "+": "add", "-": "sub", "×": "mul", "÷": "div" };

export type Expression = { a: number; op: ArithmeticOp; b: number };

const OP_ALIASES: Record<string, ArithmeticOp> = { "+": "+", "-": "-", "−": "-", "–": "-", "×": "×", x: "×", X: "×", "*": "×", "÷": "÷", "/": "÷" };

/** "7 + 5" → {a:7, op:"+", b:5}. 모양이 다르면 null. */
export function parseExpression(text: string): Expression | null {
  const m = /^\s*(\d+)\s*([+\-−–×xX*÷/])\s*(\d+)\s*$/.exec(text);
  if (!m) return null;
  return { a: Number(m[1]), op: OP_ALIASES[m[2]], b: Number(m[3]) };
}

/** 계산 결과. 나눗셈은 나누어떨어질 때만, 0 으로 나누면 null. */
export function evaluate({ a, op, b }: Expression): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

export const formatExpression = ({ a, op, b }: Expression): string => `${a} ${op} ${b}`;

/** 덧셈에서 어느 자리라도 받아올림이 생기는가. */
export function hasCarry(a: number, b: number): boolean {
  // 첫 받아올림이 생기면 곧바로 true — 그 전까지는 어느 자리도 올림이 없으므로 자리합만 보면 된다
  for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) {
    if ((x % 10) + (y % 10) >= 10) return true;
  }
  return false;
}

/** 뺄셈(a ≥ b)에서 어느 자리라도 받아내림이 생기는가. */
export function hasBorrow(a: number, b: number): boolean {
  for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) {
    if ((x % 10) < (y % 10)) return true;
  }
  return false;
}

/** problem 아이템 하나를 다시 계산해서 어긋나면 에러 문구, 맞으면 null. */
export function verifyProblem(item: Item): string | null {
  if (item.kind !== "problem") return null;
  const expr = parseExpression(item.text);
  if (!expr) return `"${item.text}" 는 "7 + 5" 같은 식이 아니라 정답을 검산할 수 없다`;
  const result = evaluate(expr);
  if (result === null) return `"${item.text}" 는 나누어떨어지지 않거나 0 으로 나눈다`;
  if (String(result) !== item.answer) return `"${item.text}" 의 정답은 ${result} 인데 answer 가 ${item.answer} 이다`;
  return null;
}
