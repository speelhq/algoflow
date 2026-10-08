// What a key does in a value line (U-50, U-53, U-54, U-93), as a pure function of the line,
// the word being typed, and a pending `=` or `!`. Keys that name an entry (`*`, `%`, `==`)
// insert it as the chart writes it; a key typed again extends it (`*` then `*` is `**`).
import type { MessageKey } from "@/i18n/t";
import { kindOf } from "@/lang/kinds";
import type { Expr, Kind } from "@/lang/types";
import { isEmptyExpr } from "@/lang/walk";
import {
  attach,
  backspace,
  close,
  digit,
  fill,
  find,
  inputAt,
  inputsOf,
  move,
  open,
  rebind,
  retag,
  sign,
  valueBefore,
  type Line,
} from "./line";
import { entryRows, kindsOf, type Row } from "./list";

export type LineState = {
  line: Line;
  /** Letters typed and not yet chosen (U-50). */
  draft: string;
  /** A `=` or `!` waiting for the `=` that makes `==` or `!=`. */
  pending: "" | "=" | "!";
  /** Why the last key was refused, shown in the explanation line. */
  message?: MessageKey;
};

export type Outcome =
  | { state: LineState }
  /** Enter with nothing to choose: the editor closes. */
  | { close: true }
  /** `,` in a list of values: the next item opens. */
  | { nextItem: true }
  | { unhandled: true };

export function stateOf(line: Line): LineState {
  return { line, draft: "", pending: "" };
}

const at = (state: LineState): Expr | undefined => find(state.line.root, state.line.caret.at)?.node;

/** Whether the caret is at an input to fill. */
export function atInput(state: LineState): boolean {
  return isEmptyExpr(at(state));
}

/** The kind of the value before the caret (L-59), from the variables' kinds. */
export function kindBefore(state: LineState, kinds: ReadonlyMap<string, Kind>): Kind | undefined {
  const before = valueBefore(state.line);
  return before ? kindOf(before, kinds) : undefined;
}

/** Chooses a row of the list (U-53): it fills the input, or follows the value before the caret. */
export function choose(state: LineState, row: Row): LineState {
  const base = { ...state, draft: "", pending: "" as const };
  delete base.message;
  if (row.type === "brackets") return { ...base, line: open(state.line) };
  if (atInput(state)) {
    if (row.type === "entry" && row.after) return state;
    return { ...base, line: fill(state.line, row.make()) };
  }
  if (row.type !== "entry" || !row.after) return state;
  const edit = attach(state.line, row.make());
  if ("refused" in edit) return { ...state, message: `error.${edit.refused}` };
  return { ...base, line: edit };
}

/** The entry a typed key names, the one for the kind before the caret first (`+` on lists). */
function keyed(keys: string, kind: Kind | undefined): Extract<Row, { type: "entry" }> | undefined {
  const named = entryRows().filter((row) => row.keys === keys);
  return named.find((row) => kind !== undefined && kindsOf(row).includes(kind)) ?? named[0];
}

/** The operation whose last input, still empty, holds the caret, when its preset is `preset`. */
function justTyped(
  state: LineState,
  preset: Record<string, unknown> | undefined,
): Expr | undefined {
  const inside = inputAt(state.line);
  if (!inside || !preset || !isEmptyExpr(inside.input)) return undefined;
  const inputs = inputsOf(inside.operation);
  if (inputs[inputs.length - 1]?.id !== inside.input.id) return undefined;
  const bag = inside.operation as unknown as Record<string, unknown>;
  return Object.entries(preset).every(([slot, value]) => bag[slot] === value)
    ? inside.operation
    : undefined;
}

/**
 * The key typed after a key that names an entry: when the caret still sits in the fresh
 * input of `first`'s operation, that operation becomes `second`'s (`<` then `=` is `≤`).
 */
function extend(
  state: LineState,
  first: string,
  second: string,
  kind?: Kind,
): LineState | undefined {
  const was = keyed(first, kind);
  const operation = justTyped(state, was?.preset);
  const next = keyed(second, kind);
  if (!operation || !next?.preset) return undefined;
  const retagged = retag(state.line, operation.id, next.preset);
  return { ...state, pending: "", line: rebind(retagged, operation.id) };
}

/** An entry named by its keys, inserted after the value before the caret. */
function insert(state: LineState, keys: string, kinds: ReadonlyMap<string, Kind>): LineState {
  if (atInput(state)) return state;
  const row = keyed(keys, kindBefore(state, kinds));
  return row ? choose(state, row) : state;
}

/** Ends the word being typed: the first exact match among `rows` is chosen, else nothing. */
function commit(state: LineState, rows: readonly Row[]): LineState {
  if (state.draft === "") return state;
  const exact = rows.find((row) =>
    row.type === "variable"
      ? row.name === state.draft
      : row.type === "entry" &&
        (row.keys === state.draft || row.label.toLowerCase() === state.draft),
  );
  return exact ? choose(state, exact) : state;
}

/**
 * What `key` does. `rows` are the list's rows for the word being typed, the first highlighted;
 * `kinds` are the variables' kinds; `listed` says the slot holds a list of values.
 */
export function press(
  state: LineState,
  key: string,
  rows: readonly Row[],
  kinds: ReadonlyMap<string, Kind>,
  listed = false,
): Outcome {
  const clean: LineState = { ...state };
  delete clean.message;
  const done = (next: LineState): Outcome => ({ state: next });

  if (key.length === 1 && /[A-Za-z_]/.test(key)) {
    return done({ ...clean, pending: "", draft: clean.draft + key });
  }
  if (/^[0-9]$/.test(key) && clean.draft !== "") {
    return done({ ...clean, draft: clean.draft + key });
  }
  if (key === "Backspace") {
    if (clean.draft !== "") return done({ ...clean, draft: clean.draft.slice(0, -1) });
    if (clean.pending !== "") return done({ ...clean, pending: "" });
    return done({ ...clean, line: backspace(clean.line) });
  }
  if (key === "Enter") {
    if (clean.draft !== "" && rows[0]) return done(choose(clean, rows[0]));
    return { close: true };
  }
  if (key === "Tab" || key === "ShiftTab") {
    const committed = commit(clean, rows);
    return done({ ...committed, line: move(committed.line, key === "Tab" ? 1 : -1, true) });
  }
  if (key === "ArrowRight" || key === "ArrowLeft") {
    if (clean.draft !== "") return { unhandled: true };
    return done({ ...clean, line: move(clean.line, key === "ArrowRight" ? 1 : -1) });
  }

  // Every other key ends the word being typed first.
  let s = commit(clean, rows);
  if (s.draft !== "" && key !== " ") return done(s);
  if (key === " ") return done(s);
  const kind = kindBefore(s, kinds);

  if (s.pending !== "") {
    const pending = s.pending;
    s = { ...s, pending: "" };
    if (key === "=") return done(insert(s, `${pending}=`, kinds));
  }
  if (/^[0-9.]$/.test(key)) return done({ ...s, line: digit(s.line, key) });
  switch (key) {
    case "(":
      return done({ ...s, line: open(s.line) });
    case ")":
      return done({ ...s, line: close(s.line) });
    case "-":
      return done(atInput(s) ? { ...s, line: sign(s.line) } : insert(s, "-", kinds));
    case "*":
    case "/":
      return done(extend(s, key, key + key, kind) ?? insert(s, key, kinds));
    case "=":
      return done(
        extend(s, "<", "<=", kind) ?? extend(s, ">", ">=", kind) ?? { ...s, pending: "=" },
      );
    case "!":
      return done({ ...s, pending: "!" });
    case ",":
      return listed ? { nextItem: true } : done(s);
    default:
      return keyed(key, kind) ? done(insert(s, key, kinds)) : { unhandled: true };
  }
}
