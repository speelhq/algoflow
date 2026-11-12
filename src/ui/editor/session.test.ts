// The slot clicked, else the first field with an empty slot, takes the keyboard; keys in a value line, Tab past its last empty slot, `,` in a list; a handler's changes chain on what each returns.
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
  it("the slot clicked takes the keyboard, else the first field with an empty slot", () => {
    const slot = empty();
    const stmt = assign("total", bin("+", v("x"), slot));
    const fields = fieldsOf(stmt);
    expect(fields).toEqual([{ slot: "target" }, { slot: "value" }]);
    expect(startField(stmt, fields, { slot: null, emptyId: null })).toEqual(fields[1]);
    expect(startField(stmt, fields, { slot: "target", emptyId: null })).toEqual(fields[0]);
    const opened = openSession(stmt, fields[1] ?? null, slot.id);
    expect(opened.line?.caret).toEqual({ at: slot.id });
  });

  it("a value typed is written once, when it changes the field's value", () => {
    const stmt = print(empty());
    const field: Field = { slot: "args", index: 0 };
    const typed = press(openSession(stmt, field, null), "7");
    expect(typed.edits).toHaveLength(1);
    expect(typed.edits[0]).toMatchObject({ field, root: { type: "num", value: 7 } });
    const line = typed.session.line;
    expect(line && commit(typed.session, line).edits).toEqual([]);
  });

  it("`,` in a list item chooses the word and asks for the next item; the chain reads what it returned", () => {
    const stmt = print(empty());
    const field: Field = { slot: "args", index: 0 };
    const word = press(openSession(stmt, field, null), "x");
    expect(word.edits).toEqual([]);
    const comma = valueKey(word.session, { key: ",", shiftKey: false }, [], ctx, "");
    expect(comma.after).toEqual({ addItem: 1 });
    expect(comma.edits).toMatchObject([{ field, root: { type: "var", name: "x" } }]);
    // Leaving the line from the session the key returned writes nothing more; from the session
    // before it, the word would be chosen and written a second time.
    expect(settleWord(comma.session, ctx).edits).toEqual([]);
    expect(settleWord(word.session, ctx).edits).toHaveLength(1);
  });

  it("Tab past the line's last empty slot leaves for the next field; Enter with nothing chosen closes", () => {
    const stmt = assign("total", num(1));
    const field: Field = { slot: "value" };
    const session = openSession(stmt, field, null);
    expect(valueKey(session, { key: "Tab", shiftKey: false }, [], ctx, "").after).toEqual({
      go: 1,
    });
    expect(valueKey(session, { key: "Enter", shiftKey: false }, [], ctx, "").after).toBe("close");
    expect(valueKey(session, { key: "Escape", shiftKey: false }, [], ctx, "").taken).toBe(false);
  });

  it("Tab and Shift+Tab reach the empty slot inside the value the editor opens with selected", () => {
    const field: Field = { slot: "args", index: 0 };
    const typed = press(openSession(print(empty()), field, null), "abs(").session.line?.root;
    if (!typed) throw new Error("no value typed");
    const slot = typed.type === "call" ? typed.args[0] : undefined;
    expect(slot?.type).toBe("empty");
    // The editor opened again on `print(abs(…))` selects `abs(…)`.
    const reopened = openSession(print(typed), field, null);
    expect(reopened.line?.selected).toBe(true);
    for (const shiftKey of [false, true]) {
      const moved = valueKey(reopened, { key: "Tab", shiftKey }, [], ctx, ")");
      expect([moved.session.line?.caret, moved.after]).toEqual([{ at: slot?.id }, undefined]);
    }
  });

  it("a key the line refuses after its value, beginning the words after the field, moves on", () => {
    const stmt = assign("total", num(1));
    const field: Field = { slot: "value" };
    const typed = press(openSession(stmt, field, null), "x").session;
    expect(valueKey(typed, { key: "]", shiftKey: false }, [], ctx, "]").after).toEqual({ go: 1 });
    // Words that do not begin with the key, or a key the line takes, stay in the line.
    expect(valueKey(typed, { key: "]", shiftKey: false }, [], ctx, ")").after).toBeUndefined();
    expect(valueKey(typed, { key: "+", shiftKey: false }, [], ctx, "+").after).toBeUndefined();
  });

  it("in a target's line, Enter choosing a whole target moves on; an empty item stays", () => {
    const targetCtx: LineContext = {
      ...ctx,
      target: { asked: ["total"], names: ["x"], binds: true },
    };
    const stmt = assignTo(empty(), num(1));
    const field: Field = { slot: "target" };
    const enter = { key: "Enter", shiftKey: false };
    const total = { type: "variable", name: "total" } as const;
    const highlighted = { ...openSession(stmt, field, null), highlight: 0 };
    const chosen = valueKey(highlighted, enter, [total], targetCtx, "←");
    expect(chosen.after).toEqual({ go: 1 });
    expect(chosen.edits).toMatchObject([{ field, root: { type: "var", name: "total" } }]);
    // A name filling an item's position completes the target and moves on too.
    const position = empty();
    const atPosition = openSession(
      assignTo(ast.item(v("x"), position), num(1)),
      field,
      position.id,
    );
    expect(pickRow(atPosition, total, targetCtx).after).toEqual({ go: 1 });
    // A choice that leaves an empty slot elsewhere in the target, or one the target refuses,
    // keeps the keyboard.
    const other = empty();
    const unlisted = openSession(assignTo(ast.item(empty(), other), num(1)), field, other.id);
    expect(pickRow(unlisted, total, targetCtx).after).toBeUndefined();
    const parentheses = pickRow(openSession(stmt, field, null), { type: "parentheses" }, targetCtx);
    expect(parentheses.after).toBeUndefined();
    const text = allEntries().find((entry) => entry.id === "str");
    if (!text) throw new Error("no Text");
    const named = openSession(assignTo(v("x"), num(1)), field, null);
    const refused = pickRow(named, { type: "entry", entry: text }, targetCtx);
    expect(refused.after).toBeUndefined();
    expect(refused.edits).toEqual([]);
    // A value slot never moves on.
    const value: Field = { slot: "value" };
    const blank = assign("y", empty());
    const valueOpen = { ...openSession(blank, value, null), highlight: 0 };
    expect(valueKey(valueOpen, enter, [total], ctx, "").after).toBeUndefined();
  });

  it("Backspace in an empty text field removes the text, leaving an empty slot", () => {
    const stmt = print(empty());
    const field: Field = { slot: "args", index: 0 };
    const text = allEntries().find((entry) => entry.id === "str");
    if (!text) throw new Error("no Text");
    // `Text` opens an empty text field, as the learner chooses it.
    const editing = chooseRow(openSession(stmt, field, null), { type: "entry", entry: text }, ctx);
    expect(editing.session.line?.text).toBeDefined();
    const transition = textEnded(editing.session, "Backspace", ctx);
    expect(transition.session.line?.root.type).toBe("empty");
    expect(transition.session.line?.text).toBeUndefined();
    expect(transition.edits.at(-1)?.root.type).toBe("empty");
    // Once the field has ended, Backspace from it removes nothing more.
    const ended = textEnded(editing.session, "Enter", ctx).session;
    expect(textEnded(ended, "Backspace", ctx).session.line?.root.type).toBe("str");
  });

  it("a value changed elsewhere reopens the line; focusing a field opens its value", () => {
    const stmt = assign("total", num(1));
    const field: Field = { slot: "value" };
    const session = openSession(stmt, field, null);
    expect(follow(session, stmt)).toBe(session);
    const undone = assign("total", num(2));
    undone.id = stmt.id;
    expect(follow(session, undone).line?.root).toMatchObject({ type: "num", value: 2 });
    const target: Field = { slot: "target" };
    expect(focusField(session, stmt, target, null)).toMatchObject({
      focus: target,
      line: { root: { type: "var", name: "total" }, selected: true },
    });
    // A field the statement no longer has, an item removed by an undo, leaves the keyboard.
    const second: Field = { slot: "args", index: 1 };
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
    const field: Field = { slot: "args", index: 0 };
    const both = chain(press(openSession(stmt, field, null), "1"), (s) => press(s, "2"));
    expect(both.edits.map((edit) => edit.root)).toMatchObject([{ value: 1 }, { value: 12 }]);
  });
});
