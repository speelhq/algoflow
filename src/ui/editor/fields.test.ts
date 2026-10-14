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
  firstPart,
  formOfKey,
  formsFor,
  formTarget,
  nameOf,
  setForm,
  formIn,
  setName,
  setVariable,
  startField,
  valueOf,
  wordsAfter,
  type Field,
} from "./fields";

const { assign, assignTo, print, for_, num, v, exprStmt, ret } = ast;

const itemTarget = (name: string) => formTarget("index", name);
const position: Field = { slot: "target", role: "expr", part: "index" };

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
    expect(fieldLabel(set, position)).toBe("Set variable, Item at a position");
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

describe("a slot written twice", () => {
  it("is a field at its first place and drawn as its value at the other (swap's list)", () => {
    const stmt = ast.swap(v("nums"), num(0), num(2));
    expect(notationText(stmt)).toBe("swap(nums[0], nums[2])");
    expect(fieldsOf(stmt)).toEqual([
      { slot: "list", role: "expr" },
      { slot: "i", role: "expr" },
      { slot: "j", role: "expr" },
    ]);
    // `[` after the list goes on to its first position, `]` after a position to the next.
    expect(wordsAfter(stmt, { slot: "list", role: "expr" })).toBe("[");
    expect(wordsAfter(stmt, { slot: "i", role: "expr" })).toBe("],");
  });
});

describe("a target holding an item", () => {
  it("is offered for a list variable by the item block's entry, for no variable of no known kind", () => {
    expect(formsFor("list")).toEqual(["index"]);
    expect(formsFor(undefined)).toEqual([]);
    expect(formsFor("number")).toEqual([]);
    expect(formOfKey(["index"], "[")).toBe("index");
    expect(formOfKey(["index"], "(")).toBeUndefined();
  });

  it("is set from a variable, its position still to fill, and set back to the variable", () => {
    const set = assign("x", num(0));
    const made = setForm(program([set]), set, "target", "index", "nums");
    const stmt = made.main[0] as Stmt;
    expect(notationText(stmt)).toBe("nums[…] ← 0");
    expect(firstPart(stmt, "target")).toEqual(position);
    expect(notationText(setVariable(made, stmt, "target").main[0] as Stmt)).toBe("nums ← 0");
  });

  it("keeps its position when its form of another variable is set; a name alone drops it", () => {
    const set = assignTo({ kind: "index", list: v("nums"), index: v("i") }, num(1));
    const p = program([set]);
    expect(formIn(set, "target")).toBe("index");
    expect(notationText(setForm(p, set, "target", "index", "other").main[0] as Stmt)).toBe(
      "other[i] ← 1",
    );
    expect(notationText(setName(p, set, "target", "other").main[0] as Stmt)).toBe("other ← 1");
    expect(formIn(assign("x", num(0)), "target")).toBeUndefined();
  });

  it("names the words after its position, which `]` moves on from", () => {
    const stmt = assignTo(itemTarget("nums"), num(5));
    expect(wordsAfter(stmt, position)).toBe("]");
    expect(wordsAfter(stmt, { slot: "target", role: "target" })).toBe("←");
    expect(wordsAfter(stmt, { slot: "value", role: "expr" })).toBe("");
    // The `, ` between the values of a list of values is the slot's own; its bracket follows the last.
    const shown = ast.print(v("a"), v("b"));
    expect(wordsAfter(shown, { slot: "args", role: "expr", index: 0 })).toBe("");
    expect(wordsAfter(shown, { slot: "args", role: "expr", index: 1 })).toBe(")");
  });

  it("is its list's name, then its position as a value field, then the value", () => {
    const stmt = assignTo(itemTarget("nums"), num(5));
    expect(nameOf(stmt, "target")).toBe("nums");
    expect(fieldsOf(stmt)).toEqual([
      { slot: "target", role: "target" },
      position,
      { slot: "value", role: "expr" },
    ]);
    expect(valueOf(stmt, position)?.kind).toBe("empty");
    expect(fieldPath(position)).toBe("target.index");
    expect(fieldPath({ slot: "value", role: "expr" })).toBe("value");
  });

  it("takes the keyboard at its position, which a value written there fills", () => {
    const stmt = assignTo(itemTarget("nums"), num(5));
    const fields = fieldsOf(stmt);
    expect(startField(stmt, fields, { slot: null, hole: null })).toEqual(position);
    const hole = valueOf(stmt, position);
    expect(startField(stmt, fields, { slot: "target", hole: hole?.id ?? null })).toEqual(position);
    const filled = setExpr(program([stmt]), stmt.id, fieldPath(position), v("i"));
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
});
