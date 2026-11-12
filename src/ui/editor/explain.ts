// The explanation line at the foot of the editor: what the list highlights or the caret
// is in, as a name and spans of text; undefined leaves the block's help.
import { t } from "@/i18n/t";
import { firstSetters, variableKinds } from "@/lang/kinds";
import type { Expr, Name, Kind, NodeId, Program } from "@/lang/types";
import { getRoutine, isEmptyExpr, routineOf } from "@/lang/walk";
import {
  parenthesized,
  notationOf,
  exprHint,
  exprText,
  placeholderValue,
  notationText,
  filledSpans,
  type NotationSpan,
  SEPARATOR,
} from "@/ui/chart/text";
import { labelOf } from "./entries";
import { PARENTHESES_KEY, find, matches, parentOf, wordRows, type Line } from "./line";
import type { LineContext, Row } from "./choices";

/** A span of an explanation: a span of a block's text, or a key to type. */
export type ExplanationSpan = NotationSpan | { text: string; key: true };

export type Explanation = {
  /** What is explained: a name, as spans, a variable's drawn as a variable; none for a refusal. */
  name: NotationSpan[];
  spans: ExplanationSpan[];
};

/** A help text, each piece in backticks a key to type. */
export function helpSpans(text: string): ExplanationSpan[] {
  return text
    .split("`")
    .map((piece, i): ExplanationSpan =>
      i % 2 === 1 ? { text: piece, key: true } : { text: piece },
    )
    .filter((span) => span.text !== "");
}

const kindName = (kind: Kind) => t(`editor.kind.${kind}`);

/** A variable of the routine that holds statement `at`: its kind and where it is first set. */
export function explainVariable(program: Program, at: NodeId, name: Name): string {
  const routine = routineOf(program, at);
  const def = getRoutine(program, routine);
  const kind = variableKinds(program, routine).get(name);
  if (def === "main") {
    const input = program.inputs.find((candidate) => candidate.name === name);
    if (input) return t("editor.explain.input", { kind: kindName(input.kind) });
  } else if (def.params.includes(name)) return t("editor.explain.parameter");
  const setter = firstSetters(program, routine).get(name);
  if (!setter) return t("editor.explain.newVariable", { name });
  // A counted loop's notation is its init, where its variable first gets a value.
  const statement = notationText(setter, program);
  return kind
    ? t("editor.explain.variable", { kind: kindName(kind), statement })
    : t("editor.explain.variablePlain", { statement });
}

/** A name a list offers: a variable of the routine, or a new one it makes. */
export function explainName(program: Program, at: NodeId, name: Name, isNew: boolean): Explanation {
  const text = isNew
    ? t("editor.explain.newVariable", { name })
    : explainVariable(program, at, name);
  return { name: [{ text: name, variable: true }], spans: [{ text }] };
}

/** A help followed, when keys insert what it explains, by how to type them. */
function typedHelp(help: string, keys: string | undefined): ExplanationSpan[] {
  return helpSpans(keys === undefined ? help : `${help} ${t("editor.typeKeys", { keys })}`);
}

/** The row's explanation. */
function explainRow(row: Row, program: Program, at: NodeId): Explanation {
  switch (row.type) {
    case "variable":
    case "new":
      return explainName(program, at, row.name, row.type === "new");
    case "entry":
      return {
        name: [{ text: row.entry.label }],
        spans: typedHelp(row.entry.help, row.entry.declared.typed),
      };
    case "parentheses":
      return {
        name: [{ text: t("editor.parentheses.label") }],
        spans: typedHelp(t("editor.parentheses.help"), PARENTHESES_KEY),
      };
    case "function":
      return { name: functionLabel(row.fn), spans: [{ text: t("editor.ownFunction") }] };
  }
}

/** A function as the lists name it, a call with each argument its parameter's hint: `double(x)`. */
export function functionLabel(fn: { name: string; params: readonly string[] }): NotationSpan[] {
  const params = fn.params.flatMap((param, i): NotationSpan[] =>
    i === 0 ? [{ text: param, hint: true }] : [{ text: SEPARATOR }, { text: param, hint: true }],
  );
  return [{ text: `${fn.name}(` }, ...params, { text: ")" }];
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
      row.type === "variable"
        ? [row.name]
        : row.type === "entry"
          ? [row.entry.label]
          : row.type === "function"
            ? [row.fn.name]
            : [];
    for (const name of names) {
      const d = distance(line.word, name);
      if (d <= allowed && (!best || d < best.d)) best = { name, d };
    }
  }
  return best?.name;
}

/** The operation one of whose slots holds the caret, and that slot's value. */
function operationAt(line: Line): { operation: Expr; value: Expr } | undefined {
  if (line.selected) return undefined;
  const id = "at" in line.caret ? line.caret.at : line.caret.after;
  const up = parentOf(line.root, id);
  const value = find(line.root, id);
  return up && value ? { operation: up.parent, value } : undefined;
}

/**
 * An operation's notation with the caret's slot underlined and each empty slot as its hint
 * (`blocks.md`, Notation, Drawing).
 */
function operationSpans(operation: Expr, current: Expr, program: Program): NotationSpan[] {
  const written = (value: Expr, index: number | undefined): NotationSpan => {
    const empty = isEmptyExpr(value);
    const text = empty ? exprHint(operation, index, program) : exprText(value, program);
    return {
      text,
      ...(empty ? { hint: true } : {}),
      ...(value === current ? { underline: true } : {}),
    };
  };
  return filledSpans(notationOf(operation), (name) => {
    const held = placeholderValue(operation, name);
    switch (held?.role) {
      case "expr":
        if (!held.expr) return [];
        return parenthesized(held.expr, held)
          ? [{ text: "(" }, written(held.expr, undefined), { text: ")" }]
          : [written(held.expr, undefined)];
      case "exprs":
        return held.items.flatMap((item, i) =>
          i === 0 ? [written(item, i)] : [{ text: SEPARATOR }, written(item, i)],
        );
      case "literal":
      case "operator":
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
  if (line.refused) return { name: [], spans: [{ text: line.refused }] };
  if (line.word !== "" && matches(line, ctx).length === 0) {
    const closest = closestName(line, ctx);
    return {
      name: [{ text: line.word }],
      spans: [
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
    name: [{ text: labelOf(inside.operation, ctx.kinds) }],
    spans: operationSpans(inside.operation, inside.value, program),
  };
}
