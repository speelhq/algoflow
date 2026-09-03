// Runs a program to completion in the interpreter and reports the C-10 view of the result.
import { toData } from "@/lang/data";
import type { Data, Id, Program } from "@/lang/types";
import { run } from "@/runtime/run";
import type { Done } from "@/runtime/types";

export type Outcome = {
  done: Done;
  stdout: string[];
  vars: Record<Id, Data>;
  draws: number[];
};

export function execute(program: Program, inputs: Record<Id, Data>, seed: number): Outcome {
  const runner = run(program, inputs, seed);
  for (;;) {
    const next = runner.next();
    if (next.type === "done" || next.type === "error") {
      const state = runner.state();
      const vars: Record<Id, Data> = {};
      for (const [name, value] of state.frames[0]?.vars ?? [])
        vars[name] = toData(value, state.heap);
      return { done: next, stdout: runner.stdout(), vars, draws: runner.draws() };
    }
  }
}
