// The block editor's editing session: the field that has the keyboard, its text and selection,
// the value the field holds, the list's highlight, and whether the list shows every entry.
// Every change is a pure transition from one session to the next, returning the values it
// writes.
import type { Stmt } from "@/lang/types";
import { choose, wordAt, type TextLine } from "./caret";
import type { LineContext, Row } from "./choices";
import { fieldDraft, fieldText, textValue, valueOf, type Field, type FieldValue } from "./fields";

export type Session = {
  focus: Field | null;
  /** The focused field's text, as the learner typed it, and its selection. */
  line: TextLine | null;
  /** The value the focused field holds: as it opened, or as its text last wrote it. */
  fieldValue: FieldValue | null;
  highlight: number | null;
  all: boolean;
};

/** A value written into a field. */
export type Edit = { field: Field; value: FieldValue };

/** A transition's result: the next session and the values it writes, in order. */
export type Transition = { session: Session; edits: Edit[] };

const still = (session: Session): Transition => ({ session, edits: [] });

/** Whether a field holds a value: no draft. */
const isValue = (fieldValue: FieldValue | null) =>
  fieldValue !== null && fieldDraft(fieldValue) === undefined;

/** Two values alike apart from their node ids. */
function sameValue(a: FieldValue | null, b: FieldValue | null): boolean {
  const plain = (value: FieldValue | null) =>
    JSON.stringify(value, (key, v) => (key === "id" ? 0 : v));
  return plain(a) === plain(b);
}

/**
 * How a field opens on `value` (`editor.md`, Value line, Selected text): in a block that the block
 * menu has just inserted, with the caret at `insertedCaret`; a draft with the caret at the end of its
 * text; any other value with its text selected.
 */
function openedLine(value: FieldValue, insertedCaret: number | null): TextLine {
  const text = fieldText(value);
  if (insertedCaret !== null) {
    const at = Math.min(insertedCaret, text.length);
    return { text, start: at, end: at };
  }
  const draft = fieldDraft(value) !== undefined;
  return { text, start: draft ? text.length : 0, end: text.length };
}

/** A session on `field` of `stmt`, its line opened as `line` gives, or none. */
function sessionOn(
  stmt: Stmt,
  field: Field | null,
  line: (value: FieldValue) => TextLine,
): Session {
  const value = field ? valueOf(stmt, field) : undefined;
  return {
    focus: value ? field : null,
    line: value ? line(value) : null,
    fieldValue: value ?? null,
    highlight: null,
    all: false,
  };
}

/**
 * The session an editor opens with, on `start`: in a block the block menu has just inserted, with
 * the caret at `insertedCaret`.
 */
export function openSession(
  stmt: Stmt,
  start: Field | null,
  insertedCaret: number | null,
): Session {
  return sessionOn(stmt, start, (value) => openedLine(value, insertedCaret));
}

/** The session while no field has the keyboard: the editor itself or another control has it. */
export const NO_FIELD: Session = {
  focus: null,
  line: null,
  fieldValue: null,
  highlight: null,
  all: false,
};

/**
 * The keyboard moves to `field`, or leaves every field: by Tab, its line opens as a field opens;
 * by a click, with the selection the click made.
 */
export function enterField(
  stmt: Stmt,
  field: Field | null,
  how: "tab" | { start: number; end: number },
): Session {
  return sessionOn(stmt, field, (value) => {
    if (how === "tab") return openedLine(value, null);
    return { text: fieldText(value), ...how };
  });
}

/** The session over `stmt` as it is now: a value changed elsewhere (an undo) reopens the line. */
export function followStatement(session: Session, stmt: Stmt): Session {
  const { focus, fieldValue } = session;
  if (!focus) return session;
  const value = valueOf(stmt, focus) ?? null;
  if (sameValue(value, fieldValue)) return session;
  // A field the statement no longer has (an optional value taken out, by an undo) leaves the
  // keyboard.
  if (!value) return { ...session, focus: null, line: null, fieldValue: null };
  const text = fieldText(value);
  return { ...session, line: { text, start: text.length, end: text.length }, fieldValue: value };
}

/**
 * The field's text changes, and writes its value once an input method's composition ends
 * (`editor.md`, Value line, Keys).
 */
export function changeText(session: Session, typed: TextLine, composing: boolean): Transition {
  const { focus, fieldValue } = session;
  if (!focus) return still(session);
  const next: Session = { ...session, line: typed, highlight: null };
  if (composing) return still(next);
  const value = textValue(typed.text, focus.role);
  if (sameValue(value, fieldValue)) return still(next);
  return { session: { ...next, fieldValue: value }, edits: [{ field: focus, value }] };
}

/** The caret moves, or the selection changes, as the field reports it. */
export function selectText(session: Session, start: number, end: number): Session {
  const { line } = session;
  if (!line || (line.start === start && line.end === end)) return session;
  return { ...session, line: { ...line, start, end } };
}

/** The word being typed at the caret, or "" with no field focused. */
export function sessionWord(session: Session): string {
  return session.line ? wordAt(session.line).text : "";
}

/** The highlight shown in a list of `count` rows: the one moved to, else the first match of a word. */
export function shownHighlight(session: Session, count: number): number | null {
  const { highlight } = session;
  if (highlight !== null && highlight < count) return highlight;
  return sessionWord(session) !== "" && count > 0 ? 0 : null;
}

/** A row of the list highlighted by the pointer. */
export function highlightRow(session: Session, index: number): Session {
  return { ...session, highlight: index };
}

/** ↓ or ↑ in a list of `count` rows, from the highlight shown: one row on, wrapping round. */
export function stepHighlight(
  session: Session,
  count: number,
  shown: number | null,
  step: 1 | -1,
): Session {
  if (count === 0) return session;
  const next = shown === null ? (step > 0 ? 0 : count - 1) : (shown + step + count) % count;
  return { ...session, highlight: next };
}

/** What a key in a value line leaves to the editor: closing it, or another field. */
export type After = "close" | { go: 1 | -1 };

/** A key pressed in the focused value line; `taken` is false when the field keeps it. */
export type KeyTransition = Transition & { taken: boolean; after?: After };

const taken = (transition: Transition, after?: After): KeyTransition =>
  after === undefined ? { ...transition, taken: true } : { ...transition, taken: true, after };

/**
 * A row chosen by Enter or a click writes its text at the caret (`editor.md`, Value list,
 * Choosing). In a target's line, a choice that leaves a target moves on to the next field
 * (`editor.md`, Targets).
 */
export function pickRow(session: Session, row: Row, ctx: LineContext): KeyTransition {
  const { line } = session;
  const chosen = line ? choose(line, row, ctx.kinds) : undefined;
  if (!chosen) return taken(still(session));
  const changed = changeText(session, chosen, false);
  const target = session.focus?.role === "target" && isValue(changed.session.fieldValue);
  return taken(changed, target ? { go: 1 } : undefined);
}

/**
 * A key the focused value line acts on, which a text field doesn't: ↑ and ↓ move the list's
 * highlight, Enter chooses the highlighted row or else closes the editor, Tab and Shift+Tab move to
 * the next and previous field while `moves` says the notation has one (`editor.md`, Value list;
 * Block editor). `rows` is the value list shown under the line, and every other key is the
 * field's: Tab past the last field among them, which leaves the notation.
 */
export function valueKey(
  session: Session,
  key: { key: string; shiftKey: boolean },
  rows: readonly Row[],
  ctx: LineContext,
  moves: (step: 1 | -1) => boolean,
): KeyTransition {
  const { line } = session;
  const left: KeyTransition = { ...still(session), taken: false };
  if (!line) return left;
  const shown = shownHighlight(session, rows.length);
  switch (key.key) {
    case "ArrowDown":
    case "ArrowUp":
      if (rows.length === 0) return left;
      return taken(
        still(stepHighlight(session, rows.length, shown, key.key === "ArrowDown" ? 1 : -1)),
      );
    case "Enter": {
      const row = shown === null ? undefined : rows[shown];
      return row ? pickRow(session, row, ctx) : taken(still(session), "close");
    }
    case "Tab": {
      const step = key.shiftKey ? -1 : 1;
      return moves(step) ? taken(still(session), { go: step }) : left;
    }
    default:
      return left;
  }
}

/** The value list shows every entry. */
export function showAll(session: Session): Session {
  return { ...session, all: true };
}
