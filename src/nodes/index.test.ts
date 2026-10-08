// N-02, N-09: what every registered block owes the catalog and the chart.
import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import { flatten } from "@/i18n/flatten";
import { CATEGORIES } from "./categories";
import { NODES } from "./index";
import type { ChartShape } from "./types";

const keys = new Set(Object.keys(flatten(en)));

function regionsIn(chart: ChartShape): string[] {
  if ("branch" in chart) return [chart.branch.yes, chart.branch.no];
  if ("jump" in chart) return [];
  return "check" in chart ? [chart.check] : [chart.counted];
}

describe("registry (N-02, N-09)", () => {
  it("N-01: the categories are in menu order", () => {
    expect(CATEGORIES).toEqual(["basic", "control", "list", "function", "dict", "class"]);
  });

  it("N-09: break jumps out of the innermost loop and continue into its next pass", () => {
    expect(NODES.get("break")?.chart).toEqual({ jump: "exit" });
    expect(NODES.get("continue")?.chart).toEqual({ jump: "next" });
  });

  it("N-02: every block has label, template, and help", () => {
    for (const key of NODES.keys()) {
      for (const part of ["label", "template", "help"]) {
        expect(keys.has(`node.${key}.${part}`), `node.${key}.${part}`).toBe(true);
      }
    }
  });

  it("N-02, N-11: every menu entry has its label and help, and its preset slots exist", () => {
    for (const def of NODES.values()) {
      for (const entry of def.menu ?? []) {
        const base = entry.name === "" ? `node.${def.key}` : `node.${def.key}.${entry.name}`;
        for (const part of ["label", "help"]) {
          expect(keys.has(`${base}.${part}`), `${base}.${part}`).toBe(true);
        }
        for (const slot of Object.keys(entry.preset ?? {})) {
          const known = def.slots.some((s) => s.name === slot) || slot === "value";
          expect(known, `${def.key}.${slot}`).toBe(true);
        }
      }
    }
  });

  it("N-11: the operators' entries and their keys", () => {
    const binop = NODES.get("binop")?.menu ?? [];
    expect(binop.map((entry) => entry.keys)).toEqual([
      "+",
      "-",
      "*",
      "/",
      "%",
      "//",
      "**",
      "==",
      "!=",
      "<",
      "<=",
      ">",
      ">=",
      "in",
      "and",
      "or",
      "+",
    ]);
    expect(binop.find((entry) => entry.name === "or")).toMatchObject({
      group: "combine",
      on: ["truefalse"],
    });
  });

  it("N-09: a chart names body slots of its block; a counted loop has init, check, and step", () => {
    const shaped = [...NODES.values()].filter((def) => def.chart);
    expect(new Set(shaped.map((def) => def.key))).toEqual(
      new Set(["if", "while", "for", "break", "continue"]),
    );
    for (const def of shaped) {
      const regions = def.chart ? regionsIn(def.chart) : [];
      const bodies = def.slots.filter((slot) => slot.role === "body").map((slot) => slot.name);
      expect(new Set(regions)).toEqual(new Set(bodies));
      if (def.chart && "counted" in def.chart) {
        for (const part of ["init", "check", "step"]) {
          expect(keys.has(`node.${def.key}.${part}`), `node.${def.key}.${part}`).toBe(true);
        }
      }
    }
  });
});
