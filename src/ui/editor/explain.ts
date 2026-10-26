// The explanation line at the foot of the editor: what the list highlights or the caret
// is in, as a name and runs of text; undefined leaves the block's help.
import { t } from "@/i18n/t";
import { routineOf, firstSetters, variableKinds } from "@/lang/kinds";
import type { Expr, Name, Kind, NodeId, Program } from "@/lang/types";
import { isEmptyExpr } from "@/lang/walk";
import {
  parenthesized,
  notationOf,
  exprText,
  placeholder,
  placeholderValue,
  notationText,
  templateParts,
  type Part,
  SEPARATOR,
} from "@/ui/chart/text";
import { labelOf } from "./entries";
import {
  PARENTHESES_KEY,
  find,
  matches,
  parentOf,
  wordRows,
  type Line,
  type LineContext,
  type Row,
} from "./line";

export type Explanation = {
  /** What is explained: a name, drawn as a variable when it is one. */
  name: string;
  variable?: boolean;
  /** The explanation; a run in backticks is a key to type. */
  parts: Part[];
};

/** A help text, its runs in backticks marked as keys. */
export function helpParts(text: string): Part[] {
  return text
    .split("`")
    .map((piece, i): Part => (i % 2 === 1 ? { text: piece, slot: "key" } : { text: piece }))
    .filter((part) => part.text !== "");
}

const kindName = (kind: Kind) => t(`editor.kind.${kind}`);

/** A variable of the routine that holds statement `at`: its kind and where it is first set. */
export function explainVariable(program: Program, at: NodeId, name: Name): string {
  const routine = routineOf(program, at);
  const fn = program.functions.find((candidate) => candidate.id === routine);
  const kind = variableKinds(program, routine).get(name);
  const input = fn ? undefined : program.inputs.find((candidate) => candidate.name === name);
  if (input) return t("editor.explain.input", { kind: kindName(input.kind) });
  if (fn?.params.includes(name)) return t("editor.explain.parameter");
  const setter = firstSetters(program, routine).get(name);
  if (!setter) return t("editor.explain.newVariable", { name });
  // A counted loop's notation is its init, where its variable first gets a value.
  const statement = notationText(setter);
  return kind
    ? t("editor.explain.variable", { kind: kindName(kind), statement })
    : t("editor.explain.variablePlain", { statement });
}

/** A name a list offers: a variable of the chart, or a new one it makes. */
export function explainName(program: Program, at: NodeId, name: Name, isNew: boolean): Explanation {
  const text = isNew
    ? t("editor.explain.newVariable", { name })
    : explainVariable(program, at, name);
  return { name, variable: true, parts: [{ text }] };
}

/** A help followed, when keys insert what it explains, by how to type them. */
function typedHelp(help: string, keys: string | undefined): Part[] {
  return helpParts(keys === undefined ? help : `${help} ${t("editor.typeKeys", { keys })}`);
}

/** The row's explanation. */
function explainRow(row: Row, program: Program, at: NodeId): Explanation {
  switch (row.kind) {
    case "variable":
    case "new":
      return explainName(program, at, row.name, row.kind === "new");
    case "entry":
      return { name: row.entry.label, parts: typedHelp(row.entry.help, row.entry.menu.keys) };
    case "parentheses":
      return {
        name: t("editor.parentheses"),
        parts: typedHelp(t("editor.parenthesesHelp"), PARENTHESES_KEY),
      };
    case "function":
      return { name: functionLabel(row.fn), parts: [{ text: t("editor.ownFunction") }] };
  }
}

/** A function as the list names it: `name(…)`, or `name()` with no parameter. */
export function functionLabel(fn: { name: string; params: readonly string[] }): string {
  return `${fn.name}(${fn.params.length > 0 ? placeholder() : ""})`;
}

/** The edit distance of two words, ignoring case. */
function distance(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= y.length; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      next.push(Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + cost));
    }
    row = next;
  }
  return row[y.length] ?? 0;
}

/** The closest name to a word that matches nothing: one letter in three may differ, one at least. */
function closestName(line: Line, ctx: LineContext): string | undefined {
  const allowed = Math.max(1, Math.floor(line.word.length / 3));
  let best: { name: string; d: number } | undefined;
  for (const row of wordRows(line, ctx)) {
    const names =
      row.kind === "variable"
        ? [row.name]
        : row.kind === "entry"
          ? [row.entry.label]
          : row.kind === "function"
            ? [row.fn.name]
            : [];
    for (const name of names) {
      const d = distance(line.word, name);
      if (d <= allowed && (!best || d < best.d)) best = { name, d };
    }
  }
  return best?.name;
}

/** The operation whose input holds the caret, and that input. */
function operationAt(line: Line): { operation: Expr; input: Expr } | undefined {
  if (line.selected) return undefined;
  const id = "at" in line.caret ? line.caret.at : line.caret.after;
  const up = parentOf(line.root, id);
  const input = find(line.root, id);
  return up && input ? { operation: up.parent, input } : undefined;
}

/** An operation's notation with the caret's input underlined and every other empty one `…`. */
function operationParts(operation: Expr, current: Expr): Part[] {
  const written = (input: Expr): Part => {
    const text = isEmptyExpr(input) ? placeholder() : exprText(input);
    return input === current ? { text, underline: true } : { text };
  };
  return templateParts(notationOf(operation), (name) => {
    const held = placeholderValue(operation, name);
    switch (held?.role) {
      case "expr":
        if (!held.expr) return [];
        return parenthesized(held.expr, held)
          ? [{ text: "(" }, written(held.expr), { text: ")" }]
          : [written(held.expr)];
      case "exprs":
        return held.items.flatMap((item, i) =>
          i === 0 ? [written(item)] : [{ text: SEPARATOR }, written(item)],
        );
      case "text":
        return [{ text: held.text }];
      default:
        return [];
    }
  });
}

/** The explanation of a value line, with `highlighted` the row the list highlights. */
export function explainLine(
  line: Line,
  ctx: LineContext,
  highlighted: Row | undefined,
  program: Program,
  at: NodeId,
): Explanation | undefined {
  if (line.refused) return { name: "", parts: [{ text: line.refused }] };
  if (line.word !== "" && matches(line, ctx).length === 0) {
    const closest = closestName(line, ctx);
    return {
      name: line.word,
      parts: [
        {
          text: closest ? t("editor.didYouMean", { name: closest }) : t("editor.nothingLike"),
        },
      ],
    };
  }
  if (highlighted) return explainRow(highlighted, program, at);
  const inside = operationAt(line);
  if (!inside) return undefined;
  return {
    name: labelOf(inside.operation, ctx.kinds),
    parts: operationParts(inside.operation, inside.input),
  };
}
