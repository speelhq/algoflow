// U-53, U-54: replacing a chip, its Delete, and an operator's Unwrap.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { emit } from "@/python/emit";
import { emptyChip, isOperator, replaceChip, unwrapChip } from "./chips";

const { print, bin, v, num, not } = ast;
const code = (p: ReturnType<typeof program>) => emit(p).code.trim();

describe("chip edits", () => {
  it("U-53: a chip is replaced where it sits, at any depth", () => {
    const inner = num(1);
    const p = program([print(bin("+", v("n"), inner))]);
    expect(code(replaceChip(p, inner.id, num(2)))).toBe("print(n + 2)");
  });

  it("U-54: Delete leaves an empty slot in the chip's place", () => {
    const inner = v("n");
    const p = program([print(bin("+", inner, num(1)))]);
    expect(code(emptyChip(p, inner.id))).toBe("print(... + 1)");
  });

  it("U-54: Unwrap replaces an operator with its left operand; nothing else unwraps", () => {
    const sum = bin("+", v("n"), num(1));
    const p = program([print(sum)]);
    expect(code(unwrapChip(p, sum))).toBe("print(n)");
    const negation = not(v("b"));
    const q = program([print(negation)]);
    expect(isOperator(sum)).toBe(true);
    expect(isOperator(negation)).toBe(false);
    expect(unwrapChip(q, negation)).toBe(q);
  });
});
