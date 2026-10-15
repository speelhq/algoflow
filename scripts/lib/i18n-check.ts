// Every `t("...")` literal key in src/ must exist in en.json, and every en.json key must be
// named in src/ (`pages.md`, Catalogs); once ja.json exists, both catalogs must have the same
// key set. Each file is read with oxc-parser, so comments are not read.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSync, Visitor, type Expression, type TemplateLiteral } from "oxc-parser";
import { ERROR_CODES } from "@/i18n/codes";
import { flatten } from "@/i18n/flatten";
import { errorKey, blockPrefix } from "@/i18n/t";
import { BLOCKS } from "@/blocks/registry";
import { lineOf, lineStarts } from "./lines";

export type Source = { file: string; text: string };
export type Usage = { file: string; line: number; key: string };
export type Missing = { locale: string; key: string };
export type I18nReport = {
  keys: number;
  usages: number;
  unknown: Usage[];
  unused: string[];
  missing: Missing[];
};
/** What one file says about keys: its `t("…")` calls, its whole strings, and its families. */
export type Scan = { usages: Usage[]; literals: string[]; patterns: RegExp[] };

/** The sources scanned: `src/` code, tests and declarations aside. */
const SOURCE = /^src\/.*\.(ts|tsx)$/;
const SKIP = /(\.test\.(ts|tsx)|\.d\.ts)$/;

/** The expressions a value can be: itself, or a branch of a conditional or logical expression. */
function outcomes(expr: Expression): Expression[] {
  switch (expr.type) {
    case "ParenthesizedExpression":
      return outcomes(expr.expression);
    case "ConditionalExpression":
      return [...outcomes(expr.consequent), ...outcomes(expr.alternate)];
    case "LogicalExpression":
      return [...outcomes(expr.left), ...outcomes(expr.right)];
    default:
      return [expr];
  }
}

/**
 * A template literal's text as a pattern, each placeholder standing for one segment; none for a
 * text that begins with a placeholder, which would match every key.
 */
function templatePattern(template: TemplateLiteral): RegExp | undefined {
  const fixed = template.quasis.map((quasi) =>
    (quasi.value.cooked ?? quasi.value.raw).replace(/[.*+?^$()|[\]\\{}]/g, "\\$&"),
  );
  if (fixed[0] === "") return undefined;
  return new RegExp(`^${fixed.join("[^.]+")}$`);
}

export function scan(source: Source): Scan {
  const result = parseSync(source.file, source.text);
  const [error] = result.errors;
  if (error) throw new Error(`${source.file}: ${error.message}`);
  const starts = lineStarts(source.text);
  const found: Scan = { usages: [], literals: [], patterns: [] };
  new Visitor({
    Literal(node) {
      if (typeof node.value === "string") found.literals.push(node.value);
    },
    TemplateLiteral(node) {
      const [only] = node.quasis;
      if (node.expressions.length === 0 && only)
        found.literals.push(only.value.cooked ?? only.value.raw);
    },
    CallExpression(node) {
      const [arg] = node.arguments;
      if (node.callee.type !== "Identifier" || node.callee.name !== "t") return;
      if (!arg || arg.type === "SpreadElement") return;
      if (arg.type === "Literal" && typeof arg.value === "string") {
        found.usages.push({ file: source.file, line: lineOf(starts, arg.start), key: arg.value });
      }
      for (const outcome of outcomes(arg)) {
        const pattern = outcome.type === "TemplateLiteral" ? templatePattern(outcome) : undefined;
        if (pattern) found.patterns.push(pattern);
      }
    },
  }).visit(result.program);
  return found;
}

/** Whether `key` is one the code builds from data: a registered block's, or an error code's. */
function builtFromData(): (key: string) => boolean {
  const prefixes = [...BLOCKS.keys()].map(blockPrefix);
  const errors = new Set<string>(ERROR_CODES.map(errorKey));
  return (key) => errors.has(key) || prefixes.some((prefix) => key.startsWith(prefix));
}

/** Checks the keys used in `files` (paths relative to `root`, as `repoFiles` lists them). */
export function checkI18n(opts: {
  root: string;
  files: readonly string[];
  i18nDir: string;
}): I18nReport {
  const en = flatten(JSON.parse(readFileSync(join(opts.i18nDir, "en.json"), "utf8")));
  const enKeys = new Set(Object.keys(en));

  const scans = opts.files
    .filter((file) => SOURCE.test(file) && !SKIP.test(file))
    .map((file) => scan({ file, text: readFileSync(join(opts.root, file), "utf8") }));
  const usages = scans.flatMap((s) => s.usages);
  const unknown = usages.filter((u) => !enKeys.has(u.key));
  const literals = new Set(scans.flatMap((s) => s.literals));
  const patterns = scans.flatMap((s) => s.patterns);
  const built = builtFromData();
  const named = (key: string) =>
    literals.has(key) || patterns.some((pattern) => pattern.test(key)) || built(key);
  const unused = [...enKeys].filter((key) => !named(key));

  const missing: Missing[] = [];
  const jaPath = join(opts.i18nDir, "ja.json");
  if (existsSync(jaPath)) {
    const ja = flatten(JSON.parse(readFileSync(jaPath, "utf8")));
    const jaKeys = new Set(Object.keys(ja));
    for (const key of enKeys) if (!jaKeys.has(key)) missing.push({ locale: "ja", key });
    for (const key of jaKeys) if (!enKeys.has(key)) missing.push({ locale: "en", key });
  }

  return { keys: enKeys.size, usages: usages.length, unknown, unused, missing };
}

export function formatReport(report: I18nReport): string[] {
  const lines = report.unknown.map((u) => `${u.file}:${u.line} unknown key "${u.key}"`);
  for (const key of report.unused) lines.push(`en.json unused key "${key}"`);
  for (const m of report.missing) lines.push(`${m.locale}.json missing key "${m.key}"`);
  lines.push(
    `i18n: ${report.keys} keys, ${report.usages} usages, ${lines.length === 0 ? "ok" : `${lines.length} problem(s)`}`,
  );
  return lines;
}
