// What a draft's text writes in its slot (`language.md`, Expressions, Drafts): the one rule that
// `validate()` and `migrate()` both read.
import { isParseError, parse, parseArgs, type ParseError } from "@/python/parse";
import type { Expr } from "./types";
import { isTarget, type ExprRole } from "./walk";

/**
 * What `text` writes in a slot of `role`: its value, or why it is none. An `exprs` slot's text is
 * its values separated by commas, and a `target` slot keeps only a target.
 */
export function parseSlotText(
  role: ExprRole,
  text: string,
): { value: Expr | Expr[] } | { error: ParseError | "E_NOT_TARGET" } {
  const parsed = role === "exprs" ? parseArgs(text) : parse(text);
  if (isParseError(parsed)) return { error: parsed };
  if (role === "target" && (Array.isArray(parsed) || !isTarget(parsed))) {
    return { error: "E_NOT_TARGET" };
  }
  return { value: parsed };
}
