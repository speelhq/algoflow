// Submit judges every test on its own runner.
import { beforeEach, describe, expect, it } from "vitest";
import { findChallenge } from "@/challenges";
import { ast, program } from "@/blocks/testing";
import { useProgress } from "./progress";
import { useProgram } from "./program";
import { useRun } from "./run";
import { useSubmission } from "./submission";

const { assign, num, bin, print, str } = ast;

const fizzbuzz = () => {
  const challenge = findChallenge("fizzbuzz");
  if (!challenge) throw new Error("fizzbuzz missing");
  return challenge;
};

describe("submission store", () => {
  beforeEach(() => {
    useRun.getState().stop();
    useSubmission.getState().reset();
  });

  it("Submit judges every test of the challenge and sets accepted when all pass", async () => {
    useProgram.setState({ program: fizzbuzz().solution });
    await useSubmission.getState().submit();
    const s = useSubmission.getState();
    expect(s.results).toEqual([{ status: "pass" }, { status: "pass" }, { status: "pass" }]);
    expect(s.accepted).toBe(true);
    expect(s.submitting).toBe(false);
  });

  it("a wrong program fails with expected and actual", async () => {
    useProgram.setState({
      program: {
        ...fizzbuzz().solution,
        main: [print(str("nope"))],
      },
    });
    await useSubmission.getState().submit();
    const s = useSubmission.getState();
    expect(s.accepted).toBe(false);
    expect(s.outcomes[1]).toMatchObject({ stdout: ["nope"], vars: { n: 1 } });
    expect(s.results[1]).toEqual({
      status: "fail",
      rows: {
        output: [{ line: 1, actual: "nope", expected: "1", differs: true }],
        variables: [],
      },
    });
  });

  it("selects the first failing test, and a chip selects another judged one", async () => {
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [print(str("1"))] } });
    await useSubmission.getState().submit();
    // n = 15 fails, n = 1 passes ("1"), n = 3 fails.
    expect(useSubmission.getState().results.map((r) => r.status)).toEqual(["fail", "pass", "fail"]);
    expect(useSubmission.getState().selected).toBe(0);
    useSubmission.getState().selectTest(2);
    expect(useSubmission.getState().selected).toBe(2);
    useSubmission.getState().selectTest(7);
    expect(useSubmission.getState().selected).toBe(2);
    useSubmission.getState().reset();
    expect(useSubmission.getState().selected).toBe(0);
  });

  it("verdicts appear once every test is judged; Submit again clears the previous ones", async () => {
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [print(str("1"))] } });
    await useSubmission.getState().submit();
    useSubmission.getState().selectTest(2);
    const judging = useSubmission.getState().submit();
    expect(useSubmission.getState()).toMatchObject({
      results: [],
      outcomes: [],
      submitting: true,
      accepted: false,
      selected: 0,
    });
    await judging;
    expect(useSubmission.getState()).toMatchObject({ submitting: false, selected: 0 });
    expect(useSubmission.getState().results).toHaveLength(3);
  });

  it("an accepted submission leaves the first chip selected", async () => {
    useProgram.setState({ program: fizzbuzz().solution });
    await useSubmission.getState().submit();
    expect(useSubmission.getState().selected).toBe(0);
  });

  it("a submission is recorded; an accepted one solves the problem for good", async () => {
    useProgress.setState({ entries: {} });
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [print(str("nope"))] } });
    await useSubmission.getState().submit();
    expect(useProgress.getState().entries.fizzbuzz?.status).toBe("attempted");
    useProgram.setState({ program: fizzbuzz().solution });
    await useSubmission.getState().submit();
    expect(useProgress.getState().entries.fizzbuzz?.status).toBe("solved");
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [print(str("nope"))] } });
    await useSubmission.getState().submit();
    expect(useProgress.getState().entries.fizzbuzz?.status).toBe("solved");
  });

  it("a runtime error is reported in the row", async () => {
    const div = bin("/", num(1), num(0));
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [assign("x", div)] } });
    await useSubmission.getState().submit();
    expect(useSubmission.getState().results[0]).toEqual({
      status: "error",
      error: { nodeId: div.id, code: "E_DIV_ZERO", params: {} },
    });
  });

  it("a change of the program during a submission abandons it; nothing is recorded", async () => {
    useProgress.setState({ entries: {} });
    useProgram.setState({ program: fizzbuzz().solution });
    const judging = useSubmission.getState().submit();
    useProgram.setState({ program: { ...fizzbuzz().solution } });
    await judging;
    expect(useSubmission.getState()).toMatchObject({ results: [], submitting: false });
    expect(useProgress.getState().entries).toEqual({});
  });

  it("a program with a diagnostic is not judged, as Run does not start", async () => {
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [print(ast.empty())] } });
    await useSubmission.getState().submit();
    expect(useSubmission.getState()).toMatchObject({ results: [], submitting: false });
  });

  it("a program of no challenge is not judged; a change of the program clears the results", async () => {
    useProgram.setState({ program: program([print(str("x"))]) });
    await useSubmission.getState().submit();
    expect(useSubmission.getState().results).toEqual([]);
    useProgram.setState({ program: fizzbuzz().solution });
    await useSubmission.getState().submit();
    expect(useSubmission.getState().accepted).toBe(true);
    useProgram.setState({ program: program([]) });
    expect(useSubmission.getState()).toMatchObject({ results: [], outcomes: [], accepted: false });
  });
});
