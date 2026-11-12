// A diagnostic goes to the chart node of its node's owner, a statement's or a function's `Start`.
import { describe, expect, it } from "vitest";
import { ast, program, tid } from "@/blocks/testing";
import { estimatedWidth } from "@/ui/chart/layout";
import { nodeFor } from "@/ui/chart/paint";
import { laidOut } from "@/ui/chart/testing";
import { validate } from "@/lang/validate";
import { editorDiagnostics, flaggedOwners, ledDraft } from "./diagnostics";

const { assign, assignTo, bin, call, draft, empty, num, print, ret, v } = ast;

describe("flaggedOwners", () => {
  it("puts a function's diagnostic on its chart's Start, and an expression's on its statement", () => {
    const body = ret(v("a"));
    const twice = { id: tid(), name: "twice", params: ["a", "a"], body: [body] };
    const unknown = call("missing");
    const shown = print(unknown);
    const p = program([assign("n", num(1)), shown], { functions: [twice] });
    const flagged = flaggedOwners(p, null);

    expect(flagged.get(twice.id)?.map((d) => d.code)).toEqual(["E_DUPLICATE_NAME"]);
    expect(flagged.get(shown.id)?.map((d) => d.code)).toEqual(["E_UNKNOWN_CALL"]);
    const chart = laidOut(p, { routine: twice.id, inputs: {}, measure: estimatedWidth });
    expect(nodeFor(chart.nodes, twice.id)?.role).toBe("start");
  });

  it("shows no diagnostic of a draft, an empty slot included", () => {
    const typed = assign("x", draft("1 +"));
    const unfinished = print(empty());
    const unknown = print(draft("xs.nope()"));
    const p = program([typed, unfinished, unknown, print(v("y"))]);
    expect(validate(p).map((d) => d.code)).toEqual([
      "E_PARSE_SYNTAX",
      "E_EMPTY_SLOT",
      "E_UNKNOWN_CALL",
      "E_UNDEFINED",
    ]);
    expect([...flaggedOwners(p, null).values()].flat().map((d) => d.code)).toEqual(["E_UNDEFINED"]);
  });

  it("shows no diagnostic of a statement whose editor has a field with the keyboard", () => {
    const typed = print(v("tot"));
    const other = print(v("y"));
    const p = program([typed, other]);
    expect([...flaggedOwners(p, typed.id).keys()]).toEqual([other.id]);
    expect([...flaggedOwners(p, null).keys()]).toEqual([typed.id, other.id]);
  });
});

describe("editorDiagnostics", () => {
  it("leads with the diagnostic Run led to, which stays while a field has the keyboard", () => {
    const typed = print(v("tot"));
    const p = program([typed]);
    const [undefinedName] = validate(p);
    expect(editorDiagnostics(p, typed.id, undefinedName ?? null, null)).toEqual([undefinedName]);
    expect(editorDiagnostics(p, typed.id, undefinedName ?? null, typed.id)).toEqual([
      undefinedName,
    ]);
    expect(editorDiagnostics(p, typed.id, null, typed.id)).toEqual([]);
    // It comes first even when validation reports another of the block's first.
    const both = print(v("c"), v("b"));
    const q = program([both]);
    const [first, second] = validate(q);
    expect(editorDiagnostics(q, both.id, second ?? null, null)).toEqual([second, first]);
  });

  it("shows no message for a draft at its top, which its value line underlines from the error", () => {
    const typed = draft("1 +");
    const drafted = print(typed);
    const target = assignTo(bin("+", v("a"), num(1)), num(0));
    const p = program([drafted]);
    const [syntax] = validate(p);
    expect(editorDiagnostics(p, drafted.id, syntax ?? null, null)).toEqual([]);
    expect(ledDraft(p, drafted, syntax ?? null)).toEqual({
      diagnostic: syntax,
      draft: typed.id,
      from: 3,
    });
    expect(ledDraft(p, drafted, null)).toBeUndefined();
    // A target's text that parses as no target is underlined in full.
    const notTarget = { ...target, target: draft("a + 1") };
    const q = program([notTarget]);
    const [error] = validate(q);
    expect(ledDraft(q, notTarget, error ?? null)?.from).toBe(0);
  });
});
