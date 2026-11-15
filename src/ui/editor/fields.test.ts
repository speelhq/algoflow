// The editor's lines are a label and a notation each, as the block definition declares them; a
// field of the lines is named by the block's label and the slot's name, and a for's variable, which
// the application names, is drawn as text.
import { describe, expect, it } from "vitest";
import { ast } from "@/blocks/testing";
import { getBlockDef } from "@/blocks/registry";
import type { Stmt } from "@/lang/types";
import {
  editedLines,
  fieldBeside,
  fieldHint,
  fieldLabel,
  fieldText,
  stmtFields,
  oneLine,
  startField,
  targetSlot,
  parseFieldText,
  parseFieldValue,
  findFieldValue,
} from "./fields";

const { assign, assignTo, print, for_, num, v, exprStmt, ret, bin, draft } = ast;

describe("fieldLabel", () => {
  it("names a field by the block's label and the slot's name", () => {
    const set = assign("total", num(1));
    const field = (slot: string) => ({ slot, role: "expr" as const });
    expect(fieldLabel(set, field("value"))).toBe("Set variable, value");
    expect(fieldLabel(print(v("total")), field("args"))).toBe("Print, values");
    expect(fieldLabel(for_("i", num(0), num(3), []), field("stop"))).toBe("For loop, stop");
    expect(fieldLabel(exprStmt(ast.call("max", v("a"), num(1))), field("expr"))).toBe(
      "Expression, expression",
    );
  });
});

describe("the lines the editor shows (blocks.md, Editor lines)", () => {
  /** Each line as its label, then its tokens, a slot drawn as its value marked with `=`. */
  const readLines = (stmt: Stmt) =>
    editedLines(stmt).map(({ label, tokens }) => [
      label,
      ...tokens.map(({ token, drawn }) =>
        "text" in token ? token.text : `${drawn ? "=" : ""}{${token.placeholder}}`,
      ),
    ]);

  it("are a for's start and condition, its variable drawn as text and its bounds fields", () => {
    const loop = for_("i", num(1), v("n"), []);
    expect(readLines(loop)).toEqual([
      ["line.start", "={var}", " ← ", "{start}"],
      ["line.condition", "={var}", " < ", "{stop}"],
    ]);
    expect(stmtFields(loop)).toEqual([
      { slot: "start", role: "expr" },
      { slot: "stop", role: "expr" },
    ]);
  });

  it("gives the field beside one in reading order, and none past either end", () => {
    const fields = stmtFields(assign("total", bin("+", v("total"), num(1))));
    const [first, last] = fields;
    expect(fieldBeside(fields, first!, 1)).toEqual(last);
    expect(fieldBeside(fields, last!, -1)).toEqual(first);
    expect(fieldBeside(fields, last!, 1)).toBeUndefined();
    expect(fieldBeside(fields, first!, -1)).toBeUndefined();
  });

  it("draws a return's value field whether the return holds a value or not", () => {
    const field = { slot: "value", role: "expr", optional: true } as const;
    expect(stmtFields(ret())).toEqual([field]);
    expect(stmtFields(ret(num(1)))).toEqual([field]);
    expect(findFieldValue(ret(), field)).toBeUndefined();
    expect(fieldText(null)).toBe("");
  });

  it("write no keyword of the block, a list of values one field with or without items", () => {
    const shown = print(v("a"), v("b"));
    expect(readLines(shown)).toEqual([["label", "{args}"]]);
    expect(readLines(ret())).toEqual([["label", "{value}"]]);
    expect(readLines(ast.brk())).toEqual([]);
    expect(stmtFields(shown)).toEqual([{ slot: "args", role: "exprs" }]);
    expect(stmtFields(print())).toEqual([{ slot: "args", role: "exprs" }]);
  });
});

describe("a target", () => {
  it("is a value field, its line keeping a target", () => {
    const stmt = assignTo(ast.item(v("nums"), v("i")), num(5));
    const target = { slot: "target", role: "target" } as const;
    const value = { slot: "value", role: "expr" } as const;
    expect(stmtFields(stmt)).toEqual([target, value]);
    expect(findFieldValue(stmt, target)).toBe(stmt.target);
    expect(targetSlot(stmt, target)).toMatchObject({ binds: true });
    expect(targetSlot(stmt, value)).toBeUndefined();
    // A new assignment's target is the first empty slot; a click on the target opens it.
    const fields = stmtFields(stmt);
    const fresh = getBlockDef("assign").create() as Stmt;
    expect(startField(fresh, stmtFields(fresh), null, false)).toEqual(fields[0]);
    expect(startField(stmt, fields, "target", false)).toEqual(fields[0]);
  });

  it("gives the keyboard to the first field that holds a draft, or to the slot clicked", () => {
    const args = { slot: "args", role: "exprs" } as const;
    const unread = print(draft("1, x y"));
    expect(startField(unread, stmtFields(unread), null, false)).toEqual(args);
    // A click on a print's values opens its one field.
    const filled = print(num(1), ast.call("abs", v("n")));
    expect(startField(filled, stmtFields(filled), "args", false)).toEqual(args);
    expect(startField(filled, stmtFields(filled), null, false)).toBeNull();
    expect(startField(print(), stmtFields(print()), null, false)).toBeNull();
  });

  it("opens a block the block menu has just inserted on its first draft, else its first field", () => {
    // A new loop opens on its stop, not on its start, which holds `0`.
    const fresh = getBlockDef("for").create() as Stmt;
    expect(startField(fresh, stmtFields(fresh), null, true)).toEqual({
      slot: "stop",
      role: "expr",
    });
    const call = exprStmt(ast.call("abs", v("n")));
    expect(startField(call, stmtFields(call), null, true)).toEqual({ slot: "expr", role: "expr" });
    expect(startField(print(), stmtFields(print()), null, true)).toEqual({
      slot: "args",
      role: "exprs",
    });
  });

  it("is named by the block's label and the slot's name", () => {
    const target = { slot: "target", role: "target" } as const;
    expect(fieldLabel(assign("total", num(1)), target)).toBe("Set variable, variable");
  });
});

describe("a value line's text (editor.md, Value line)", () => {
  it("writes a value as the emitter does and a draft as typed, and reads a text back", () => {
    expect(fieldText(bin("+", v("x"), num(1)))).toBe("x + 1");
    expect(fieldText(draft("x  +"))).toBe("x  +");
    expect(parseFieldText("x+1", "expr")).toMatchObject({ type: "binop", op: "+" });
    expect(parseFieldText("x +", "expr")).toMatchObject({ type: "draft", text: "x +" });
    expect(parseFieldText("", "expr")).toMatchObject({ type: "draft", text: "" });
    expect(parseFieldText("x + 1", "target")).toMatchObject({ type: "draft", text: "x + 1" });
  });

  it("writes a list of values separated by commas, and reads values, no item, or one draft back", () => {
    expect(fieldText([v("x"), ast.str("a b"), bin("+", v("x"), num(1))])).toBe('x, "a b", x + 1');
    expect(fieldText([])).toBe("");
    expect(fieldText([draft("x,  y z")])).toBe("x,  y z");
    expect(parseFieldText("x, 1+2", "exprs")).toMatchObject([
      { type: "var", name: "x" },
      { type: "binop", op: "+" },
    ]);
    expect(parseFieldText("", "exprs")).toEqual([]);
    expect(parseFieldText("x, y z", "exprs")).toMatchObject([{ type: "draft", text: "x, y z" }]);
    expect(parseFieldText("x,", "exprs")).toMatchObject([{ type: "draft", text: "x," }]);
  });

  it("reads an optional slot's field with no text as no value, and any other field's as a draft", () => {
    const optional = { slot: "value", role: "expr", optional: true } as const;
    expect(parseFieldValue("", optional)).toBeNull();
    expect(parseFieldValue("x", optional)).toMatchObject({ type: "var", name: "x" });
    expect(parseFieldValue("", { slot: "value", role: "expr" })).toMatchObject({
      type: "draft",
      text: "",
    });
  });

  it("shows its slot's hint with no text, or `optional` for an optional slot", () => {
    expect(fieldHint(assign("x", num(1)), { slot: "value", role: "expr" })).toBe("value");
    expect(fieldHint(print(num(1)), { slot: "args", role: "exprs" })).toBe("values");
    expect(fieldHint(ret(num(1)), { slot: "value", role: "expr" })).toBe("optional");
  });

  it("puts a line break on one line as a space, as in a caption", () => {
    expect(oneLine("x\n+\r\n1")).toBe("x + 1");
  });
});
