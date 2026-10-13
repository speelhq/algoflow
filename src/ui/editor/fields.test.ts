// A field of the editor's notation is named by the block's label and the slot's name; a
// counted loop shows its init and its check, its variable a field only at the first.
import { describe, expect, it } from "vitest";
import { ast } from "@/nodes/testing";
import { editedLines, fieldLabel, fieldsOf } from "./fields";

const { assign, print, for_, num, v, exprStmt, ret } = ast;

describe("fieldLabel", () => {
  it("names a field by the block's label and the slot's name", () => {
    const set = assign("total", num(1));
    expect(fieldLabel(set, "target")).toBe("Set variable, variable");
    expect(fieldLabel(set, "value")).toBe("Set variable, value");
    expect(fieldLabel(print(v("total")), "args")).toBe("Print, value");
    expect(fieldLabel(for_("i", num(0), num(3), []), "stop")).toBe("For loop, stop");
    expect(fieldLabel(exprStmt(ast.call("max", v("a"), num(1))), "expr")).toBe(
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
