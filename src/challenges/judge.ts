// C-10, C-11: one test verdict, shared by the Tests tab and scripts/check.ts.
import { dataEquals } from "@/lang/data";
import type { Data, Id } from "@/lang/types";
import type { Outcome } from "@/runtime/outcome";
import type { RuntimeError } from "@/runtime/types";
import type { Test } from "./types";

export type Mismatch =
  | { kind: "variable"; name: Id; expected: Data; actual: Data | undefined }
  | { kind: "stdout"; expected: string[]; actual: string[] };

export type TestResult =
  | { status: "pass" }
  | { status: "fail"; mismatches: Mismatch[] }
  | { status: "error"; error: RuntimeError };

export function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

export function judge(test: Test, outcome: Outcome): TestResult {
  if (outcome.done.type === "error") return { status: "error", error: outcome.done.error };
  const mismatches: Mismatch[] = [];
  for (const [name, expected] of Object.entries(test.expect.variables ?? {})) {
    const actual = Object.hasOwn(outcome.vars, name) ? outcome.vars[name] : undefined;
    if (actual === undefined || !dataEquals(expected, actual)) {
      mismatches.push({ kind: "variable", name, expected, actual });
    }
  }
  if (test.expect.stdout && !sameLines(test.expect.stdout, outcome.stdout)) {
    mismatches.push({ kind: "stdout", expected: test.expect.stdout, actual: outcome.stdout });
  }
  return mismatches.length === 0 ? { status: "pass" } : { status: "fail", mismatches };
}
