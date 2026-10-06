// U-05: Open in Playground; L-53: Export's file name and Import's validation.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { emit } from "@/python/emit";
import { exportName, importedProgram, playgroundCopy } from "./programs";

const { print, v } = ast;

describe("whole-program actions", () => {
  it("U-05, E-03: each input becomes an assignment at the top of main, titled as asked", () => {
    const p = {
      ...program([print(v("n"), v("name"))], {
        inputs: [
          { name: "n", value: 15 },
          { name: "name", value: "Ada" },
        ],
      }),
      challengeId: "fizzbuzz",
    };
    const copy = playgroundCopy(p, "FizzBuzz");
    expect(copy.title).toBe("FizzBuzz");
    expect(copy.inputs).toEqual([]);
    expect(emit(copy).code).toBe(emit(p).code);
    expect(copy.main).toHaveLength(3);
  });

  it("L-53: Export writes <title>.algoflow.json, an empty title as the untitled name", () => {
    expect(exportName("Squares", "Untitled")).toBe("Squares.algoflow.json");
    expect(exportName("  ", "Untitled")).toBe("Untitled.algoflow.json");
  });

  it("L-53: Import accepts a program that migrates and rejects anything else", () => {
    const p = program([print(v("x"))]);
    expect(importedProgram(JSON.stringify(p))).toEqual(p);
    expect(importedProgram("{nope")).toBeUndefined();
    expect(importedProgram(JSON.stringify({ version: 9 }))).toBeUndefined();
  });
});
