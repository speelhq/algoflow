// Structural checks of a challenge file (used by scripts/check.ts).
// The schema types live in src/challenges/types.ts.
import { DIFFICULTIES, HINTS, TOPICS, type Challenge, type Localized } from "@/challenges/types";
import { dataError } from "@/lang/data";
import { dataKind } from "@/lang/kinds";
import { CURRENT_VERSION, isInputDecl, migrate } from "@/lang/migrate";
import { isRecord } from "@/lang/record";
import type { Data, Kind } from "@/lang/types";
import { isValidName, validate } from "@/lang/validate";
import { isParseError, parseData } from "@/python/parse";

export function isLocalized(value: unknown, requireJa: boolean): value is Localized {
  if (!isRecord(value) || typeof value.en !== "string") return false;
  if (requireJa && typeof value.ja !== "string") return false;
  return value.ja === undefined || typeof value.ja === "string";
}

const isName = (value: unknown): value is string => typeof value === "string" && isValidName(value);

function sameData(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The keys a challenge file may hold. */
const KEYS: ReadonlySet<string> = new Set([
  "id",
  "title",
  "difficulty",
  "topics",
  "description",
  "inputs",
  "tests",
  "hints",
  "takeaway",
  "module",
  "defines",
  "solution",
]);

/** Whether a value is a `Localized` text, as the check requires it. */
type TextCheck = (value: unknown) => value is Localized;

export type SchemaResult = { challenge: Challenge | null; problems: string[] };

/** Validates one challenge file's JSON. `fileId` is the file name without `.json`. */
export function checkChallengeSchema(
  json: unknown,
  fileId: string,
  opts: { requireJa: boolean },
): SchemaResult {
  // A `Localized` text, with its `ja` text when the check requires one (`challenges.md`, Checks).
  const isLocalizedText: TextCheck = (value) => isLocalized(value, opts.requireJa);
  if (!isRecord(json)) return { challenge: null, problems: ["not an object"] };
  const { defines, problems: definitionProblems } = checkDefinitions(json);
  const { inputs, declared, problems: inputProblems } = checkInputs(json);
  const problems = [
    ...checkKeys(json, fileId),
    ...checkPresentation(json, isLocalizedText),
    ...definitionProblems,
    ...inputProblems,
    ...checkTestSchemas(json, declared),
    ...checkHints(json, isLocalizedText),
    ...checkSolution(json, fileId, inputs, defines),
  ];
  return { challenge: problems.length === 0 ? (json as unknown as Challenge) : null, problems };
}

/** The file's id against its name, and every key against the keys a challenge holds. */
function checkKeys(json: Record<string, unknown>, fileId: string): string[] {
  const problems: string[] = [];
  if (json.id !== fileId)
    problems.push(`id "${String(json.id)}" does not match the file name "${fileId}"`);
  for (const key of Object.keys(json)) if (!KEYS.has(key)) problems.push(`unknown key "${key}"`);
  return problems;
}

/** What the challenge shows a learner: its title, difficulty, topics, description, and takeaway. */
function checkPresentation(json: Record<string, unknown>, isLocalizedText: TextCheck): string[] {
  const problems: string[] = [];
  if (!isLocalizedText(json.title)) problems.push("title must be { en, ja? }");
  if (!DIFFICULTIES.some((d) => d === json.difficulty))
    problems.push(
      `difficulty "${String(json.difficulty)}" is not one of ${DIFFICULTIES.join(", ")}`,
    );
  if (!Array.isArray(json.topics) || json.topics.length === 0)
    problems.push("topics must be a non-empty array");
  else
    for (const topic of json.topics)
      if (!TOPICS.some((t) => t === topic))
        problems.push(`topic "${String(topic)}" is not one of ${TOPICS.join(", ")}`);
  if (!isLocalizedText(json.description)) problems.push("description must be { en, ja? }");
  if (json.takeaway !== undefined && !isLocalizedText(json.takeaway))
    problems.push("takeaway must be { en, ja? }");
  return problems;
}

/** `module` and `defines` (`challenges.md`, Modules and definitions), with the names defined. */
function checkDefinitions(json: Record<string, unknown>): {
  defines: string[];
  problems: string[];
} {
  const problems: string[] = [];
  if (json.module !== undefined && !isName(json.module))
    problems.push("module must be a valid name");
  const defines: string[] = [];
  // A class name is refused: no registered block definition constructs an object.
  if (Array.isArray(json.defines) && json.defines.every(isName)) defines.push(...json.defines);
  else if (json.defines !== undefined) problems.push("defines must be an array of function names");
  return { defines, problems };
}

/** The declared inputs, each with a valid name of its own, and the kind of each by its name. */
function checkInputs(json: Record<string, unknown>): {
  inputs: unknown[];
  declared: ReadonlyMap<string, Kind>;
  problems: string[];
} {
  const problems: string[] = [];
  const inputs: unknown[] = Array.isArray(json.inputs) ? json.inputs : [];
  if (!Array.isArray(json.inputs)) problems.push("inputs must be an array");
  const declared = new Map<string, Kind>();
  inputs.forEach((input, i) => {
    if (!isInputDecl(input)) {
      problems.push(`inputs[${i}] must be { name, kind }`);
      return;
    }
    if (!isValidName(input.name))
      problems.push(`inputs[${i}] name "${input.name}" is not a valid name`);
    if (declared.has(input.name)) problems.push(`inputs[${i}] name "${input.name}" is duplicated`);
    declared.set(input.name, input.kind);
  });
  return { inputs, declared, problems };
}

/** The tests: at least 3, at least one an edge test, each well formed (`checkTestSchema`). */
function checkTestSchemas(
  json: Record<string, unknown>,
  declared: ReadonlyMap<string, Kind>,
): string[] {
  const problems: string[] = [];
  const tests: unknown[] = Array.isArray(json.tests) ? json.tests : [];
  if (!Array.isArray(json.tests) || tests.length < 3)
    problems.push("tests must be an array of at least 3");
  tests.forEach((test, i) => problems.push(...checkTestSchema(test, `tests[${i}]`, declared)));
  if (tests.length > 0 && !tests.some((test) => isRecord(test) && test.edge === true))
    problems.push("no test has edge: true");
  return problems;
}

/**
 * One test, reported at `path`: its `edge` and `seed`, every declared input with a value of its
 * kind, and `expect`.
 */
function checkTestSchema(
  test: unknown,
  path: string,
  declared: ReadonlyMap<string, Kind>,
): string[] {
  if (!isRecord(test)) return [`${path} must be an object`];
  const problems: string[] = [];
  if (test.edge !== undefined && typeof test.edge !== "boolean")
    problems.push(`${path}.edge must be a boolean`);
  if (!isRecord(test.inputs)) problems.push(`${path}.inputs must be an object`);
  else problems.push(...checkTestInputs(test.inputs, `${path}.inputs`, declared));
  if (test.seed !== undefined && typeof test.seed !== "number")
    problems.push(`${path}.seed must be a number`);
  if (
    !isRecord(test.expect) ||
    (!isRecord(test.expect.variables) && !Array.isArray(test.expect.stdout))
  ) {
    problems.push(`${path}.expect needs variables and/or stdout`);
  } else if (isRecord(test.expect.variables)) {
    for (const [name, value] of Object.entries(test.expect.variables))
      problems.push(...checkData(value, `${path}.expect.variables.${name}`));
  }
  return problems;
}

/**
 * A test's inputs, reported at `path`: each declared input, as canonical Data of its kind that a
 * block writes, and no other.
 */
function checkTestInputs(
  inputs: Record<string, unknown>,
  path: string,
  declared: ReadonlyMap<string, Kind>,
): string[] {
  const problems: string[] = [];
  for (const [name, kind] of declared) {
    const inputPath = `${path}.${name}`;
    if (!Object.hasOwn(inputs, name)) {
      problems.push(`${path} is missing "${name}"`);
      continue;
    }
    const dataProblems = checkData(inputs[name], inputPath);
    if (dataProblems.length > 0) problems.push(...dataProblems);
    else if (dataKind(inputs[name] as Data) !== kind)
      problems.push(`${inputPath} is not of the kind ${kind}`);
    else if (isParseError(parseData(inputs[name] as Data)))
      problems.push(`${inputPath} is a value no block writes`);
  }
  for (const name of Object.keys(inputs))
    if (!declared.has(name)) problems.push(`${path} has unknown input "${name}"`);
  return problems;
}

/** Checks that a value is canonical Data, and reports its fault at `path`. */
function checkData(value: unknown, path: string): string[] {
  const fault = dataError(value);
  return fault ? [`${path}${fault.at}: ${fault.message}`] : [];
}

/** Exactly `HINTS` hints, each a `Localized` text. */
function checkHints(json: Record<string, unknown>, isLocalizedText: TextCheck): string[] {
  const problems: string[] = [];
  const hints: unknown[] = Array.isArray(json.hints) ? json.hints : [];
  if (!Array.isArray(json.hints) || hints.length !== HINTS) {
    problems.push(`hints must be exactly ${HINTS}`);
  }
  hints.forEach((hint, i) => {
    if (!isLocalizedText(hint)) problems.push(`hints[${i}] must be { en, ja? }`);
  });
  return problems;
}

/**
 * The solution: its version, its inputs, its challenge id, its diagnostics, and a function for
 * each name of `defines`.
 */
function checkSolution(
  json: Record<string, unknown>,
  fileId: string,
  inputs: unknown[],
  defines: readonly string[],
): string[] {
  const problems: string[] = [];
  // The app bundles a solution as it is, with no migrate(), so an older version would reach it.
  if (isRecord(json.solution) && json.solution.version !== CURRENT_VERSION)
    problems.push(`solution.version must be ${CURRENT_VERSION}`);
  try {
    // A copy, because migrate() reads a draft as the value its text writes, while the build bundles
    // the solution as it is: the tests run the solution as the page gets it.
    const program = migrate(structuredClone(json.solution));
    if (!sameData(program.inputs, inputs)) problems.push("solution.inputs must equal inputs");
    if (program.challengeId !== undefined && program.challengeId !== fileId)
      problems.push(`solution.challengeId must be "${fileId}"`);
    for (const d of validate(program))
      problems.push(`solution: ${d.code} at ${d.nodeId} ${JSON.stringify(d.params)}`);
    const own = new Set(program.functions.map((def) => def.name));
    for (const name of defines)
      if (!own.has(name)) problems.push(`solution does not define "${name}"`);
  } catch (error) {
    problems.push(`solution: ${error instanceof Error ? error.message : String(error)}`);
  }
  return problems;
}
