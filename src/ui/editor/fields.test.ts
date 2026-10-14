// A field of the editor's notation is named by the block's label and the slot's name; a
// counted loop shows its init and its check, its variable a field only at the first.
import { describe, expect, it } from "vitest";
import { ast } from "@/nodes/testing";
import { setExpr } from "@/lang/edit";
import type { Stmt } from "@/lang/types";
import { program } from "@/nodes/testing";
import { notationText } from "@/ui/chart/text";
import {
  editedLines,
  fieldLabel,
  fieldPath,
  fieldsOf,
  itemField,
  itemTarget,
  nameOf,
  setItem,
  setName,
  startField,
  valueOf,
} from "./fields";

const { assign, assignTo, print, for_, num, v, exprStmt, ret } = ast;

describe("fieldLabel", () => {
  it("names a field by the block's label and the slot's name", () => {
    const set = assign("total", num(1));
    const field = (slot: string) => ({ slot, role: "expr" as const });
    expect(fieldLabel(set, { slot: "target", role: "target" })).toBe("Set variable, variable");
    expect(fieldLabel(set, field("value"))).toBe("Set variable, value");
    expect(fieldLabel(print(v("total")), field("args"))).toBe("Print, value");
    expect(fieldLabel(for_("i", num(0), num(3), []), field("stop"))).toBe("For loop, stop");
    expect(fieldLabel(exprStmt(ast.call("max", v("a"), num(1))), field("expr"))).toBe(
      "Expression, expression",
    );
  });

  it("names an item's position in a target by the item's label", () => {
    const set = assignTo(itemTarget("nums"), num(1));
    expect(fieldLabel(set, itemField("target"))).toBe("Set variable, Item at a position");
    expect(fieldLabel(set, { slot: "target", role: "target" })).toBe("Set variable, variable");
  });
});

describe("the notation the editor shows", () => {
  it("is a counted loop's init and check, its variable a field at its first place only", () => {
    const loop = for_("i", num(1), v("n"), []);
    const lines = editedLines(loop).map((line) =>
      line.map(({ piece, again }) =>
        "words" in piece ? piece.words : `${again ? "=" : ""}{${piece.name}}`,
      ),
    );
    expect(lines).toEqual([
      ["{var}", " ← ", "{start}"],
      ["={var}", " < ", "{stop}", "?"],
    ]);
    expect(fieldsOf(loop).map((field) => field.slot)).toEqual(["var", "start", "stop"]);
  });

  it("keeps a return's value slot with no value, which the editor offers as `+ value`", () => {
    const pieces = editedLines(ret()).flat();
    expect(pieces.some(({ piece }) => "name" in piece && piece.name === "value")).toBe(true);
    expect(fieldsOf(ret())).toEqual([]);
  });

  it("is the block's notation otherwise", () => {
    const shown = print(v("a"), v("b"));
    expect(editedLines(shown)).toHaveLength(1);
    expect(fieldsOf(shown)).toEqual([
      { slot: "args", role: "expr", index: 0 },
      { slot: "args", role: "expr", index: 1 },
    ]);
  });
});

describe("a target holding an item", () => {
  it("is set from a list variable, its position still to fill", () => {
    const set = assign("x", num(0));
    const made = setItem(program([set]), set, "target", "nums");
    const stmt = made.main[0] as Stmt;
    expect(notationText(stmt)).toBe("nums[…] ← 0");
    // Choosing a name again makes the target that variable.
    const back = setName(made, stmt, "target", "total").main[0] as Stmt;
    expect(notationText(back)).toBe("total ← 0");
  });

  it("is its list's name, then its position as a value field, then the value", () => {
    const stmt = assignTo(itemTarget("nums"), num(5));
    expect(nameOf(stmt, "target")).toBe("nums");
    expect(fieldsOf(stmt)).toEqual([
      { slot: "target", role: "target" },
      itemField("target"),
      { slot: "value", role: "expr" },
    ]);
    expect(valueOf(stmt, itemField("target"))?.kind).toBe("empty");
    expect(fieldPath(itemField("target"))).toBe("target.index");
    expect(fieldPath({ slot: "value", role: "expr" })).toBe("value");
  });

  it("takes the keyboard at its position, which a value written there fills", () => {
    const stmt = assignTo(itemTarget("nums"), num(5));
    const fields = fieldsOf(stmt);
    expect(startField(stmt, fields, { slot: null, hole: null })).toEqual(itemField("target"));
    const position = valueOf(stmt, itemField("target"));
    expect(startField(stmt, fields, { slot: "target", hole: position?.id ?? null })).toEqual(
      itemField("target"),
    );
    const filled = setExpr(program([stmt]), stmt.id, fieldPath(itemField("target")), v("i"));
    expect(notationText(filled.main[0] as Stmt)).toBe("nums[i] ← 5");
  });
});

describe("a target the editor cannot edit as an item", () => {
  it("has no field when its block is not registered or its list is no variable", () => {
    const key = assignTo({ kind: "key", dict: v("d"), key: ast.str("a") }, num(1));
    expect(fieldsOf(key)).toEqual([{ slot: "value", role: "expr" }]);
    expect(nameOf(key, "target")).toBeUndefined();
    const nested = assignTo(
      { kind: "index", list: ast.item(v("grid"), num(0)), index: num(1) },
      num(1),
    );
    expect(fieldsOf(nested)).toEqual([{ slot: "value", role: "expr" }]);
  });

  it("keeps the position of an item of the list chosen again", () => {
    const set = assignTo({ kind: "index", list: v("nums"), index: v("i") }, num(1));
    const p = program([set]);
    expect(setItem(p, set, "target", "nums")).toBe(p);
    expect(notationText(setItem(p, set, "target", "other").main[0] as Stmt)).toBe("other[…] ← 1");
  });
});
