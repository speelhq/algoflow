// U-50: the condition templates as data. Each is a sentence key and the expression it stands
// for, written as Python with the blanks `a` and `b`; matching is structural over each
// block's slots (N-01). What a variable is comes from the parser: the block a bare name
// parses to, with the name in its `id` slot.
import type { MessageKey } from "@/i18n/t";
import type { Expr } from "@/lang/types";
import { isExpr } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes";
import { isParseError, parse } from "@/python/parse";

export type Blank = "a" | "b";
/** `key` is the sentence (U-50); `question` is how a diamond asks it (U-33). */
export type ConditionTemplate = {
  name: string;
  key: MessageKey;
  question: MessageKey;
  python: string;
};
/** `within`: the expression each blank is an operand of (the matched one, or one inside it). */
export type TemplateMatch = {
  template: ConditionTemplate;
  a: Expr;
  b: Expr;
  within: Record<Blank, Expr>;
};

/** In the order of the U-50 table: the first match names the expression (U-50, U-63). */
export const CONDITION_TEMPLATES: readonly ConditionTemplate[] = [
  {
    name: "divisible",
    key: "editor.template.divisible",
    question: "chart.question.divisible",
    python: "a % b == 0",
  },
  {
    name: "equals",
    key: "editor.template.equals",
    question: "chart.question.equals",
    python: "a == b",
  },
  {
    name: "notEquals",
    key: "editor.template.notEquals",
    question: "chart.question.notEquals",
    python: "a != b",
  },
  {
    name: "greater",
    key: "editor.template.greater",
    question: "chart.question.greater",
    python: "a > b",
  },
  { name: "less", key: "editor.template.less", question: "chart.question.less", python: "a < b" },
  {
    name: "atLeast",
    key: "editor.template.atLeast",
    question: "chart.question.atLeast",
    python: "a >= b",
  },
  {
    name: "atMost",
    key: "editor.template.atMost",
    question: "chart.question.atMost",
    python: "a <= b",
  },
  { name: "in", key: "editor.template.in", question: "chart.question.in", python: "a in b" },
];

type Bag = Record<string, unknown>;

const isBlank = (name: string): name is Blank => name === "a" || name === "b";

const patterns = new Map<ConditionTemplate, Expr>();

function patternOf(template: ConditionTemplate): Expr {
  let pattern = patterns.get(template);
  if (!pattern) {
    const parsed = parse(template.python);
    if (isParseError(parsed)) throw new Error(`template ${template.name} does not parse`);
    pattern = parsed;
    patterns.set(template, pattern);
  }
  return pattern;
}

let variableKey: string | undefined;

/** The name of a variable expression, else undefined: a variable is what a bare name parses to. */
export function variableName(expr: Expr): string | undefined {
  if (variableKey === undefined) {
    const parsed = parse("a");
    variableKey = isParseError(parsed) ? "" : keyOf(parsed);
  }
  if (keyOf(expr) !== variableKey) return undefined;
  const slot = getNode(variableKey).slots.find((s) => s.role === "id");
  const name = slot ? (expr as unknown as Bag)[slot.name] : undefined;
  return typeof name === "string" ? name : undefined;
}

type Bound = Partial<Record<Blank, { expr: Expr; within: Expr }>>;

/** Structural match: same block and same `text` / `id` slots; a blank binds any expression. */
function match(pattern: Expr, expr: Expr, within: Expr, blanks: Bound): boolean {
  const name = variableName(pattern);
  if (name !== undefined && isBlank(name)) {
    blanks[name] = { expr, within };
    return true;
  }
  if (keyOf(pattern) !== keyOf(expr)) return false;
  const want = pattern as unknown as Bag;
  const have = expr as unknown as Bag;
  return getNode(keyOf(pattern)).slots.every((slot) => {
    const w = want[slot.name];
    const h = have[slot.name];
    if (slot.role === "expr") return isExpr(w) && isExpr(h) && match(w, h, expr, blanks);
    if (slot.role === "exprs") {
      return (
        Array.isArray(w) &&
        Array.isArray(h) &&
        w.length === h.length &&
        w.every((item, i) => isExpr(item) && isExpr(h[i]) && match(item, h[i], expr, blanks))
      );
    }
    return w === h;
  });
}

/** Every template the expression matches, in table order. */
export function matchTemplates(expr: Expr): TemplateMatch[] {
  const matches: TemplateMatch[] = [];
  for (const template of CONDITION_TEMPLATES) {
    const blanks: Bound = {};
    if (match(patternOf(template), expr, expr, blanks) && blanks.a && blanks.b) {
      matches.push({
        template,
        a: blanks.a.expr,
        b: blanks.b.expr,
        within: { a: blanks.a.within, b: blanks.b.within },
      });
    }
  }
  return matches;
}

/** U-50: the template whose sentence a slot shows for this expression, if any. */
export function matchTemplate(expr: Expr): TemplateMatch | undefined {
  return matchTemplates(expr)[0];
}
