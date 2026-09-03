import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { ast, eventTypes, program, runAll } from "./testing";

const { comment, assign, num } = ast;

describe("comment (03-nodes)", () => {
  it("N-03: emits `# <text>`", () => {
    expect(emit(program([comment("swap the pair")])).code).toBe("# swap the pair\n");
  });

  it("T-02 / R-03: one enter event and no effect", () => {
    const result = runAll(program([comment("note"), assign("x", num(1))]));
    expect(eventTypes(result.events)).toEqual(["enter", "enter", "write"]);
  });
});
