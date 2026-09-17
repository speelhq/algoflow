// The C-10 view of a run: final main-level variables as Data, stdout, and draws.
// Shared by the Tests tab, the driver's run-to-end batches (R-11), and scripts/check.ts.
import { toData } from "@/lang/data";
import type { Data, Id } from "@/lang/types";
import type { Done, Runner, State } from "./types";

export type Outcome = {
  done: Done;
  stdout: string[];
  vars: Record<Id, Data>;
  draws: number[];
};

/** Calls `next()` up to `limit` times; returns the `Done` when the run finishes within the batch. */
export function advance(runner: Runner, limit: number): Done | undefined {
  for (let i = 0; i < limit; i += 1) {
    const next = runner.next();
    if (next.type === "done" || next.type === "error") return next;
  }
  return undefined;
}

/** R-11: batches of `batch` events with `setTimeout(0)` between them, until the run finishes. */
export async function advanceAsync(runner: Runner, batch: number): Promise<Done> {
  for (;;) {
    const done = advance(runner, batch);
    if (done) return done;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** The main-level variables as Data: what C-10 compares and the `Result` rows show (U-23). */
export function mainVars(state: State): Record<Id, Data> {
  const vars: Record<Id, Data> = {};
  for (const [name, value] of state.frames[0]?.vars ?? []) vars[name] = toData(value, state.heap);
  return vars;
}

export function outcomeOf(runner: Runner, done: Done): Outcome {
  return { done, stdout: runner.stdout(), vars: mainVars(runner.state()), draws: runner.draws() };
}
