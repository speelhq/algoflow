import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { ast, eventTypes, program, runAll, varData } from "./testing";

const { while_, assign, num, bin, v, brk, bool } = ast;
const lines = (main: Parameters<typeof program>[0]) =>
  emit(program(main)).code.trimEnd().split("\n");

describe("while (03-nodes)", () => {
  it("N-03: emits `while <cond>:`", () => {
    expect(
      lines([while_(bin(">", v("k"), num(0)), [assign("k", bin("-", v("k"), num(1)))])]),
    ).toEqual(["while k > 0:", "    k = k - 1"]);
  });

  it("T-02 / R-07: loop event after each true compare", () => {
    const stmt = while_(bin(">", v("k"), num(0)), [assign("k", bin("-", v("k"), num(1)))]);
    const result = runAll(program([assign("k", num(2)), stmt]));
    expect(eventTypes(result.events)).toEqual([
      "enter",
      "write",
      "enter",
      "compare",
      "loop",
      "enter",
      "write",
      "compare",
      "loop",
      "enter",
      "write",
      "compare",
    ]);
    expect(result.events[4]).toEqual({ type: "loop", nodeId: stmt.id });
    expect(varData(result, "k")).toBe(0);
    expect(result.done).toMatchObject({ loops: 2 });
  });

  it("T-02: break leaves the loop", () => {
    const result = runAll(
      program([
        assign("n", num(0)),
        while_(bool(true), [assign("n", bin("+", v("n"), num(1))), brk()]),
      ]),
    );
    expect(varData(result, "n")).toBe(1);
  });
});
