// A `Custom…` input's value: an expression limited to literals (numbers, texts, `true`,
// `false`, `none`, lists, and dicts; no variables, operators, or calls), stored as `Data`.
// What a literal is comes from what the parser makes; the value comes from the interpreter.
import { getNode, keyOf } from "@/nodes";
import { newId } from "@/lang/id";
import type { Data, Expr, Program } from "@/lang/types";
import { childSlots } from "@/lang/walk";
import { unparse } from "@/python/emit";
import { isParseError, parse } from "@/python/parse";
import { advance, outcomeOf } from "@/runtime/outcome";
import { run } from "@/runtime/run";
import { typedItem } from "./items";

let containers: Set<string> | undefined;
let values: Set<string> | undefined;

/** The keys the parser gives `[]`, `{}`, and `True`, `False`, `None`, where those blocks exist. */
function keysOf(texts: string[]): Set<string> {
  const keys = new Set<string>();
  for (const text of texts) {
    const parsed = parse(text);
    if (!isParseError(parsed)) keys.add(keyOf(parsed));
  }
  return keys;
}

/** Whether `expr` is a literal: a typed number or text, a value, or a list or dict of literals. */
export function isLiteral(expr: Expr): boolean {
  containers ??= keysOf(["[]", "{}"]);
  values ??= keysOf(["True", "False", "None"]);
  const key = keyOf(expr);
  if (values.has(key)) return true;
  if (containers.has(key)) return childSlots(expr).every((child) => isLiteral(child.expr));
  if (expr.kind === "empty") return false;
  return typedItem(unparse(expr)) !== undefined;
}

/** The `Data` of a literal, as the interpreter computes it; undefined for anything else. */
export function literalData(expr: Expr): Data | undefined {
  if (!isLiteral(expr)) return undefined;
  const assign = getNode("assign").create() as Extract<Program["main"][number], { kind: "assign" }>;
  const program: Program = {
    version: 1,
    title: "",
    inputs: [],
    classes: [],
    functions: [],
    main: [{ ...assign, id: newId(), target: { kind: "var", name: "value" }, value: expr }],
  };
  const runner = run(program, {}, 1);
  const done = advance(runner, 10_000);
  if (!done || done.type !== "done") return undefined;
  return outcomeOf(runner, done).vars.value;
}
