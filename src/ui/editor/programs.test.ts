// Open in Playground; Export's file name and Import's validation.
import { describe, expect, it } from "vitest";
import { ast, program, withInputs } from "@/nodes/testing";
import { emit } from "@/python/emit";
import { exportName, importedProgram, playgroundCopy } from "./programs";

const { print, v } = ast;

describe("whole-program actions", () => {
  it("each input becomes an assignment of the case's value, titled as asked", () => {
    const made = withInputs({ n: 15, name: "Ada", nums: [4, 9] }, [print(v("n"), v("name"))]);
    const copy = playgroundCopy(made.program, "FizzBuzz", made.inputs);
    expect(copy.title).toBe("FizzBuzz");
    expect(copy.inputs).toEqual([]);
    expect(emit(copy, {}).code).toBe(emit(made.program, made.inputs).code);
    expect(copy.main).toHaveLength(4);
  });

  it("an input no block can write is refused, not dropped", () => {
    // No dict block exists yet, so a dict cannot be written as an assignment.
    const made = withInputs({ d: { a: 1 } }, [print(v("d"))]);
    expect(() => playgroundCopy(made.program, "Dicts", made.inputs)).toThrow(
      'no block writes the value of input d: {"a":1}',
    );
  });

  it("Export writes <title>.algoflow.json, an empty title as the untitled name", () => {
    expect(exportName("Squares", "Untitled")).toBe("Squares.algoflow.json");
    expect(exportName("  ", "Untitled")).toBe("Untitled.algoflow.json");
  });

  it("Import accepts a program that migrates and rejects anything else", () => {
    const p = program([print(v("x"))]);
    expect(importedProgram(JSON.stringify(p))).toEqual(p);
    expect(importedProgram("{nope")).toBeUndefined();
    expect(importedProgram(JSON.stringify({ version: 9 }))).toBeUndefined();
  });
});
