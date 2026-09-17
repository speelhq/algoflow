// N-02, N-09: what every registered block owes the catalog and the chart.
import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import { flatten } from "@/i18n/flatten";
import { NODES } from "./index";
import type { ChartShape } from "./types";

const keys = new Set(Object.keys(flatten(en)));

function regionsIn(chart: ChartShape): string[] {
  if ("branch" in chart) return [chart.branch.yes, chart.branch.no];
  return "check" in chart ? [chart.check] : [chart.counted];
}

describe("registry (N-02, N-09)", () => {
  it("N-02: every block has label, template, and help", () => {
    for (const key of NODES.keys()) {
      for (const part of ["label", "template", "help"]) {
        expect(keys.has(`node.${key}.${part}`), `node.${key}.${part}`).toBe(true);
      }
    }
  });

  it("N-09: a chart names body slots of its block; a counted loop has init, check, and step", () => {
    const shaped = [...NODES.values()].filter((def) => def.chart);
    expect(new Set(shaped.map((def) => def.key))).toEqual(new Set(["if", "while", "for"]));
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
