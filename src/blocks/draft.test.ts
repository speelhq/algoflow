import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { emptyExpr, getBlockDef, menuBlockDefs } from "./registry";
import { ast, evalExpr, notation } from "./testing";

describe("draft (language.md, Expressions, Drafts)", () => {
  it("emits its text, so the Python tab shows what the learner is correcting", () => {
    expect(unparse(ast.draft("1 +"))).toBe("1 +");
  });

  it("emits `...` with no text, so a program with an empty slot still renders as Python", () => {
    expect(unparse(ast.empty())).toBe("...");
    expect(unparse(ast.bin("+", ast.num(1), ast.empty()))).toBe("1 + ...");
  });

  it("makes an empty slot a draft with no text", () => {
    expect(emptyExpr()).toMatchObject({ type: "draft", text: "" });
    expect(getBlockDef("draft").create()).toMatchObject({ type: "draft", text: "" });
  });

  it("is hidden from the block menu", () => {
    expect(menuBlockDefs("basic").some((def) => def.key === "draft")).toBe(false);
    expect(getBlockDef("draft").hidden).toBe(true);
  });

  it("holds one line of text, as a field does", () => {
    const def = getBlockDef("draft");
    expect(def.fieldsError?.({ text: "a + b" })).toBeUndefined();
    expect(def.fieldsError?.({ text: "a\nb" })).toEqual({
      field: "text",
      message: "expected one line of text",
    });
    expect(def.fieldsError?.({})).toMatchObject({ field: "text" });
  });

  it("cannot run: the interpreter refuses a draft it is given", () => {
    const slot = ast.draft("x +");
    expect(() => evalExpr(slot)).toThrow(`draft ${slot.id} cannot run`);
  });
});

describe("notation (blocks.md, Notation)", () => {
  it("writes its text", () => {
    expect(notation(ast.draft("nums.pop("))).toBe("nums.pop(");
    expect(notation(ast.empty())).toBe("");
  });
});
