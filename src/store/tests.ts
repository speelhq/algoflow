// U-61 Tests tab, C-10..C-12, C-16: every test is judged on its own runner in R-11
// batches; `Run with this input` also plays that test in the driver.
import { create } from "zustand";
import { getChallenge } from "@/challenges";
import { judge, type TestResult } from "@/challenges/judge";
import type { Test } from "@/challenges/types";
import type { Program } from "@/lang/types";
import { advance, outcomeOf } from "@/runtime/outcome";
import { run } from "@/runtime/run";
import { useProgram } from "./program";
import { BATCH, canRun, useRun } from "./run";

export type TestsState = {
  /** One entry per challenge test; null until judged. */
  results: Array<TestResult | null>;
  running: boolean;
  /** C-12: every test judged and passing. */
  cleared: boolean;
  runTest: (index: number) => Promise<void>;
  runAll: () => Promise<void>;
  reset: () => void;
};

let generation = 0;

async function evaluate(program: Program, test: Test): Promise<TestResult> {
  const runner = run(program, test.inputs, test.seed ?? 1);
  let done = advance(runner, BATCH);
  while (!done) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    done = advance(runner, BATCH);
  }
  return judge(test, outcomeOf(runner, done));
}

function current(): { program: Program; tests: Test[] } | null {
  const program = useProgram.getState().program;
  const tests = getChallenge(program.challengeId)?.tests;
  return tests && canRun(program) ? { program, tests } : null;
}

export const useTests = create<TestsState>()((set, get) => {
  const record = (index: number, result: TestResult, count: number) => {
    const results = [...get().results];
    while (results.length < count) results.push(null);
    results[index] = result;
    set({
      results,
      cleared: results.length === count && results.every((r) => r?.status === "pass"),
    });
  };

  return {
    results: [],
    running: false,
    cleared: false,

    async runTest(index) {
      const target = current();
      const test = target?.tests[index];
      if (!target || !test) return;
      const mine = ++generation;
      useRun.getState().selectTest(index);
      set({ running: true });
      const [result] = await Promise.all([
        evaluate(target.program, test),
        useRun.getState().runToEnd(),
      ]);
      if (mine !== generation) return;
      record(index, result, target.tests.length);
      set({ running: false });
    },

    async runAll() {
      const target = current();
      if (!target) return;
      const mine = ++generation;
      set({ running: true });
      for (const [index, test] of target.tests.entries()) {
        const result = await evaluate(target.program, test);
        if (mine !== generation) return;
        record(index, result, target.tests.length);
      }
      set({ running: false });
    },

    reset() {
      generation += 1;
      set({ results: [], running: false, cleared: false });
    },
  };
});

useProgram.subscribe((state, previous) => {
  if (state.program !== previous.program) useTests.getState().reset();
});
