// C-10, C-11, C-12, C-16: the Tests tab judges every test and reports Cleared!.
import { beforeEach, describe, expect, it } from "vitest";
import { getChallenge } from "@/challenges";
import { ast, program } from "@/nodes/testing";
import { useProgram } from "./program";
import { useRun } from "./run";
import { useTests } from "./tests";

const { assign, num, bin, print, str } = ast;

const fizzbuzz = () => {
  const challenge = getChallenge("fizzbuzz");
  if (!challenge) throw new Error("fizzbuzz missing");
  return challenge;
};

describe("tests store (C-10..C-12, C-16)", () => {
  beforeEach(() => {
    useRun.getState().stop();
    useTests.getState().reset();
  });

  it("Run all judges every test of the challenge and sets cleared when all pass", async () => {
    useProgram.setState({ program: fizzbuzz().solution });
    await useTests.getState().runAll();
    const s = useTests.getState();
    expect(s.results).toEqual([{ status: "pass" }, { status: "pass" }, { status: "pass" }]);
    expect(s.cleared).toBe(true);
    expect(s.running).toBe(false);
  });

  it("a wrong program fails with expected and actual", async () => {
    useProgram.setState({
      program: {
        ...fizzbuzz().solution,
        main: [print(str("nope"))],
      },
    });
    await useTests.getState().runAll();
    const s = useTests.getState();
    expect(s.cleared).toBe(false);
    expect(s.results[1]).toEqual({
      status: "fail",
      mismatches: [{ kind: "stdout", expected: ["1"], actual: ["nope"] }],
    });
  });

  it("C-11: a runtime error is reported in the row", async () => {
    const div = bin("/", num(1), num(0));
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [assign("x", div)] } });
    await useTests.getState().runAll();
    expect(useTests.getState().results[0]).toEqual({
      status: "error",
      error: { nodeId: div.id, code: "E_DIV_ZERO", params: {} },
    });
  });

  it("Run with this input judges one test and plays it in the driver", async () => {
    useProgram.setState({ program: fizzbuzz().solution });
    await useTests.getState().runTest(1);
    expect(useTests.getState().results).toEqual([null, { status: "pass" }, null]);
    expect(useTests.getState().cleared).toBe(false);
    expect(useRun.getState()).toMatchObject({ status: "done", testIndex: 1, stdout: ["1"] });
  });

  it("free mode and invalid programs are ignored; a new program resets the results", async () => {
    useProgram.setState({ program: program([print(str("x"))]) });
    await useTests.getState().runAll();
    expect(useTests.getState().results).toEqual([]);
    useProgram.setState({ program: fizzbuzz().solution });
    await useTests.getState().runAll();
    expect(useTests.getState().cleared).toBe(true);
    useProgram.setState({ program: program([]) });
    expect(useTests.getState()).toMatchObject({ results: [], cleared: false });
  });
});
