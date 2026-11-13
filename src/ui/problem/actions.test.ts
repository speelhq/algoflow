// @vitest-environment jsdom
// Run with diagnostics leads to the first one's owner: a statement is selected with its message,
// and a function's diagnostic selects nothing, since the selection holds a statement only.
import { afterEach, describe, expect, it } from "vitest";
import { ast, createTestId } from "@/blocks/testing";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { clickChartNode, startRun } from "./actions";

const { call, num, print, ret, v, program } = ast;

describe("Run with diagnostics", () => {
  afterEach(() => {
    useRun.getState().stop();
    useEditor.getState().select(null);
  });

  it("selects the statement that holds an expression's diagnostic, with its message", () => {
    const unknown = call("missing");
    const shown = print(unknown);
    useProgram.setState({ program: program([shown]) });
    startRun();
    expect(useEditor.getState()).toMatchObject({ selectedId: shown.id, editing: true });
    expect(useEditor.getState().ledDiagnostic?.code).toBe("E_UNKNOWN_CALL");
    expect(useRun.getState().status).toBe("idle");
  });

  it("clears the selection for a function's diagnostic, and a click on its Start selects nothing", () => {
    const shown = print(num(1));
    const twice = { id: createTestId(), name: "twice", params: ["a", "a"], body: [ret(v("a"))] };
    useProgram.setState({ program: program([shown], { functions: [twice] }) });
    useEditor.getState().select(shown.id);
    startRun();
    expect(useEditor.getState()).toMatchObject({ selectedId: null, ledDiagnostic: null });
    expect(useRun.getState().status).toBe("idle");
    clickChartNode(twice.id);
    expect(useEditor.getState().selectedId).toBeNull();
  });
});
