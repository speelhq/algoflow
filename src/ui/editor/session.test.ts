// The field that takes the keyboard and how it opens; each change of the text writes the value
// it parses as, or a draft; the keys a value line acts on.
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { ast } from "@/blocks/testing";
import { allEntries } from "./entries";
import { stmtFields, startField, type Field } from "./fields";
import type { LineContext, Row } from "./choices";
import {
  changeText,
  enterField,
  followStatement,
  openSession,
  pickRow,
  selectText,
  shownHighlight,
  stepHighlight,
  valueKey,
  type Session,
} from "./session";

const { assign, assignTo, print, num, str, bin, v, empty, draft, item } = ast;

const value: Field = { slot: "value", role: "expr" };
const target: Field = { slot: "target", role: "target" };
const args: Field = { slot: "args", role: "exprs" };

const ctx: LineContext = {
  variables: ["x", "total", "nums"],
  kinds: new Map<string, Kind>([
    ["x", "number"],
    ["nums", "list"],
  ]),
  functions: [],
  target: null,
};

const targetCtx: LineContext = { ...ctx, target: { asked: [], names: ["x"], binds: true } };

/** The field's text changes to `text`, the caret at its end. */
const typed = (session: Session, text: string, composing = false) =>
  changeText(session, { text, start: text.length, end: text.length }, composing);

const key = (name: string, shiftKey = false) => ({
  key: name,
  shiftKey,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
});

/** A notation with a field before and after the focused one. */
const both = () => true;

const entry = (label: string): Row => {
  const found = allEntries().find((each) => each.label === label);
  if (!found) throw new Error(label);
  return { type: "entry", entry: found };
};

describe("opening a field (editor.md, Block editor; Value line, Selected text)", () => {
  it("the slot clicked takes the keyboard, else the first field that holds a draft", () => {
    const stmt = assign("total", draft("x +"));
    const fields = stmtFields(stmt);
    expect(fields).toEqual([target, value]);
    expect(startField(stmt, fields, null)).toEqual(fields[1]);
    expect(startField(stmt, fields, "target")).toEqual(fields[0]);
    const settled = assign("total", num(1));
    expect(startField(settled, stmtFields(settled), null)).toBeNull();
  });

  it("a value opens selected, a draft with the caret at its end, and an inserted block at the caret given", () => {
    expect(openSession(assign("x", bin("+", v("x"), num(1))), value, null).line).toEqual({
      text: "x + 1",
      start: 0,
      end: 5,
    });
    expect(openSession(assign("x", draft("x +")), value, null).line).toEqual({
      text: "x +",
      start: 3,
      end: 3,
    });
    expect(openSession(assign("x", empty()), value, 0).line).toEqual({
      text: "",
      start: 0,
      end: 0,
    });
  });

  it("Tab opens a field as the editor does, and a click keeps the selection it made", () => {
    const stmt = assign("x", num(10));
    expect(enterField(stmt, value, "tab").line).toEqual({ text: "10", start: 0, end: 2 });
    expect(enterField(stmt, value, { start: 1, end: 1 }).line).toEqual({
      text: "10",
      start: 1,
      end: 1,
    });
    expect(enterField(stmt, null, "tab")).toMatchObject({ focus: null, line: null });
  });
});

describe("changing the text (editor.md, Value line)", () => {
  const opened = () => openSession(assign("total", empty()), value, 0);

  it("writes the value the text parses as, and keeps the text as typed", () => {
    const changed = typed(opened(), "x+1");
    expect(changed.edits).toHaveLength(1);
    expect(changed.edits[0]?.field).toEqual(value);
    expect(changed.edits[0]?.value).toMatchObject({ type: "binop", op: "+" });
    expect(changed.session.line?.text).toBe("x+1");
  });

  it("writes text that doesn't parse as a draft, spaces included, and no text as an empty slot", () => {
    expect(typed(opened(), "x + ").edits[0]?.value).toMatchObject({ type: "draft", text: "x + " });
    const cleared = typed(typed(opened(), "x").session, "");
    expect(cleared.edits[0]?.value).toMatchObject({ type: "draft", text: "" });
  });

  it("writes nothing when the text writes the value it already holds", () => {
    const first = typed(opened(), "x+1");
    expect(typed(first.session, "x + 1").edits).toEqual([]);
  });

  it("writes nothing while an input method composes, and the text once it ends", () => {
    const composing = typed(opened(), "x", true);
    expect(composing.edits).toEqual([]);
    expect(composing.session.line?.text).toBe("x");
    expect(typed(composing.session, "x").edits).toHaveLength(1);
  });

  it("keeps in a target's line only a target, else the text as a draft", () => {
    const open = openSession(assign("total", num(0)), target, null);
    expect(typed(open, "nums[0]").edits[0]?.value).toMatchObject({ type: "index" });
    expect(typed(open, "x + 1").edits[0]?.value).toMatchObject({
      type: "draft",
      text: "x + 1",
    });
  });

  it("a value changed elsewhere reopens the line on it, and a selection is the field's", () => {
    const stmt = assign("total", num(1));
    const open = openSession(stmt, value, null);
    expect(followStatement(open, stmt)).toBe(open);
    const undone = followStatement(open, assign("total", num(25)));
    expect(undone.line).toEqual({ text: "25", start: 2, end: 2 });
    expect(selectText(open, 1, 1).line).toEqual({ text: "1", start: 1, end: 1 });
  });
});

describe("the keys a value line acts on (editor.md, Value list; Block editor)", () => {
  it("Enter chooses the highlighted row, else closes; Tab is the editor's", () => {
    const open = openSession(assign("total", num(0)), value, null);
    expect(valueKey(open, key("Enter"), [], ctx, both).after).toBe("close");
    // Ctrl/Cmd+Enter is the page's play button.
    const play = { ...key("Enter"), ctrlKey: true };
    expect(valueKey(open, play, [], ctx, both).taken).toBe(false);
    expect(valueKey(open, { ...play, ctrlKey: false, metaKey: true }, [], ctx, both).taken).toBe(
      false,
    );
    expect(valueKey(open, key("a"), [], ctx, both).taken).toBe(false);
    // The editor moves Tab and Shift+Tab round its controls (`focus.ts`).
    expect(valueKey(open, key("Tab"), [], ctx, both).taken).toBe(false);
    expect(valueKey(open, key("Tab", true), [], ctx, both).taken).toBe(false);
  });

  it("← at the start and → at the end, with no text selected, move to the field beside", () => {
    const at = (start: number, end = start) =>
      selectText(openSession(assign("total", num(10)), value, null), start, end);
    expect(valueKey(at(0), key("ArrowLeft"), [], ctx, both).after).toEqual({
      go: -1,
      entry: "end",
    });
    expect(valueKey(at(2), key("ArrowRight"), [], ctx, both).after).toEqual({
      go: 1,
      entry: "start",
    });
    // Inside the text, over a selection, or with Shift, they move the caret as in a text field.
    expect(valueKey(at(1), key("ArrowLeft"), [], ctx, both).taken).toBe(false);
    expect(valueKey(at(1), key("ArrowRight"), [], ctx, both).taken).toBe(false);
    expect(valueKey(at(0, 2), key("ArrowRight"), [], ctx, both).taken).toBe(false);
    expect(valueKey(at(0, 2), key("ArrowLeft"), [], ctx, both).taken).toBe(false);
    expect(valueKey(at(0), key("ArrowLeft", true), [], ctx, both).taken).toBe(false);
    expect(valueKey(at(0), { ...key("ArrowLeft"), altKey: true }, [], ctx, both).taken).toBe(false);
    expect(valueKey(at(2), { ...key("ArrowRight"), metaKey: true }, [], ctx, both).taken).toBe(
      false,
    );
    // At the start of the first field and the end of the last, they do nothing.
    expect(valueKey(at(0), key("ArrowLeft"), [], ctx, () => false).taken).toBe(false);
    expect(valueKey(at(2), key("ArrowRight"), [], ctx, () => false).taken).toBe(false);
  });

  it("a field entered by ← opens with the caret at its end, and by → at its start", () => {
    const stmt = assign("x", num(10));
    expect(enterField(stmt, value, "end").line).toEqual({ text: "10", start: 2, end: 2 });
    expect(enterField(stmt, value, "start").line).toEqual({ text: "10", start: 0, end: 0 });
  });

  it("the first match of a word is highlighted, and ↓ and ↑ wrap round the list", () => {
    const word = typed(openSession(assign("total", empty()), value, 0), "to").session;
    expect(shownHighlight(word, 3)).toBe(0);
    expect(shownHighlight(openSession(assign("total", empty()), value, 0), 3)).toBeNull();
    const down = stepHighlight(word, 3, 2, 1);
    expect(down.highlight).toBe(0);
    expect(stepHighlight(word, 3, 0, -1).highlight).toBe(2);
    expect(valueKey(word, key("ArrowUp"), [], ctx, both).taken).toBe(false);
  });

  it("a row chosen writes its text at the caret", () => {
    const open = typed(openSession(assign("total", empty()), value, 0), "x ").session;
    const picked = pickRow(open, entry("Add"), ctx);
    expect(picked.session.line).toEqual({ text: "x + ", start: 4, end: 4 });
    expect(picked.edits[0]?.value).toMatchObject({ type: "draft", text: "x + " });
    expect(picked.after).toBeUndefined();
  });

  it("in a target's line, a choice that leaves a target moves on; one that leaves no target stays", () => {
    const open = openSession(assignTo(item(v("nums"), num(0)), num(1)), target, null);
    const name = changeText(open, { text: "", start: 0, end: 0 }, false).session;
    expect(pickRow(name, { type: "variable", name: "x" }, targetCtx).after).toEqual({
      go: 1,
      entry: "tab",
    });
    const list = typed(open, "nums ").session;
    expect(pickRow(list, entry("Item at a position"), targetCtx).after).toBeUndefined();
  });

  it("`,` is typed as any other character, in a list of values as in any value", () => {
    const open = typed(openSession(print(num(1)), args, null), "x").session;
    expect(valueKey(open, key(","), [], ctx, both).taken).toBe(false);
    const single = openSession(assign("total", num(0)), value, null);
    expect(valueKey(single, key(","), [], ctx, both).taken).toBe(false);
  });
});

describe("a list of values (editor.md, Block editor; language.md, Expressions, Drafts)", () => {
  it("is one field whose text holds the values separated by commas", () => {
    const open = openSession(print(num(1), str("a")), args, null);
    expect(open.line).toEqual({ text: '1, "a"', start: 0, end: 6 });
    expect(openSession(print(), args, 0).line).toEqual({ text: "", start: 0, end: 0 });
    // A draft, the list's only item, opens with the caret at the end of its text.
    expect(openSession(print(draft("1, x y")), args, null).line).toEqual({
      text: "1, x y",
      start: 6,
      end: 6,
    });
  });

  it("writes the values the text parses as, no item for no text, and one draft otherwise", () => {
    const open = openSession(print(), args, 0);
    expect(typed(open, "x, 1+2").edits[0]).toMatchObject({
      field: args,
      value: [
        { type: "var", name: "x" },
        { type: "binop", op: "+" },
      ],
    });
    expect(typed(typed(open, "x").session, "").edits[0]?.value).toEqual([]);
    expect(typed(open, "x, y z").edits[0]?.value).toMatchObject([
      { type: "draft", text: "x, y z" },
    ]);
  });

  it("removes and adds a value by its text", () => {
    const open = openSession(print(num(1), num(2)), args, null);
    const removed = typed(open, "1");
    expect(removed.edits[0]?.value).toMatchObject([{ type: "num", value: 1 }]);
    const added = typed(removed.session, "1, 3");
    expect(added.edits[0]?.value).toMatchObject([
      { type: "num", value: 1 },
      { type: "num", value: 3 },
    ]);
    // The text as typed stays while the list is the same.
    expect(typed(added.session, "1,3").edits).toEqual([]);
  });

  it("a value changed elsewhere reopens the line on the list's text", () => {
    const open = openSession(print(num(1)), args, null);
    const undone = followStatement(open, print());
    expect(undone).toMatchObject({ focus: args, line: { text: "", start: 0, end: 0 } });
  });
});
