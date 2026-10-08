// U-50..U-54, U-93: the edits of a value line on one slot's expression and its caret.
import { describe, expect, it } from "vitest";
import type { Expr } from "@/lang/types";
import { ast } from "@/nodes/testing";
import { unparse } from "@/python/emit";
import {
  attach,
  backspace,
  close,
  digit,
  empty,
  fill,
  find,
  inputAt,
  lineOf,
  makeEntry,
  move,
  open,
  retag,
  sign,
  stops,
  valueBefore,
  type Edit,
  type Line,
} from "./line";

const { v } = ast;

const op = (o: string) => makeEntry("binop", { op: o });
const ok = (edit: Edit): Line => {
  if ("refused" in edit) throw new Error(edit.refused);
  return edit;
};
const text = (line: Line) => unparse(line.root);
const at = (line: Line): Expr | undefined => find(line.root, line.caret.at)?.node;
const digits = (line: Line, typed: string) => typed.split("").reduce(digit, line);

/** `total + i` with the caret after `i`. */
function sum(): Line {
  let line = fill(lineOf(empty()), v("total"));
  line = ok(attach(line, op("+")));
  return fill(line, v("i"));
}

describe("a value line (U-50, U-53, U-93)", () => {
  it("digits make a number at an empty input and extend it; a leading - is its sign", () => {
    const line = digits(lineOf(empty()), "15");
    expect(text(line)).toBe("15");
    expect(text(digits(line, ".5"))).toBe("15.5");
    expect(text(digit(digit(line, "."), "."))).toBe("15.");
    const negative = digits(sign(lineOf(empty())), "3");
    expect(text(negative)).toBe("-3");
  });

  it("an operator binds by precedence, the caret at its new input", () => {
    let line = sum();
    line = ok(attach(line, op("*")));
    expect(at(line)?.kind).toBe("empty");
    line = digits(line, "2");
    expect(text(line)).toBe("total + i * 2");
    line = ok(attach(line, op("-")));
    line = digits(line, "1");
    expect(text(line)).toBe("total + i * 2 - 1");
  });

  it("typed i % 15 == 0 groups as Python groups it", () => {
    let line = fill(lineOf(empty()), v("i"));
    line = digits(ok(attach(line, op("%"))), "15");
    line = digits(ok(attach(line, op("=="))), "0");
    expect(text(line)).toBe("i % 15 == 0");
    expect(line.root).toMatchObject({ op: "==", left: { op: "%" } });
  });

  it("a comparison after a comparison is refused", () => {
    let line = fill(lineOf(empty()), v("a"));
    line = fill(ok(attach(line, op("<"))), v("b"));
    expect(attach(line, op("<"))).toEqual({ refused: "E_PARSE_CHAIN" });
    expect(text(ok(attach(line, op("and"))))).toBe("a < b and ...");
  });

  it("brackets keep what they hold together until they close", () => {
    let line = open(lineOf(empty()));
    line = fill(line, v("a"));
    line = fill(ok(attach(line, op("+"))), v("b"));
    line = close(line);
    line = fill(ok(attach(line, op("*"))), v("c"));
    expect(text(line)).toBe("(a + b) * c");
  });

  it("an entry without a precedence takes the last value before the caret", () => {
    const line = ok(attach(sum(), makeEntry("call:abs")));
    expect(text(line)).toBe("total + abs(i)");
    expect(at(line)?.kind).toBe("call");
  });

  it("an entry where a value is expected fills that input and goes to its first field", () => {
    const line = fill(lineOf(empty()), makeEntry("call:max"));
    expect(text(line)).toBe("max(..., ...)");
    expect(inputAt(line)?.operation).toMatchObject({ fn: "max" });
  });
});

describe("Backspace and switching (U-54)", () => {
  it("at an empty input removes the operator before it, keeping its first input", () => {
    const line = backspace(ok(attach(sum(), op("*"))));
    expect(text(line)).toBe("total + i");
    expect(at(line)).toMatchObject({ name: "i" });
  });

  it("shortens a number, empties a value, and unwraps an operation on its words", () => {
    expect(text(backspace(digits(lineOf(empty()), "15")))).toBe("1");
    expect(text(backspace(digits(lineOf(empty()), "7")))).toBe("...");
    expect(text(backspace(sum()))).toBe("total + ...");
    const wrapped = ok(attach(sum(), makeEntry("call:abs")));
    expect(text(backspace(wrapped))).toBe("total + i");
  });

  it("an operator is switched within its group", () => {
    let line = fill(lineOf(empty()), v("a"));
    line = fill(ok(attach(line, op("<"))), v("b"));
    expect(text(retag(line, line.root.id, { op: "<=" }))).toBe("a <= b");
  });
});

describe("the caret (U-52, U-53)", () => {
  it("stops after each value and at each empty input, left to right", () => {
    const line = ok(attach(sum(), op("*")));
    expect(stops(line.root).map((id) => find(line.root, id)?.node.kind)).toEqual([
      "var",
      "var",
      "empty",
      "binop",
      "binop",
    ]);
    expect(at(move(line, -1))).toMatchObject({ name: "i" });
    const filled = fill(lineOf(empty()), makeEntry("call:max"));
    expect(move(filled, 1, true).caret.at).not.toBe(filled.caret.at);
  });

  it("the value before the caret is the largest one ending there", () => {
    let line = fill(lineOf(empty()), v("a"));
    line = fill(ok(attach(line, op("<"))), v("b"));
    expect(valueBefore(line)?.id).toBe(line.root.id);
    expect(valueBefore(lineOf(empty()))).toBeUndefined();
  });
});
