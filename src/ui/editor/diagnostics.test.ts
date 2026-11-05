// A diagnostic goes to the chart node of its node's owner, a statement's or a function's `Start`.
import { describe, expect, it } from "vitest";
import { ast, program, tid } from "@/blocks/testing";
import { estimatedWidth } from "@/ui/chart/layout";
import { nodeFor } from "@/ui/chart/paint";
import { laidOut } from "@/ui/chart/testing";
import { flaggedOwners } from "./diagnostics";

const { assign, call, num, print, ret, v } = ast;

describe("flaggedOwners", () => {
  it("puts a function's diagnostic on its chart's Start, and an expression's on its statement", () => {
    const body = ret(v("a"));
    const twice = { id: tid(), name: "twice", params: ["a", "a"], body: [body] };
    const unknown = call("missing");
    const shown = print(unknown);
    const p = program([assign("n", num(1)), shown], { functions: [twice] });
    const flagged = flaggedOwners(p);

    expect(flagged.get(twice.id)?.map((d) => d.code)).toEqual(["E_DUPLICATE_NAME"]);
    expect(flagged.get(shown.id)?.map((d) => d.code)).toEqual(["E_UNKNOWN_CALL"]);
    const chart = laidOut(p, { routine: twice.id, inputs: {}, measure: estimatedWidth });
    expect(nodeFor(chart.nodes, twice.id)?.role).toBe("start");
  });
});
