// What every registered block owes the catalog and the chart.
import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import { flatten } from "@/i18n/flatten";
import { CATEGORIES } from "./categories";
import { NODES } from "./registry";
import type { ChartShape } from "./types";

const keys = new Set(Object.keys(flatten(en)));

function regionsIn(chart: ChartShape): string[] {
  if ("branch" in chart) return [chart.branch.yes, chart.branch.no];
  if ("jump" in chart) return [];
  return "check" in chart ? [chart.check.body] : [chart.counted.body];
}

/** The slot a diamond's condition is in, for the shapes that draw one. */
function conditionIn(chart: ChartShape): string | undefined {
  if ("branch" in chart) return chart.branch.cond;
  return "check" in chart ? chart.check.cond : undefined;
}

describe("registry", () => {
  it("the categories are in menu order", () => {
    expect(CATEGORIES).toEqual(["basic", "control", "list", "function", "dict"]);
  });

  it("only an expression has a text slot", () => {
    const statements = [...NODES.values()].filter((def) => def.shape === "stmt");
    expect(statements.length).toBeGreaterThan(0);
    for (const def of statements) {
      expect(
        def.slots.filter((slot) => slot.role === "text"),
        def.key,
      ).toEqual([]);
    }
    expect([...NODES.values()].some((def) => def.slots.some((s) => s.role === "text"))).toBe(true);
  });

  it("break jumps out of the innermost loop and continue into its next pass", () => {
    expect(NODES.get("break")?.chart).toEqual({ jump: "exit" });
    expect(NODES.get("continue")?.chart).toEqual({ jump: "next" });
  });

  it("every block has label and help, and its notation no catalog key", () => {
    for (const key of NODES.keys()) {
      for (const part of ["label", "help"]) {
        expect(keys.has(`node.${key}.${part}`), `node.${key}.${part}`).toBe(true);
      }
      expect(
        [...keys].filter((k) => k.startsWith(`node.${key}.template`)),
        key,
      ).toEqual([]);
    }
  });

  it("each slot a statement's editor shows as a field has its name", () => {
    for (const def of NODES.values()) {
      if (def.shape !== "stmt") continue;
      for (const slot of def.slots) {
        if (slot.role === "body") continue;
        const key = `node.${def.key}.slot.${slot.name}`;
        expect(keys.has(key), key).toBe(true);
      }
    }
  });

  it("binop writes school symbols, and Python's where school has none", () => {
    const binop = NODES.get("binop");
    const node = (op: string) => ({ id: "b", kind: "binop", op }) as never;
    const school = ["+", "-", "*", "/", "==", "!=", "<", "<=", ">", ">="];
    expect(school.map((op) => binop?.text?.(node(op), "op"))).toEqual([
      "+",
      "−",
      "×",
      "÷",
      "=",
      "≠",
      "<",
      "≤",
      ">",
      "≥",
    ]);
    const python = ["%", "//", "**", "and", "or", "in"];
    expect(python.map((op) => binop?.text?.(node(op), "op"))).toEqual(python);
  });

  it("expression blocks declare the value list's entries in the table's order", () => {
    const any = "number,text,truefalse,none,list,dict";
    const rows = [...NODES.values()].flatMap((def) =>
      (def.menu ?? []).map((entry) =>
        [
          def.key,
          entry.name,
          entry.group,
          entry.on?.join(",") ?? "",
          entry.symbol ?? "",
          entry.keys ?? "",
        ].join(" | "),
      ),
    );
    expect(rows).toEqual([
      "str |  | values |  |  | ",
      "bool | true | values |  |  | ",
      "bool | false | values |  |  | ",
      "none |  | values |  |  | ",
      "list |  | values |  |  | [",
      "unop | not | conditions |  | not | not",
      "call:randint |  | calculate |  |  | randint",
      "index |  | items | list |  | ",
      "call:len |  | items | list,text,dict |  | len",
      "call:sum |  | items | list |  | sum",
      "binop | and | conditions | truefalse | and | and",
      "binop | or | conditions | truefalse | or | or",
      "binop | add | calculate | number,text | + | +",
      "binop | sub | calculate | number | − | -",
      "binop | mul | calculate | number | × | *",
      "binop | div | calculate | number | ÷ | /",
      "binop | mod | calculate | number | % | %",
      "binop | floorDiv | calculate | number | // | //",
      "binop | pow | calculate | number | ** | **",
      "binop | join | items | list | + | ",
      `binop | eq | compare | ${any} | = | ==`,
      `binop | ne | compare | ${any} | ≠ | !=`,
      "binop | lt | compare | number,text | < | <",
      "binop | le | compare | number,text | ≤ | <=",
      "binop | gt | compare | number,text | > | >",
      "binop | ge | compare | number,text | ≥ | >=",
      `binop | in | compare | ${any} | in | in`,
      "call:abs |  | calculate | number |  | abs",
      "call:max |  | calculate | number,text |  | max",
      "call:min |  | calculate | number,text |  | min",
      `call:str |  | convert | ${any} |  | str`,
      "call:int |  | convert | number,text |  | int",
      "call:float |  | convert | number,text |  | float",
    ]);
  });

  it("a named entry has its label and help, and no help names the entry's keys", () => {
    for (const def of NODES.values()) {
      for (const entry of def.menu ?? []) {
        const base = entry.name === "" ? `node.${def.key}` : `node.${def.key}.${entry.name}`;
        expect(keys.has(`${base}.label`), `${base}.label`).toBe(true);
        const help = flatten(en)[`${base}.help`] ?? "";
        expect(help, base).not.toContain("Type `");
      }
    }
  });

  it("a chart names the body slots of its block, and a diamond's condition an expr slot", () => {
    const shaped = [...NODES.values()].filter((def) => def.chart);
    expect(new Set(shaped.map((def) => def.key))).toEqual(
      new Set(["if", "while", "for", "break", "continue"]),
    );
    for (const def of shaped) {
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
    for (const def of NODES.values()) {
      if (!def.chart || !("counted" in def.chart)) continue;
      const { init, check, step } = def.chart.counted;
      const named = [init, check, step].flatMap((text) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((found) => found[1]),
      );
      const slots = def.slots.map((slot) => slot.name);
      for (const name of named) expect(slots, def.key).toContain(name);
      expect(def.notation(def.create()), def.key).toBe(init);
    }
  });
});
