// What the chart tests share: a chart laid out for a routine the test knows the program holds.
import type { Program } from "@/lang/types";
import { layout, type ChartLayout, type LayoutOptions } from "./layout";

/** The chart of `opts.routine`; throws when the routine names no function. */
export function getLayout(program: Program, opts: LayoutOptions): ChartLayout {
  const chart = layout(program, opts);
  if (!chart) throw new Error(`no chart of ${opts.routine}`);
  return chart;
}
