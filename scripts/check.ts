// C-02, R-20, T-06: schema, validation, interpreter, and CPython agreement for
// every challenge (or the files given as arguments), then the i18n check (T-08).
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dataEquals } from "@/lang/data";
import type { Data } from "@/lang/types";
import { emit } from "@/python/emit";
import { checkChallengeSchema, type Challenge, type Test } from "./lib/challenge";
import { runPython } from "./lib/cpython";
import { checkI18n, formatReport } from "./lib/i18n-check";
import { execute } from "./lib/interp";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const files =
  args.length > 0
    ? args.map((a) => resolve(a))
    : readdirSync(join(root, "challenges"))
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(root, "challenges", f));

function describeMismatch(kind: string, expected: unknown, actual: unknown): string {
  return `${kind}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}

/** C-10 for one test: interpreter result against `expect`, then CPython against the interpreter (E-07). */
function checkTest(challenge: Challenge, test: Test, index: number): string[] {
  const label = `test[${index}] "${test.name.en}"`;
  const problems: string[] = [];
  const seed = test.seed ?? 1;
  const outcome = execute(challenge.solution, test.inputs, seed);
  if (outcome.done.type === "error") {
    return [
      `${label}: interpreter ${outcome.done.error.code} at ${outcome.done.error.nodeId} ${JSON.stringify(outcome.done.error.params)}`,
    ];
  }
  for (const [name, expected] of Object.entries(test.expect.variables ?? {})) {
    if (!(name in outcome.vars)) problems.push(`${label}: variable ${name} was never assigned`);
    else if (!dataEquals(expected, outcome.vars[name] ?? null))
      problems.push(`${label}: ${describeMismatch(name, expected, outcome.vars[name])}`);
  }
  if (test.expect.stdout && !sameLines(test.expect.stdout, outcome.stdout)) {
    problems.push(`${label}: ${describeMismatch("stdout", test.expect.stdout, outcome.stdout)}`);
  }

  const program = {
    ...challenge.solution,
    inputs: challenge.solution.inputs.map((input) => ({
      name: input.name,
      value: Object.hasOwn(test.inputs, input.name) ? (test.inputs[input.name] ?? null) : input.value,
    })),
  };
  const python = runPython(emit(program).code, outcome.draws, Object.keys(outcome.vars));
  if ("error" in python) return [...problems, `${label}: python3 failed: ${python.error}`];
  if (!sameLines(outcome.stdout, python.stdout))
    problems.push(`${label}: CPython ${describeMismatch("stdout", outcome.stdout, python.stdout)}`);
  for (const [name, value] of Object.entries(outcome.vars)) {
    const theirs: Data | undefined = python.vars[name];
    if (theirs === undefined) problems.push(`${label}: CPython has no variable ${name}`);
    else if (!dataEquals(value, theirs))
      problems.push(`${label}: CPython ${describeMismatch(name, value, theirs)}`);
  }
  return problems;
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

let failed = 0;
const orders = new Map<string, Map<number, string>>();
for (const file of files) {
  const id = basename(file, ".json");
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    console.log(`FAIL ${id}: ${error instanceof Error ? error.message : String(error)}`);
    failed += 1;
    continue;
  }
  const { challenge, problems } = checkChallengeSchema(json, id);
  if (challenge) {
    const seen = orders.get(challenge.track) ?? new Map<number, string>();
    const other = seen.get(challenge.order);
    if (other)
      problems.push(`order ${challenge.order} in ${challenge.track} is also used by ${other}`);
    seen.set(challenge.order, id);
    orders.set(challenge.track, seen);
    challenge.tests.forEach((test, i) => problems.push(...checkTest(challenge, test, i)));
  }
  if (problems.length === 0) {
    console.log(
      `ok   ${id} (${challenge?.tests.length ?? 0} tests, interpreter and CPython agree)`,
    );
  } else {
    failed += 1;
    console.log(`FAIL ${id}`);
    for (const problem of problems) console.log(`     ${problem}`);
  }
}
console.log(`challenges: ${files.length - failed}/${files.length} ok`);

const i18n = checkI18n({ root, srcDir: join(root, "src"), i18nDir: join(root, "src", "i18n") });
for (const line of formatReport(i18n)) console.log(line);
const i18nFailed = i18n.unknown.length + i18n.missing.length > 0;

process.exit(failed > 0 || i18nFailed ? 1 : 0);
