// @vitest-environment jsdom
// C-13: restore from storage, else an empty main; L-55: stored shape and rejection.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Challenge } from "@/challenges/types";
import { ast, program } from "@/nodes/testing";
import { emptyProgram, programKey, restore, useProgram } from "./program";

const { assign, num, print, v } = ast;

const bare: Challenge = {
  id: "bare",
  title: { en: "Bare" },
  difficulty: "easy",
  topics: ["output"],
  description: { en: "" },
  inputs: [{ name: "m", value: 7 }],
  tests: [],
  hints: [],
  solution: program([assign("x", num(0))]),
};

vi.mock("@/challenges", () => ({
  getChallenge: (id: string | undefined) => [bare].find((challenge) => challenge.id === id),
}));

describe("program store (C-13, L-53, L-55)", () => {
  beforeEach(() => localStorage.clear());

  it("starts in free mode with an empty program", () => {
    expect(useProgram.getState().program).toEqual(emptyProgram());
    expect(programKey(undefined)).toBe("algoflow:program:free");
  });

  it("creates an empty main when nothing is stored, with challengeId and inputs set", () => {
    expect(restore("bare")).toEqual({
      ...emptyProgram(),
      challengeId: "bare",
      inputs: [{ name: "m", value: 7 }],
    });
  });

  it("restores the stored program and lets the challenge overwrite challengeId and inputs", () => {
    const stored = {
      ...program([print(v("m"))], { inputs: [{ name: "m", value: 1 }] }),
      title: "Mine",
    };
    localStorage.setItem(programKey("bare"), JSON.stringify(stored));
    const p = restore("bare");
    expect(p.title).toBe("Mine");
    expect(p.main).toEqual(stored.main);
    expect(p.challengeId).toBe("bare");
    expect(p.inputs).toEqual([{ name: "m", value: 7 }]);
  });

  it("ignores a stored value that migrate() rejects", () => {
    localStorage.setItem(programKey("bare"), "{not json");
    expect(restore("bare").main).toEqual([]);
    localStorage.setItem(programKey("bare"), JSON.stringify({ version: 2 }));
    expect(restore("bare").main).toEqual([]);
    localStorage.setItem(programKey("bare"), JSON.stringify({ version: 1, main: [{}] }));
    expect(restore("bare").main).toEqual([]);
  });

  it("free mode restores algoflow:program:free without challengeId or inputs", () => {
    const stored = {
      ...program([assign("k", num(2))], { inputs: [{ name: "n", value: 1 }] }),
      challengeId: "stale",
    };
    localStorage.setItem(programKey(undefined), JSON.stringify(stored));
    const p = restore("free");
    expect(p.main).toEqual(stored.main);
    expect(p.challengeId).toBeUndefined();
    expect(p.inputs).toEqual([]);
  });

  it("load() swaps the program in the store", () => {
    useProgram.getState().load("bare");
    expect(useProgram.getState().program.challengeId).toBe("bare");
    useProgram.getState().load("free");
    expect(useProgram.getState().program.challengeId).toBeUndefined();
    useProgram.getState().load("unknown-id");
    expect(useProgram.getState().program).toEqual(emptyProgram());
  });
});
