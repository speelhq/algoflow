// The slot clicked, else the first to fill, takes the keyboard; keys in a value line, Tab past its last field, `,` in a list; a handler's changes chain on what each returns.
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { ast } from "@/blocks/testing";
import { allEntries } from "./entries";
import { fieldsOf, startField, type Field } from "./fields";
import type { LineContext } from "./line";
import {
  commit,
  focusField,
  follow,
  openSession,
  pickRow,
  settleWord,
  stepHighlight,
  chain,
  chooseRow,
  textEnded,
  valueKey,
  type Session,
  type Transition,
} from "./session";

const { assign, assignTo, print, num, bin, v, empty } = ast;

const ctx: LineContext = {
  variables: ["x", "total"],
  kinds: new Map<string, Kind>([["x", "number"]]),
  scope: { functions: [] },
  functions: [],
  target: null,
};

/** Each key of `keys` pressed in turn, every press on the session the one before left. */
const press = (session: Session, keys: string): Transition => {
  let transition: Transition = { session, edits: [] };
  for (const key of keys) {
    transition = chain(transition, (s) => valueKey(s, { key, shiftKey: false }, [], ctx, ""));
  }
  return transition;
};

describe("editor session", () => {
  it("the slot clicked takes the keyboard, else the first field still to fill", () => {
    const hole = empty();
    const stmt = assign("total", bin("+", v("x"), hole));
    const fields = fieldsOf(stmt);
    expect(fields).toEqual([
      { slot: "target", role: "expr" },
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

  it("in a target's line, Enter choosing a whole target moves on; an item to fill stays", () => {
    const targetCtx: LineContext = {
      ...ctx,
      target: { asked: ["total"], names: ["x"], binds: true },
    };
    const stmt = assignTo(empty(), num(1));
    const field: Field = { slot: "target", role: "expr" };
    const enter = { key: "Enter", shiftKey: false };
    const total = { kind: "variable", name: "total" } as const;
    const highlighted = { ...openSession(stmt, field, null), highlight: 0 };
    const chosen = valueKey(highlighted, enter, [total], targetCtx, "←");
    expect(chosen.after).toEqual({ go: 1 });
    expect(chosen.edits).toMatchObject([{ field, root: { kind: "var", name: "total" } }]);
    // A name filling an item's position completes the target and moves on too.
    const position = empty();
    const atPosition = openSession(
      assignTo(ast.item(v("x"), position), num(1)),
      field,
      position.id,
    );
    expect(pickRow(atPosition, total, targetCtx).after).toEqual({ go: 1 });
    // A choice that leaves an input to fill, or one the target refuses, keeps the keyboard.
    const parentheses = pickRow(openSession(stmt, field, null), { kind: "parentheses" }, targetCtx);
    expect(parentheses.after).toBeUndefined();
    const text = allEntries().find((entry) => entry.id === "str");
    if (!text) throw new Error("no Text");
    const named = openSession(assignTo(v("x"), num(1)), field, null);
    const refused = pickRow(named, { kind: "entry", entry: text }, targetCtx);
    expect(refused.after).toBeUndefined();
    expect(refused.edits).toEqual([]);
    // A value slot never moves on.
    const value: Field = { slot: "value", role: "expr" };
    const blank = assign("y", empty());
    const valueOpen = { ...openSession(blank, value, null), highlight: 0 };
    expect(valueKey(valueOpen, enter, [total], ctx, "").after).toBeUndefined();
  });

  it("Backspace in an empty text field removes the text, leaving its input to fill", () => {
    const stmt = print(empty());
    const field: Field = { slot: "args", role: "expr", index: 0 };
    const text = allEntries().find((entry) => entry.id === "str");
    if (!text) throw new Error("no Text");
    // `Text` opens an empty field, as the learner chooses it.
    const editing = chooseRow(openSession(stmt, field, null), { kind: "entry", entry: text }, ctx);
    expect(editing.session.line?.text).toBeDefined();
    const transition = textEnded(editing.session, "Backspace", ctx);
    expect(transition.session.line?.root.kind).toBe("empty");
    expect(transition.session.line?.text).toBeUndefined();
    expect(transition.edits.at(-1)?.root.kind).toBe("empty");
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
    const target: Field = { slot: "target", role: "expr" };
    expect(focusField(session, stmt, target, null)).toMatchObject({
      focus: target,
      line: { root: { kind: "var", name: "total" }, selected: true },
    });
    // A field the statement no longer has, an item removed by an undo, leaves the keyboard.
    const second: Field = { slot: "args", role: "expr", index: 1 };
    const two = print(num(1), num(2));
    const one = print(num(1));
    one.id = two.id;
    expect(follow(openSession(two, second, null), one)).toMatchObject({ focus: null, line: null });
  });

  it("↓ and ↑ wrap round the list, and `chain` keeps both transitions' values in order", () => {
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
