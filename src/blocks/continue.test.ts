import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { ast, runAll, varData, hints } from "./testing";
import { blockNotation } from "./registry";

const { cont, for_, assign, num, v, bin, while_, program } = ast;

describe("continue (blocks.md)", () => {
  it("emits `continue`", () => {
    expect(emit(program([for_("i", num(0), num(3), [cont()])]), {}).code).toBe(
      "for i in range(3):\n    continue\n",
    );
  });

  it("skips the rest of the body and moves to the next iteration", () => {
    const result = runAll(
      program([
        assign("n", num(0)),
        for_("i", num(0), num(3), [cont(), assign("n", bin("+", v("n"), num(1)))]),
      ]),
    );
    expect(varData(result, "n")).toBe(0);
    expect(result.done).toMatchObject({ loops: 3 });
  });

  it("re-evaluates a while condition", () => {
    const result = runAll(
      program([
        assign("k", num(3)),
        while_(bin(">", v("k"), num(0)), [
          assign("k", bin("-", v("k"), num(1))),
          cont(),
          assign("k", num(100)),
        ]),
      ]),
    );
    expect(varData(result, "k")).toBe(0);
  });
});

describe("notation (blocks.md, Notation)", () => {
  it("declares the hint of each slot of its table", () => {
    expect(hints("continue")).toEqual([]);
  });

  it("writes the notation of its table", () => {
    expect(blockNotation(cont())).toBe("continue");
  });
});
