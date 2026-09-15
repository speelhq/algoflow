// @vitest-environment jsdom
// C-13: restore from storage, else starter, else an empty main; L-55: stored shape and rejection.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Challenge } from "@/challenges/types";
import { ast, program } from "@/nodes/testing";
import { emptyProgram, programKey, restore, useProgram } from "./program";

const { assign, num, print, v } = ast;

const withStarter: Challenge = {
  id: "with-starter",
  title: { en: "With starter" },
  difficulty: "easy",
  topics: ["output"],
  description: { en: "" },
  inputs: [{ name: "n", value: 3 }],
  tests: [],
  hints: [],
  starter: { ...program([assign("x", num(0))], { inputs: [{ name: "n", value: 3 }] }), title: "S" },
  solution: program([]),
};
const bare: Challenge = {
  ...withStarter,
  id: "bare",
  title: { en: "Bare" },
  inputs: [{ name: "m", value: 7 }],
  starter: undefined,
};

vi.mock("@/challenges", () => ({
  getChallenge: (id: string | undefined) =>
    [withStarter, bare].find((challenge) => challenge.id === id),
}));

describe("program store (C-13, L-53, L-55)", () => {
  beforeEach(() => localStorage.clear());

  it("starts in free mode with an empty program", () => {
    expect(useProgram.getState().program).toEqual(emptyProgram());
    expect(programKey(undefined)).toBe("algoflow:program:free");
  });

  it("creates from starter when nothing is stored, with challengeId and inputs set", () => {
    const p = restore("with-starter");
    expect(p.challengeId).toBe("with-starter");
    expect(p.inputs).toEqual([{ name: "n", value: 3 }]);
    expect(p.main).toEqual(withStarter.starter?.main);
    expect(p.main).not.toBe(withStarter.starter?.main); // a copy, never the bundled object
  });

  it("creates an empty main when there is no starter", () => {
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
    localStorage.setItem(programKey("with-starter"), JSON.stringify({ version: 1, main: [{}] }));
    expect(restore("with-starter").main).toEqual(withStarter.starter?.main);
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
