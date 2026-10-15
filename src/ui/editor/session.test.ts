// The slot clicked, else the first to fill, takes the keyboard; keys in a value line, Tab past its last field, `,` in a list; a handler's changes chain on what each returns.
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { ast } from "@/nodes/testing";
import { allEntries } from "./entries";
import { fieldsOf, startField, type Field } from "./fields";
import type { LineContext } from "./line";
import {
  commit,
  focusField,
  follow,
  openSession,
  settleWord,
  stepHighlight,
  chain,
  chooseRow,
  textEnded,
  valueKey,
  type Session,
  type Step,
} from "./session";

const { assign, assignTo, print, num, bin, v, empty } = ast;

const ctx: LineContext = {
  variables: ["x", "total"],
  kinds: new Map<string, Kind>([["x", "number"]]),
  scope: { functions: [] },
  functions: [],
};

/** Each key of `keys` pressed in turn, every press on the session the one before left. */
const press = (session: Session, keys: string): Step => {
  let step: Step = { session, edits: [] };
  for (const key of keys) {
    step = chain(step, (s) => valueKey(s, { key, shiftKey: false }, [], ctx, ""));
  }
  return step;
};

describe("editor session", () => {
  it("the slot clicked takes the keyboard, else the first field still to fill", () => {
    const hole = empty();
    const stmt = assign("total", bin("+", v("x"), hole));
    const fields = fieldsOf(stmt);
    expect(fields).toEqual([
      { slot: "target", role: "target" },
      { slot: "value", role: "expr" },
    ]);
    expect(startField(stmt, fields, { slot: null, hole: null })).toEqual(fields[1]);
    expect(startField(stmt, fields, { slot: "target", hole: null })).toEqual(fields[0]);
    const opened = openSession(stmt, fields[1] ?? null, hole.id);
    expect(opened.line?.caret).toEqual({ at: hole.id });
  });

  it("a value typed is written once, when it changes the field's value", () => {
    const stmt = print(empty());
    const field: Field = { slot: "args", role: "expr", index: 0 };
    const typed = press(openSession(stmt, field, null), "7");
    expect(typed.edits).toHaveLength(1);
    expect(typed.edits[0]).toMatchObject({ field, root: { kind: "num", value: 7 } });
    const line = typed.session.line;
    expect(line && commit(typed.session, line).edits).toEqual([]);
  });

  it("`,` in a list item chooses the word and asks for the next item; the chain reads what it returned", () => {
    const stmt = print(empty());
    const field: Field = { slot: "args", role: "expr", index: 0 };
    const word = press(openSession(stmt, field, null), "x");
    expect(word.edits).toEqual([]);
    const comma = valueKey(word.session, { key: ",", shiftKey: false }, [], ctx, "");
    expect(comma.after).toEqual({ addItem: 1 });
    expect(comma.edits).toMatchObject([{ field, root: { kind: "var", name: "x" } }]);
    // Leaving the line from the session the key returned writes nothing more; from the session
    // before it, the word would be chosen and written a second time.
    expect(settleWord(comma.session, ctx).edits).toEqual([]);
    expect(settleWord(word.session, ctx).edits).toHaveLength(1);
  });

  it("Tab past the line's last field leaves for the next field; Enter with nothing chosen closes", () => {
    const stmt = assign("total", num(1));
    const field: Field = { slot: "value", role: "expr" };
    const session = openSession(stmt, field, null);
    expect(valueKey(session, { key: "Tab", shiftKey: false }, [], ctx, "").after).toEqual({
      go: 1,
    });
    expect(valueKey(session, { key: "Enter", shiftKey: false }, [], ctx, "").after).toBe("close");
    expect(valueKey(session, { key: "Escape", shiftKey: false }, [], ctx, "").taken).toBe(false);
  });

  it("a key the line refuses after its value, beginning the words after the field, moves on", () => {
    const stmt = assign("total", num(1));
    const field: Field = { slot: "value", role: "expr" };
    const typed = press(openSession(stmt, field, null), "x").session;
    expect(valueKey(typed, { key: "]", shiftKey: false }, [], ctx, "]").after).toEqual({ go: 1 });
    // Words that do not begin with the key, or a key the line takes, stay in the line.
    expect(valueKey(typed, { key: "]", shiftKey: false }, [], ctx, ")").after).toBeUndefined();
    expect(valueKey(typed, { key: "+", shiftKey: false }, [], ctx, "+").after).toBeUndefined();
  });

  it("Backspace at an empty part of a target, nothing typed, sets the target to its variable", () => {
    const stmt = assignTo(ast.item(v("nums"), empty()), num(0));
    const part: Field = { slot: "target", role: "expr", part: "index" };
    const back = { key: "Backspace", shiftKey: false };
    expect(valueKey(openSession(stmt, part, null), back, [], ctx, "]").after).toBe("variable");
    // A word or a bracket still typed is removed first.
    for (const keys of ["jx", "("]) {
      const typed = press(openSession(stmt, part, null), keys).session;
      const step = valueKey(typed, back, [], ctx, "]");
      expect(step.after).toBeUndefined();
      expect(step.session.line).not.toEqual(typed.line);
    }
    // A value line that is no part of a target leaves the empty value as it is.
    const value: Field = { slot: "value", role: "expr" };
    const blank = assign("total", empty());
    expect(valueKey(openSession(blank, value, null), back, [], ctx, "").after).toBeUndefined();
  });

  it("Backspace in an empty text field removes the text, leaving its input to fill", () => {
    const stmt = print(empty());
    const field: Field = { slot: "args", role: "expr", index: 0 };
    const text = allEntries().find((entry) => entry.id === "str");
    if (!text) throw new Error("no Text");
    // `Text` opens an empty field, as the learner chooses it.
    const editing = chooseRow(openSession(stmt, field, null), { kind: "entry", entry: text }, ctx);
    expect(editing.session.line?.text).toBeDefined();
    const step = textEnded(editing.session, "Backspace", ctx);
    expect(step.session.line?.root.kind).toBe("empty");
    expect(step.session.line?.text).toBeUndefined();
    expect(step.edits.at(-1)?.root.kind).toBe("empty");
    // Once the field has ended, Backspace from it removes nothing more.
    const ended = textEnded(editing.session, "Enter", ctx).session;
    expect(textEnded(ended, "Backspace", ctx).session.line?.root.kind).toBe("str");
  });

  it("a value changed elsewhere reopens the line; focusing a field opens its value", () => {
    const stmt = assign("total", num(1));
    const field: Field = { slot: "value", role: "expr" };
    const session = openSession(stmt, field, null);
    expect(follow(session, stmt)).toBe(session);
    const undone = assign("total", num(2));
    undone.id = stmt.id;
    expect(follow(session, undone).line?.root).toMatchObject({ kind: "num", value: 2 });
    const target: Field = { slot: "target", role: "target" };
    expect(focusField(session, stmt, target, null)).toMatchObject({ focus: target, line: null });
    // A field the statement no longer has, a target's part after an undo, leaves the keyboard.
    const part: Field = { slot: "target", role: "expr", part: "index" };
    const item = assignTo(ast.item(v("nums"), num(0)), num(1));
    const plain = assign("nums", num(1));
    plain.id = item.id;
    expect(follow(openSession(item, part, null), plain)).toMatchObject({ focus: null, line: null });
  });

  it("↓ and ↑ wrap round the list, and `chain` keeps both steps' values in order", () => {
    const session = openSession(print(empty()), null, null);
    expect(stepHighlight(session, 3, null, 1).highlight).toBe(0);
    expect(stepHighlight(session, 3, null, -1).highlight).toBe(2);
    expect(stepHighlight(session, 3, 2, 1).highlight).toBe(0);
    const stmt = print(empty());
    const field: Field = { slot: "args", role: "expr", index: 0 };
    const both = chain(press(openSession(stmt, field, null), "1"), (s) => press(s, "2"));
    expect(both.edits.map((edit) => edit.root)).toMatchObject([{ value: 1 }, { value: 12 }]);
  });
});
