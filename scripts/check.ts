// C-02, R-20, T-06: schema, validation, interpreter, and CPython agreement for
// every challenge (or the files given as arguments), then the i18n check (T-08).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { judge, sameLines } from "@/challenges/judge";
import type { Challenge, Test } from "@/challenges/types";
import { dataEquals } from "@/lang/data";
import type { Data } from "@/lang/types";
import { emit } from "@/python/emit";
import { checkChallengeSchema } from "./lib/challenge";
import { runPython } from "./lib/cpython";
import { checkI18n, formatReport } from "./lib/i18n-check";
import { execute } from "./lib/interp";
import { checkPlans } from "./lib/plans";

const root = fileURLToPath(new URL("..", import.meta.url));
const PLANS_FILE = "plans.json";
const args = process.argv.slice(2);
/** T-08, U-71: `ja` texts become mandatory in every file once the Japanese catalog exists. */
const requireJa = existsSync(join(root, "src", "i18n", "ja.json"));
/** Every challenge file on disk; `plans.json` sits beside them and is checked separately (C-16). */
const allFiles = readdirSync(join(root, "challenges"))
  .filter((f) => f.endsWith(".json") && f !== PLANS_FILE)
  .toSorted()
  .map((f) => join(root, "challenges", f));
const files =
  args.length > 0
    ? args.map((a) => resolve(a)).filter((f) => basename(f) !== PLANS_FILE)
    : allFiles;

function describeMismatch(kind: string, expected: unknown, actual: unknown): string {
  return `${kind}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}

/** C-10 for one test: interpreter result against `expect`, then CPython against the interpreter (E-07). */
function checkTest(challenge: Challenge, test: Test, index: number): string[] {
  const label = `test[${index}] "${test.name.en}"`;
  const problems: string[] = [];
  const seed = test.seed ?? 1;
  const outcome = execute(challenge.solution, test.inputs, seed);
  const verdict = judge(test, outcome);
  if (verdict.status === "error") {
    const { code, nodeId, params } = verdict.error;
    return [`${label}: interpreter ${code} at ${nodeId} ${JSON.stringify(params)}`];
  }
  if (verdict.status === "fail") {
    for (const m of verdict.mismatches) {
      if (m.kind === "stdout")
        problems.push(`${label}: ${describeMismatch("stdout", m.expected, m.actual)}`);
      else if (m.actual === undefined)
        problems.push(`${label}: variable ${m.name} was never assigned`);
      else problems.push(`${label}: ${describeMismatch(m.name, m.expected, m.actual)}`);
    }
  }

  const program = {
    ...challenge.solution,
    inputs: challenge.solution.inputs.map((input) => ({
      name: input.name,
      value: Object.hasOwn(test.inputs, input.name)
        ? (test.inputs[input.name] ?? null)
        : input.value,
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

let failed = 0;
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
  const { challenge, problems } = checkChallengeSchema(json, id, { requireJa });
  if (challenge)
    challenge.tests.forEach((test, i) => problems.push(...checkTest(challenge, test, i)));
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
if (files.length > 0) console.log(`challenges: ${files.length - failed}/${files.length} ok`);

// C-16, C-18: the plans against every challenge file on disk, whatever files were given.
{
  const knownIds = new Set(allFiles.map((f) => basename(f, ".json")));
  let plansProblems: string[];
  let count = { plans: 0, problems: 0 };
  /** S-05: challenges in no plan are legitimate, but a forgotten `plans.json` entry looks the same. */
  let orphans: string[] = [];
  try {
    const json: unknown = JSON.parse(readFileSync(join(root, "challenges", PLANS_FILE), "utf8"));
    const result = checkPlans(json, knownIds, { requireJa });
    plansProblems = result.problems;
    if (result.plans) {
      const plans = result.plans;
      count = {
        plans: plans.length,
        problems: plans.reduce((n, plan) => n + plan.problems.length, 0),
      };
      orphans = [...knownIds].filter((id) => !plans.some((plan) => plan.problems.includes(id)));
    }
  } catch (error) {
    plansProblems = [error instanceof Error ? error.message : String(error)];
  }
  if (plansProblems.length === 0) {
    console.log(`ok   plans (${count.plans} plan(s), ${count.problems} problems)`);
    if (orphans.length > 0) console.log(`     in no plan: ${orphans.join(", ")}`);
  } else {
    failed += 1;
    console.log("FAIL plans");
    for (const problem of plansProblems) console.log(`     ${problem}`);
  }
}

const i18n = checkI18n({ root, srcDir: join(root, "src"), i18nDir: join(root, "src", "i18n") });
for (const line of formatReport(i18n)) console.log(line);
const i18nFailed = i18n.unknown.length + i18n.missing.length > 0;

process.exit(failed > 0 || i18nFailed ? 1 : 0);
