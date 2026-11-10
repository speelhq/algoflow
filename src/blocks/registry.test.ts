// What every registered block definition owes the catalog and the chart.
import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import { flatten } from "@/i18n/flatten";
import { CATEGORIES } from "./categories";
import { BLOCK_DEFS } from "./registry";
import type { BlockDef, ChartForm } from "./types";

const keys = new Set(Object.keys(flatten(en)));

function regionsIn(chart: ChartForm): string[] {
  if ("branch" in chart) return [chart.branch.yes, chart.branch.no];
  if ("jump" in chart) return [];
  return "checked" in chart ? [chart.checked.body] : [chart.counted.body];
}

/** The slot a diamond's condition is in, for the forms that draw one. */
function conditionIn(chart: ChartForm): string | undefined {
  if ("branch" in chart) return chart.branch.cond;
  return "checked" in chart ? chart.checked.cond : undefined;
}

describe("registry", () => {
  it("the categories are in menu order", () => {
    expect(CATEGORIES).toEqual(["basic", "control", "list", "function", "dict"]);
  });

  it("only an expression has a literal, an operator, or a name slot", () => {
    const fixed = (def: BlockDef) =>
      def.slots.filter(
        (slot) => slot.role === "literal" || slot.role === "operator" || slot.role === "name",
      );
    const statements = [...BLOCK_DEFS.values()].filter((def) => def.shape === "stmt");
    expect(statements.length).toBeGreaterThan(0);
    for (const def of statements) expect(fixed(def), def.key).toEqual([]);
    const roles = [...BLOCK_DEFS.values()].flatMap((def) => fixed(def).map((slot) => slot.role));
    expect(new Set(roles)).toEqual(new Set(["literal", "operator", "name"]));
  });

  it("a binding slot stores an expression slot of its block, and a loop's stores none", () => {
    const stored = [...BLOCK_DEFS.values()].flatMap((def) =>
      def.slots.flatMap((slot) =>
        slot.role === "target" && slot.binds ? [{ def, stores: slot.stores }] : [],
      ),
    );
    expect(stored.map(({ def }) => def.key).toSorted()).toEqual(["assign", "for"]);
    for (const { def, stores } of stored) {
      if (def.loop) expect(stores, def.key).toBeUndefined();
      else expect(def.slots.find((slot) => slot.name === stores)?.role, def.key).toBe("expr");
    }
    // Only a binding slot names what it stores.
    for (const def of BLOCK_DEFS.values()) {
      for (const slot of def.slots) {
        if (slot.role === "target" && !slot.binds) expect(slot.stores, def.key).toBeUndefined();
      }
    }
  });

  it("break jumps out of the innermost loop and continue into its next pass", () => {
    expect(BLOCK_DEFS.get("break")?.chart).toEqual({ jump: "exit" });
    expect(BLOCK_DEFS.get("continue")?.chart).toEqual({ jump: "next" });
  });

  it("every block definition has label and help, and its notation no catalog key", () => {
    for (const key of BLOCK_DEFS.keys()) {
      for (const part of ["label", "help"]) {
        expect(keys.has(`block.${key}.${part}`), `block.${key}.${part}`).toBe(true);
      }
      expect(
        [...keys].filter((k) => k.startsWith(`block.${key}.template`)),
        key,
      ).toEqual([]);
    }
  });

  it("each slot a statement's editor shows as a field has its name", () => {
    for (const def of BLOCK_DEFS.values()) {
      if (def.shape !== "stmt") continue;
      for (const slot of def.slots) {
        if (slot.role === "body") continue;
        const key = `block.${def.key}.slot.${slot.name}`;
        expect(keys.has(key), key).toBe(true);
      }
    }
  });

  it("expression blocks declare the value list's entries in the table's order", () => {
    const any = "number,text,truefalse,none,list,dict";
    const rows = [...BLOCK_DEFS.values()].flatMap((def) =>
      (def.entries ?? []).map((entry) =>
        [
          def.key,
          entry.name,
          entry.group,
          entry.on?.join(",") ?? "",
          entry.symbol ?? "",
          entry.typed ?? "",
        ].join(" | "),
      ),
    );
    expect(rows).toEqual([
      "str |  | values |  |  | ",
      "bool | true | values |  |  | ",
      "bool | false | values |  |  | ",
      "none |  | values |  |  | ",
      "list | empty | values |  |  | []",
      "unop | not | conditions |  | not | not",
      "call:randint |  | calculate |  |  | randint",
      "index |  | items | list |  | [",
      "call:len |  | items | list,text,dict |  | len",
      "call:sum |  | items | list |  | sum",
      "binop | and | conditions | truefalse | and | and",
      "binop | or | conditions | truefalse | or | or",
      "binop | add | calculate | number,text | + | +",
      "binop | sub | calculate | number | - | -",
      "binop | mul | calculate | number | * | *",
      "binop | div | calculate | number | / | /",
      "binop | mod | calculate | number | % | %",
      "binop | floorDiv | calculate | number | // | //",
      "binop | pow | calculate | number | ** | **",
      "binop | join | items | list | + | ",
      `binop | eq | compare | ${any} | == | ==`,
      `binop | ne | compare | ${any} | != | !=`,
      "binop | lt | compare | number,text | < | <",
      "binop | le | compare | number,text | <= | <=",
      "binop | gt | compare | number,text | > | >",
      "binop | ge | compare | number,text | >= | >=",
      `binop | in | compare | ${any} | in | in`,
      "call:abs |  | calculate | number |  | abs",
      "call:max |  | calculate | number,text |  | max",
      "call:min |  | calculate | number,text |  | min",
      `call:str |  | convert | ${any} |  | str`,
      "call:int |  | convert | number,text |  | int",
      "call:float |  | convert | number,text |  | float",
    ]);
  });

  it("no two entries name the same keys", () => {
    const typed = [...BLOCK_DEFS.values()].flatMap((def) =>
      (def.entries ?? []).flatMap((entry) => (entry.typed === undefined ? [] : [entry.typed])),
    );
    expect(typed.length).toBeGreaterThan(0);
    expect(new Set(typed).size).toBe(typed.length);
  });

  it("a named entry has its label and help, and no help names the entry's keys", () => {
    for (const def of BLOCK_DEFS.values()) {
      for (const entry of def.entries ?? []) {
        const base = entry.name === "" ? `block.${def.key}` : `block.${def.key}.${entry.name}`;
        expect(keys.has(`${base}.label`), `${base}.label`).toBe(true);
        const help = flatten(en)[`${base}.help`] ?? "";
        expect(help, base).not.toContain("Type `");
      }
    }
  });

  it("a chart names the body slots of its block, and a diamond's condition an expr slot", () => {
    const drawn = [...BLOCK_DEFS.values()].filter((def) => def.chart);
    expect(new Set(drawn.map((def) => def.key))).toEqual(
      new Set(["if", "while", "for", "break", "continue"]),
    );
    for (const def of drawn) {
      const regions = def.chart ? regionsIn(def.chart) : [];
      const bodies = def.slots.filter((slot) => slot.role === "body").map((slot) => slot.name);
      expect(new Set(regions)).toEqual(new Set(bodies));
      const cond = def.chart ? conditionIn(def.chart) : undefined;
      if (cond !== undefined) {
        expect(def.slots.find((slot) => slot.name === cond)?.role, def.key).toBe("expr");
      }
    }
  });

  it("a counted loop's generated texts name only its own slots, and its notation is its init", () => {
    for (const def of BLOCK_DEFS.values()) {
      if (!def.chart || !("counted" in def.chart)) continue;
      const { init, check, update } = def.chart.counted;
      const named = [init, check, update].flatMap((text) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((found) => found[1]),
      );
      const slots = def.slots.map((slot) => slot.name);
      for (const name of named) expect(slots, def.key).toContain(name);
      expect(def.notation(def.create()), def.key).toBe(init);
    }
  });
});
