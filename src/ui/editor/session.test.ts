// The field that takes the keyboard and how it opens; each change of the text writes the value
// it parses as, or a draft; the keys a value line acts on.
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { ast } from "@/blocks/testing";
import { unparse } from "@/python/emit";
import { allEntries } from "./entries";
import { fieldsOf, startField, type Field } from "./fields";
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

const { assign, assignTo, print, num, bin, v, empty, draft, item } = ast;

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
const typed = (session: Session, text: string, context: LineContext = ctx, composing = false) =>
  changeText(session, context, { text, start: text.length, end: text.length }, composing);

const key = (name: string, shiftKey = false) => ({ key: name, shiftKey });

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
    const fields = fieldsOf(stmt);
    expect(fields).toEqual([{ slot: "target" }, { slot: "value" }]);
    expect(startField(stmt, fields, { slot: null, emptyId: null })).toEqual(fields[1]);
    expect(startField(stmt, fields, { slot: "target", emptyId: null })).toEqual(fields[0]);
    const settled = assign("total", num(1));
    expect(startField(settled, fieldsOf(settled), { slot: null, emptyId: null })).toBeNull();
  });

  it("a value opens selected, a draft with the caret at its end, and an inserted block at the caret given", () => {
    const field: Field = { slot: "value" };
    expect(openSession(assign("x", bin("+", v("x"), num(1))), field, null).line).toEqual({
      text: "x + 1",
      start: 0,
      end: 5,
    });
    expect(openSession(assign("x", draft("x +")), field, null).line).toEqual({
      text: "x +",
      start: 3,
      end: 3,
    });
    expect(openSession(assign("x", empty()), field, 0).line).toEqual({
      text: "",
      start: 0,
      end: 0,
    });
  });

  it("Tab opens a field as the editor does, and a click keeps the selection it made", () => {
    const stmt = assign("x", num(10));
    const field: Field = { slot: "value" };
    expect(enterField(stmt, field, "tab").line).toEqual({ text: "10", start: 0, end: 2 });
    expect(enterField(stmt, field, { start: 1, end: 1 }).line).toEqual({
      text: "10",
      start: 1,
      end: 1,
    });
    expect(enterField(stmt, null, "tab")).toMatchObject({ focus: null, line: null });
  });
});

describe("changing the text (editor.md, Value line)", () => {
  const field: Field = { slot: "value" };
  const opened = () => openSession(assign("total", empty()), field, 0);

  it("writes the value the text parses as, and keeps the text as typed", () => {
    const changed = typed(opened(), "x+1");
    expect(changed.edits).toHaveLength(1);
    expect(changed.edits[0]?.field).toEqual(field);
    expect(unparse(changed.edits[0]?.root ?? empty())).toBe("x + 1");
    expect(changed.session.line?.text).toBe("x+1");
  });

  it("writes text that doesn't parse as a draft, spaces included, and no text as an empty slot", () => {
    expect(typed(opened(), "x + ").edits[0]?.root).toMatchObject({ type: "draft", text: "x + " });
    const cleared = typed(typed(opened(), "x").session, "");
    expect(cleared.edits[0]?.root).toMatchObject({ type: "draft", text: "" });
  });

  it("writes nothing when the text writes the value it already holds", () => {
    const first = typed(opened(), "x+1");
    expect(typed(first.session, "x + 1").edits).toEqual([]);
  });

  it("writes nothing while an input method composes, and the text once it ends", () => {
    const composing = typed(opened(), "x", ctx, true);
    expect(composing.edits).toEqual([]);
    expect(composing.session.line?.text).toBe("x");
    expect(typed(composing.session, "x").edits).toHaveLength(1);
  });

  it("keeps in a target's line only a target, else the text as a draft", () => {
    const target: Field = { slot: "target" };
    const open = openSession(assign("total", num(0)), target, null);
    expect(typed(open, "nums[0]", targetCtx).edits[0]?.root).toMatchObject({ type: "index" });
    expect(typed(open, "x + 1", targetCtx).edits[0]?.root).toMatchObject({
      type: "draft",
      text: "x + 1",
    });
  });

  it("a value changed elsewhere reopens the line on it, and a selection is the field's", () => {
    const stmt = assign("total", num(1));
    const open = openSession(stmt, field, null);
    expect(followStatement(open, stmt)).toBe(open);
    const undone = followStatement(open, assign("total", num(25)));
    expect(undone.line).toEqual({ text: "25", start: 2, end: 2 });
    expect(selectText(open, 1, 1).line).toEqual({ text: "1", start: 1, end: 1 });
  });
});

describe("the keys a value line acts on (editor.md, Value list; Block editor)", () => {
  const field: Field = { slot: "value" };

  it("Enter chooses the highlighted row, else closes; Tab and Shift+Tab move between fields", () => {
    const open = openSession(assign("total", num(0)), field, null);
    expect(valueKey(open, key("Enter"), [], ctx, both).after).toBe("close");
    expect(valueKey(open, key("Tab"), [], ctx, both).after).toEqual({ go: 1 });
    expect(valueKey(open, key("Tab", true), [], ctx, both).after).toEqual({ go: -1 });
    expect(valueKey(open, key("a"), [], ctx, both).taken).toBe(false);
    // Past the last field, Tab is the field's, which leaves the notation.
    expect(valueKey(open, key("Tab"), [], ctx, () => false).taken).toBe(false);
  });

  it("the first match of a word is highlighted, and ↓ and ↑ wrap round the list", () => {
    const word = typed(openSession(assign("total", empty()), field, 0), "to").session;
    expect(shownHighlight(word, 3)).toBe(0);
    expect(shownHighlight(openSession(assign("total", empty()), field, 0), 3)).toBeNull();
    const down = stepHighlight(word, 3, 2, 1);
    expect(down.highlight).toBe(0);
    expect(stepHighlight(word, 3, 0, -1).highlight).toBe(2);
    expect(valueKey(word, key("ArrowUp"), [], ctx, both).taken).toBe(false);
  });

  it("a row chosen writes its text at the caret", () => {
    const open = typed(openSession(assign("total", empty()), field, 0), "x ").session;
    const picked = pickRow(open, entry("Add"), ctx);
    expect(picked.session.line).toEqual({ text: "x + ", start: 4, end: 4 });
    expect(picked.edits[0]?.root).toMatchObject({ type: "draft", text: "x + " });
    expect(picked.after).toBeUndefined();
  });

  it("in a target's line, a choice that leaves a target moves on; one that leaves no target stays", () => {
    const target: Field = { slot: "target" };
    const open = openSession(assignTo(item(v("nums"), num(0)), num(1)), target, null);
    const name = changeText(open, targetCtx, { text: "", start: 0, end: 0 }, false).session;
    expect(pickRow(name, { type: "variable", name: "x" }, targetCtx).after).toEqual({ go: 1 });
    const list = typed(open, "nums ", targetCtx).session;
    expect(pickRow(list, entry("Item at a position"), targetCtx).after).toBeUndefined();
  });

  it("`,` after an item's whole value adds the next item; inside a value it is typed", () => {
    const stmt = print(num(1));
    const item0: Field = { slot: "args", index: 0 };
    const open = typed(openSession(stmt, item0, null), "x").session;
    expect(valueKey(open, key(","), [], ctx, both).after).toEqual({ addItem: 1 });
    const inside = typed(open, "max(x").session;
    expect(valueKey(inside, key(","), [], ctx, both).taken).toBe(false);
    const value = openSession(assign("total", num(0)), field, null);
    expect(valueKey(value, key(","), [], ctx, both).taken).toBe(false);
  });
});
