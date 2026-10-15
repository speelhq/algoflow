// A field of the editor's notation is named by the block's label and the slot's name; a
// counted loop shows its init and its check, its variable a field only at the first.
import { describe, expect, it } from "vitest";
import { ast } from "@/blocks/testing";
import { getBlock } from "@/blocks/registry";
import type { Stmt } from "@/lang/types";
import {
  editedLines,
  fieldLabel,
  fieldsOf,
  nameOf,
  startField,
  targetSlot,
  valueOf,
  wordsAfter,
} from "./fields";

const { assign, assignTo, print, for_, num, v, exprStmt, ret } = ast;

describe("fieldLabel", () => {
  it("names a field by the block's label and the slot's name", () => {
    const set = assign("total", num(1));
    const field = (slot: string) => ({ slot, role: "expr" as const });
    expect(fieldLabel(set, field("value"))).toBe("Set variable, value");
    expect(fieldLabel(print(v("total")), field("args"))).toBe("Print, value");
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

describe("a target", () => {
  it("is a value field, its line keeping a target, as a name slot is a name field", () => {
    const stmt = assignTo(ast.item(v("nums"), ast.empty()), num(5));
    expect(fieldsOf(stmt)).toEqual([
      { slot: "target", role: "expr" },
      { slot: "value", role: "expr" },
    ]);
    expect(valueOf(stmt, { slot: "target", role: "expr" })).toBe(stmt.target);
    expect(targetSlot(stmt, { slot: "target", role: "expr" })).toMatchObject({ binds: true });
    expect(targetSlot(stmt, { slot: "value", role: "expr" })).toBeUndefined();
    // A new assignment's target is to fill first; a click on an item's position opens the target.
    const fields = fieldsOf(stmt);
    const fresh = getBlock("assign").create() as Stmt;
    expect(startField(fresh, fieldsOf(fresh), { slot: null, hole: null })).toEqual(fields[0]);
    const hole = (stmt.target as Extract<typeof stmt.target, { kind: "index" }>).index;
    expect(startField(stmt, fields, { slot: "target", hole: hole.id })).toEqual(fields[0]);
  });

  it("names the words after a field, which a key beginning them moves on from", () => {
    const stmt = assign("total", num(5));
    expect(wordsAfter(stmt, { slot: "target", role: "expr" })).toBe("←");
    expect(wordsAfter(stmt, { slot: "value", role: "expr" })).toBe("");
    // After an item of a list of values the notation writes `, `, and its bracket after the last.
    const shown = ast.print(v("a"), v("b"));
    expect(wordsAfter(shown, { slot: "args", role: "expr", index: 0 })).toBe(",");
    expect(wordsAfter(shown, { slot: "args", role: "expr", index: 1 })).toBe(")");
  });

  it("is named by the block's label and the slot's name", () => {
    expect(fieldLabel(assign("total", num(1)), { slot: "target", role: "expr" })).toBe(
      "Set variable, variable",
    );
    expect(nameOf(for_("i", num(0), num(3), []), "var")).toBe("i");
  });
});
