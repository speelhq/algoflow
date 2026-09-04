// R-11: Step, Play, Run to end, Back, Stop; R-12: driver state; R-10: Back replays identically.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChallenge } from "@/challenges";
import { ast, program, runAll } from "@/nodes/testing";
import { useProgram } from "./program";
import { BATCH, canRun, SPEED, TRACE_LIMIT, useRun } from "./run";

const { assign, num, bin, v, print, for_, if_, str } = ast;

const counting = () => program([for_("i", num(0), num(3), [print(v("i"))])]);

describe("run store (R-11, R-12)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRun.getState().stop();
    useProgram.setState({ program: counting() });
  });
  afterEach(() => vi.useRealTimers());

  it("starts idle with R-12 fields empty", () => {
    expect(useRun.getState()).toMatchObject({
      status: "idle",
      step: 0,
      lastEvent: null,
      state: null,
      events: [],
      stdout: [],
      done: null,
      speed: SPEED.default,
    });
  });

  it("Step: one next() per call, state refreshed each time", () => {
    const store = useRun.getState();
    store.stepOnce();
    const first = useRun.getState();
    expect(first.status).toBe("paused");
    expect(first.step).toBe(1);
    expect(first.lastEvent).toMatchObject({ type: "enter" });
    expect(first.state?.frames).toHaveLength(1);
    store.stepOnce();
    expect(useRun.getState().step).toBe(2);
    expect(useRun.getState().lastEvent).toMatchObject({ type: "loop", var: "i" });
    expect(useRun.getState().state?.frames[0]?.vars.get("i")).toEqual({ t: "int", v: 0 });
  });

  it("Play: next() every 1000/speed ms; setSpeed re-arms the timer and clamps to [1, 50]", () => {
    const store = useRun.getState();
    store.play();
    expect(useRun.getState().status).toBe("playing");
    vi.advanceTimersByTime(100);
    expect(useRun.getState().step).toBe(1);
    vi.advanceTimersByTime(99);
    expect(useRun.getState().step).toBe(1);
    store.setSpeed(50);
    vi.advanceTimersByTime(20);
    expect(useRun.getState().step).toBe(2);
    store.setSpeed(0);
    expect(useRun.getState().speed).toBe(1);
    store.setSpeed(999);
    expect(useRun.getState().speed).toBe(50);
    store.pause();
    expect(useRun.getState().status).toBe("paused");
    vi.advanceTimersByTime(1000);
    expect(useRun.getState().step).toBe(2);
  });

  it("Play runs to done and reports loops; a finished run ignores Step and Play", () => {
    useRun.getState().play();
    vi.advanceTimersByTime(100 * 20);
    const s = useRun.getState();
    expect(s.status).toBe("done");
    expect(s.done).toEqual({ type: "done", steps: 10, loops: 3 });
    expect(s.stdout).toEqual(["0", "1", "2"]);
    useRun.getState().stepOnce();
    useRun.getState().play();
    expect(useRun.getState().step).toBe(10);
  });

  it("Run to end: batches of 2000 with setTimeout(0) between them", async () => {
    useProgram.setState({ program: program([for_("i", num(0), num(1500), [print(v("i"))])]) });
    const promise = useRun.getState().runToEnd();
    expect(useRun.getState().step).toBe(BATCH);
    expect(useRun.getState().status).toBe("playing");
    await vi.advanceTimersByTimeAsync(0);
    expect(useRun.getState().step).toBe(2 * BATCH);
    await Promise.all([promise, vi.runAllTimersAsync()]);
    const s = useRun.getState();
    expect(s.status).toBe("done");
    expect(s.step).toBe(4501);
    expect(s.stdout).toHaveLength(1500);
    expect(s.events).toHaveLength(TRACE_LIMIT);
  });

  it("Pause cancels a run to end", async () => {
    useProgram.setState({ program: program([for_("i", num(0), num(1500), [print(v("i"))])]) });
    const promise = useRun.getState().runToEnd();
    useRun.getState().pause();
    await Promise.all([promise, vi.runAllTimersAsync()]);
    expect(useRun.getState()).toMatchObject({ status: "paused", step: BATCH });
  });

  it("Back: a fresh runner advanced step-1 times reproduces the same events (R-10)", () => {
    const reference = runAll(useProgram.getState().program).events;
    const store = useRun.getState();
    for (let i = 0; i < 5; i += 1) store.stepOnce();
    expect(useRun.getState().lastEvent).toEqual(reference[4]);
    store.back();
    const s = useRun.getState();
    expect(s.step).toBe(4);
    expect(s.status).toBe("paused");
    expect(s.lastEvent).toEqual(reference[3]);
    expect(s.stdout).toEqual(["0"]);
    expect(s.events.map((row) => row.step)).toEqual([2]); // enter, loop, enter, print
    store.seek(0);
    expect(useRun.getState()).toMatchObject({ step: 0, lastEvent: null, stdout: [] });
    useRun.getState().back();
    expect(useRun.getState().step).toBe(0);
  });

  it("Back from a finished run resumes paused; seek past the end finishes again", () => {
    void useRun.getState().runToEnd();
    expect(useRun.getState().status).toBe("done");
    useRun.getState().back();
    expect(useRun.getState()).toMatchObject({ status: "paused", step: 9 });
    useRun.getState().seek(99);
    expect(useRun.getState()).toMatchObject({ status: "done", step: 10 });
  });

  it("Stop discards the runner and resets the driver state", () => {
    const store = useRun.getState();
    store.play();
    vi.advanceTimersByTime(300);
    store.stop();
    expect(useRun.getState()).toMatchObject({
      status: "idle",
      step: 0,
      lastEvent: null,
      state: null,
      events: [],
      stdout: [],
      verdicts: {},
      done: null,
    });
    vi.advanceTimersByTime(1000);
    expect(useRun.getState().step).toBe(0);
  });

  it("R-12 error: the run ends with the error and its params", () => {
    const div = bin("/", num(1), num(0));
    useProgram.setState({ program: program([assign("x", div)]) });
    useRun.getState().play();
    vi.advanceTimersByTime(500);
    const s = useRun.getState();
    expect(s.status).toBe("error");
    expect(s.done).toEqual({
      type: "error",
      error: { nodeId: div.id, code: "E_DIV_ZERO", params: {} },
      steps: 1,
    });
    expect(s.state?.frames).toHaveLength(1);
  });

  it("R-01: a program with diagnostics never starts", () => {
    useProgram.setState({ program: program([print(v("ghost"))]) });
    expect(canRun(useProgram.getState().program)).toBe(false);
    useRun.getState().stepOnce();
    useRun.getState().play();
    expect(useRun.getState().status).toBe("idle");
  });

  it("Trace: last 500 rows, columns in first-assignment order starting with inputs", () => {
    useProgram.setState({
      program: program([for_("i", num(0), num(600), [assign("x", bin("*", v("i"), v("n")))])], {
        inputs: [{ name: "n", value: 2 }],
      }),
    });
    void useRun.getState().runToEnd();
    const s = useRun.getState();
    expect(s.events).toHaveLength(TRACE_LIMIT);
    expect(s.columns).toEqual(["n", "i", "x"]);
    expect(s.events.at(-1)).toMatchObject({ cells: { x: "1198" } });
    expect(s.events[0]?.step).toBeGreaterThan(1);
  });

  it("U-38 verdicts: a compare sets its frame header's mark; entering the frame clears it", () => {
    const frame = if_(bin("==", v("i"), num(1)), [print(v("i"))]);
    useProgram.setState({ program: program([for_("i", num(0), num(2), [frame])]) });
    const store = useRun.getState();
    // enter for, loop, enter if, compare(false), loop, enter if, compare(true), enter print, print
    store.seek(4);
    expect(useRun.getState().verdicts).toEqual({ [frame.id]: false });
    store.seek(6);
    expect(useRun.getState().verdicts).toEqual({});
    store.seek(7);
    expect(useRun.getState().verdicts).toEqual({ [frame.id]: true });
  });

  it("U-60 test selector: the selected test supplies inputs and seed; a new program resets it", () => {
    const fizzbuzz = getChallenge("fizzbuzz");
    if (!fizzbuzz) throw new Error("fizzbuzz missing");
    useProgram.setState({ program: fizzbuzz.solution });
    useRun.getState().selectTest(1);
    void useRun.getState().runToEnd();
    expect(useRun.getState().stdout).toEqual(["1"]);
    useProgram.setState({ program: program([print(str("x"))]) });
    expect(useRun.getState()).toMatchObject({ status: "idle", testIndex: 0 });
  });
});
