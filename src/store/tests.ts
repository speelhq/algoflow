// U-61 Tests tab, C-10..C-12, C-15: `Run all` judges every test on its own runner in R-11
// batches; `Run with this input` plays the test in the driver and judges that run.
import { create } from "zustand";
import { getChallenge } from "@/challenges";
import { judge, type TestResult } from "@/challenges/judge";
import type { Test } from "@/challenges/types";
import type { Program } from "@/lang/types";
import { advanceAsync, outcomeOf } from "@/runtime/outcome";
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
  const done = await advanceAsync(runner, BATCH);
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

  const guarded = async (mine: number, work: () => Promise<void>) => {
    set({ running: true });
    try {
      await work();
    } finally {
      if (mine === generation) set({ running: false });
    }
  };

  return {
    results: [],
    running: false,
    cleared: false,

    runTest(index) {
      const target = current();
      const test = target?.tests[index];
      if (!target || !test) return Promise.resolve();
      const mine = ++generation;
      useRun.getState().selectTest(index);
      return guarded(mine, async () => {
        const outcome = await useRun.getState().runToEnd();
        if (mine !== generation || !outcome) return;
        record(index, judge(test, outcome), target.tests.length);
      });
    },

    runAll() {
      const target = current();
      if (!target) return Promise.resolve();
      const mine = ++generation;
      return guarded(mine, async () => {
        for (const [index, test] of target.tests.entries()) {
          const result = await evaluate(target.program, test);
          if (mine !== generation) return;
          record(index, result, target.tests.length);
        }
      });
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
