// @vitest-environment jsdom
// The selection holds a statement of the open program only (`chart.md`, Editing on the chart,
// Selection and keys): selecting or leading to any other node id throws.
import { describe, expect, it } from "vitest";
import { ast, program, tid } from "@/blocks/testing";
import type { Diagnostic } from "@/lang/types";
import { useEditor } from "./editor";
import { useProgram } from "./program";

const { num, print, ret, v } = ast;

describe("the selection", () => {
  const value = v("a");
  const body = ret(value);
  const fn = { id: tid(), name: "f", params: ["a"], body: [body] };
  const shown = print(num(1));
  const led = (nodeId: string): Diagnostic => ({ nodeId, code: "E_UNDEFINED", params: {} });

  it("takes a statement of the open program, a function's statement among them", () => {
    useProgram.setState({ program: program([shown], { functions: [fn] }) });
    useEditor.getState().select(shown.id);
    expect(useEditor.getState().selectedId).toBe(shown.id);
    useEditor.getState().lead(body.id, led(value.id));
    expect(useEditor.getState()).toMatchObject({ selectedId: body.id, editing: true });
    useEditor.getState().select(null);
    expect(useEditor.getState().selectedId).toBeNull();
  });

  it("clears when an edit or an undo removes the selected statement", () => {
    useProgram.setState({ program: program([shown], { functions: [fn] }) });
    useEditor.getState().select(body.id);
    useProgram.setState({ program: program([shown], { functions: [{ ...fn, body: [] }] }) });
    expect(useEditor.getState()).toMatchObject({ selectedId: null, editing: false });
  });

  it("refuses a function, an expression, and a node id the program doesn't hold", () => {
    useProgram.setState({ program: program([shown], { functions: [fn] }) });
    for (const id of [fn.id, value.id, tid()]) {
      expect(() => useEditor.getState().select(id)).toThrow();
      expect(() => useEditor.getState().lead(id, led(id))).toThrow();
    }
    expect(useEditor.getState().selectedId).toBeNull();
  });
});
