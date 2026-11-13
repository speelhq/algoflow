// A field of the editor's notation is named by the block's label and the slot's name; a
// counted loop shows its init and its check, its variable a field only at the first.
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
  textValue,
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
    expect(stmtFields(loop)).toEqual([
      { slot: "var", role: "target" },
      { slot: "start", role: "expr" },
      { slot: "stop", role: "expr" },
    ]);
  });

  it("gives the field beside one in reading order, and none past either end", () => {
    const fields = stmtFields(for_("i", num(1), v("n"), []));
    const [first, second, last] = fields;
    expect(fieldBeside(fields, first!, 1)).toEqual(second);
    expect(fieldBeside(fields, second!, -1)).toEqual(first);
    expect(fieldBeside(fields, last!, 1)).toBeUndefined();
    expect(fieldBeside(fields, first!, -1)).toBeUndefined();
  });

  it("keeps a return's value slot with no value, which the editor offers as `+ value`", () => {
    const tokens = editedLines(ret()).flat();
    expect(
      tokens.some(({ token }) => "placeholder" in token && token.placeholder === "value"),
    ).toBe(true);
    expect(stmtFields(ret())).toEqual([]);
  });

  it("is the block's notation otherwise, a list of values one field with or without items", () => {
    const shown = print(v("a"), v("b"));
    expect(editedLines(shown)).toHaveLength(1);
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
    expect(startField(fresh, stmtFields(fresh), null)).toEqual(fields[0]);
    expect(startField(stmt, fields, "target")).toEqual(fields[0]);
  });

  it("gives the keyboard to the first field that holds a draft, or to the slot clicked", () => {
    const args = { slot: "args", role: "exprs" } as const;
    const unread = print(draft("1, x y"));
    expect(startField(unread, stmtFields(unread), null)).toEqual(args);
    // A click on a print's values opens its one field.
    const filled = print(num(1), ast.call("abs", v("n")));
    expect(startField(filled, stmtFields(filled), "args")).toEqual(args);
    expect(startField(filled, stmtFields(filled), null)).toBeNull();
    expect(startField(print(), stmtFields(print()), null)).toBeNull();
    // A loop's variable is a target, an empty slot until it is filled.
    const fresh = getBlockDef("for").create() as Stmt;
    const variable = { slot: "var", role: "target" } as const;
    expect(startField(fresh, stmtFields(fresh), null)).toEqual(variable);
    expect(targetSlot(fresh, variable)).toMatchObject({ binds: true });
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
    expect(textValue("x+1", "expr")).toMatchObject({ type: "binop", op: "+" });
    expect(textValue("x +", "expr")).toMatchObject({ type: "draft", text: "x +" });
    expect(textValue("", "expr")).toMatchObject({ type: "draft", text: "" });
    expect(textValue("x + 1", "target")).toMatchObject({ type: "draft", text: "x + 1" });
  });

  it("writes a list of values separated by commas, and reads values, no item, or one draft back", () => {
    expect(fieldText([v("x"), ast.str("a b"), bin("+", v("x"), num(1))])).toBe('x, "a b", x + 1');
    expect(fieldText([])).toBe("");
    expect(fieldText([draft("x,  y z")])).toBe("x,  y z");
    expect(textValue("x, 1+2", "exprs")).toMatchObject([
      { type: "var", name: "x" },
      { type: "binop", op: "+" },
    ]);
    expect(textValue("", "exprs")).toEqual([]);
    expect(textValue("x, y z", "exprs")).toMatchObject([{ type: "draft", text: "x, y z" }]);
    expect(textValue("x,", "exprs")).toMatchObject([{ type: "draft", text: "x," }]);
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
