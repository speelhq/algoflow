// Runs a program to completion in the interpreter and reports the C-10 view of the result.
import type { Data, Id, Program } from "@/lang/types";
import { advance, outcomeOf, type Outcome } from "@/runtime/outcome";
import { run } from "@/runtime/run";

export type { Outcome } from "@/runtime/outcome";

export function execute(program: Program, inputs: Record<Id, Data>, seed: number): Outcome {
  const runner = run(program, inputs, seed);
  const done = advance(runner, Number.POSITIVE_INFINITY);
  if (!done) throw new Error("unreachable: an unbounded advance always finishes (L-31)");
  return outcomeOf(runner, done);
}
