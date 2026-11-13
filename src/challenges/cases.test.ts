// The chosen case gives the values of a program's inputs, and its seed.
import { describe, expect, it } from "vitest";
import { ast } from "@/blocks/testing";
import { caseInputs, findCase } from "./cases";
import { findChallenge } from "./index";
import { testSeed } from "./types";

const { program } = ast;

describe("the chosen case", () => {
  const fizzbuzz = findChallenge("fizzbuzz");
  if (!fizzbuzz) throw new Error("fizzbuzz missing");

  it("is the test at the case index of the program's challenge", () => {
    expect(findCase(fizzbuzz.solution, 1)).toBe(fizzbuzz.tests[1]);
    expect(caseInputs(fizzbuzz.solution, 1)).toEqual({ n: 1 });
    expect(findCase(program([]), 0)).toBeUndefined();
  });

  it("gives a program with no challenge no values, and fails for one that declares inputs", () => {
    expect(caseInputs(program([]), 0)).toEqual({});
    const declared = program([], { inputs: [{ name: "n", kind: "number" }] });
    expect(() => caseInputs(declared, 0)).toThrow(/no case 0 gives the inputs/);
    expect(() => caseInputs(fizzbuzz.solution, 9)).toThrow(/no case 9/);
  });
});

describe("the seed of a run", () => {
  it("is the test's own, else 1, and 1 for a run with no test", () => {
    const test = { inputs: {}, expect: { stdout: [] } };
    expect(testSeed({ ...test, seed: 7 })).toBe(7);
    expect(testSeed(test)).toBe(1);
    expect(testSeed(undefined)).toBe(1);
  });
});
