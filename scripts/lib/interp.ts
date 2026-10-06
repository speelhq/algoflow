// Runs a program to completion in the interpreter and reports the result the judge compares.
import type { Data, Id, Program } from "@/lang/types";
import { advance, outcomeOf, type Outcome } from "@/runtime/outcome";
import { run } from "@/runtime/run";

export function execute(program: Program, inputs: Record<Id, Data>, seed: number): Outcome {
  const runner = run(program, inputs, seed);
  const done = advance(runner, Number.POSITIVE_INFINITY);
  if (!done)
    throw new Error(
      "unreachable: an unbounded advance always finishes, at the latest at the step limit",
    );
  return outcomeOf(runner, done);
}
