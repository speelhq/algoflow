// A field of the editor's notation is named by the block's label and the slot's name; a
// counted loop shows its init and its check, its variable a field only at the first.
import { describe, expect, it } from "vitest";
import { ast } from "@/blocks/testing";
import { getBlockDef } from "@/blocks/registry";
import type { Stmt } from "@/lang/types";
import {
  editedLines,
  fieldHint,
  fieldLabel,
  fieldText,
  fieldsOf,
  oneLine,
  startField,
  targetSlot,
  textValue,
  valueOf,
} from "./fields";

const { assign, assignTo, print, for_, forTo, num, v, exprStmt, ret, bin, draft } = ast;

describe("fieldLabel", () => {
  it("names a field by the block's label and the slot's name", () => {
    const set = assign("total", num(1));
    const field = (slot: string) => ({ slot });
    expect(fieldLabel(set, field("value"))).toBe("Set variable, value");
    expect(fieldLabel(print(v("total")), field("args"))).toBe("Print, values");
    expect(fieldLabel(for_("i", num(0), num(3), []), field("stop"))).toBe("For loop, stop");
    expect(fieldLabel(exprStmt(ast.call("max", v("a"), num(1))), field("expr"))).toBe(
      "Expression, expression",
    );
  });
});

describe("the notation the editor shows", () => {
  it("is a counted loop's init and check, its variable a field at its first place only", () => {
    const loop = for_("i", num(1), v("n"), []);
    const lines = editedLines(loop).map((line) =>
      line.map(({ token, again }) =>
        "text" in token ? token.text : `${again ? "=" : ""}{${token.placeholder}}`,
      ),
    );
    expect(lines).toEqual([
      ["{var}", " ← ", "{start}"],
      ["={var}", " < ", "{stop}", "?"],
    ]);
    expect(fieldsOf(loop).map((field) => field.slot)).toEqual(["var", "start", "stop"]);
  });

  it("keeps a return's value slot with no value, which the editor offers as `+ value`", () => {
    const tokens = editedLines(ret()).flat();
    expect(
      tokens.some(({ token }) => "placeholder" in token && token.placeholder === "value"),
    ).toBe(true);
    expect(fieldsOf(ret())).toEqual([]);
  });

  it("is the block's notation otherwise", () => {
    const shown = print(v("a"), v("b"));
    expect(editedLines(shown)).toHaveLength(1);
    expect(fieldsOf(shown)).toEqual([
      { slot: "args", index: 0 },
      { slot: "args", index: 1 },
    ]);
  });
});

describe("a target", () => {
  it("is a value field, its line keeping a target", () => {
    const stmt = assignTo(ast.item(v("nums"), ast.empty()), num(5));
    expect(fieldsOf(stmt)).toEqual([{ slot: "target" }, { slot: "value" }]);
    expect(valueOf(stmt, { slot: "target" })).toBe(stmt.target);
    expect(targetSlot(stmt, { slot: "target" })).toMatchObject({ binds: true });
    expect(targetSlot(stmt, { slot: "value" })).toBeUndefined();
    // A new assignment's target is the first empty slot; a click on an item's position opens the
    // target.
    const fields = fieldsOf(stmt);
    const fresh = getBlockDef("assign").create() as Stmt;
    expect(startField(fresh, fieldsOf(fresh), { slot: null, emptyId: null })).toEqual(fields[0]);
    const position = (stmt.target as Extract<typeof stmt.target, { type: "index" }>).index;
    expect(startField(stmt, fields, { slot: "target", emptyId: position.id })).toEqual(fields[0]);
  });

  it("gives the keyboard to the first field that holds an empty slot, at any depth", () => {
    const opened = { slot: null, emptyId: null };
    const deep = print(num(1), ast.call("abs", ast.empty()));
    expect(startField(deep, fieldsOf(deep), opened)).toEqual({ slot: "args", index: 1 });
    // A loop's variable is a target, an empty slot until it is filled.
    const fresh = getBlockDef("for").create() as Stmt;
    expect(startField(fresh, fieldsOf(fresh), opened)).toEqual({ slot: "var" });
    expect(targetSlot(fresh, { slot: "var" })).toMatchObject({ binds: true });
    const unnamed = forTo(ast.empty(), num(0), v("n"), []);
    expect(fieldsOf(unnamed)).toEqual([{ slot: "var" }, { slot: "start" }, { slot: "stop" }]);
    const filled = print(num(1), ast.call("abs", v("n")));
    expect(startField(filled, fieldsOf(filled), opened)).toBeNull();
  });

  it("is named by the block's label and the slot's name", () => {
    expect(fieldLabel(assign("total", num(1)), { slot: "target" })).toBe("Set variable, variable");
  });
});

describe("a value line's text (editor.md, Value line)", () => {
  it("writes a value as the emitter does and a draft as typed, and reads a text back", () => {
    expect(fieldText(bin("+", v("x"), num(1)))).toBe("x + 1");
    expect(fieldText(draft("x  +"))).toBe("x  +");
    expect(textValue("x+1", false)).toMatchObject({ type: "binop", op: "+" });
    expect(textValue("x +", false)).toMatchObject({ type: "draft", text: "x +" });
    expect(textValue("", false)).toMatchObject({ type: "draft", text: "" });
    expect(textValue("x + 1", true)).toMatchObject({ type: "draft", text: "x + 1" });
  });

  it("shows its slot's hint with no text, or `optional` for an optional slot", () => {
    expect(fieldHint(assign("x", num(1)), { slot: "value" })).toBe("value");
    expect(fieldHint(print(num(1)), { slot: "args", index: 0 })).toBe("values");
    expect(fieldHint(ret(num(1)), { slot: "value" })).toBe("optional");
  });

  it("puts a line break on one line as a space, as in a caption", () => {
    expect(oneLine("x\n+\r\n1")).toBe("x + 1");
  });
});
