// Storage the app reads on load: progress (C-17) and a problem's program (L-53, C-13). Until
// editing exists (M-04), the stored program is how a test puts a chart on the page.
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

export async function seedProgress(page: Page, entries: Record<string, unknown>): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("algoflow:progress", value);
  }, JSON.stringify(entries));
}

/** A challenge's solution, as `challenges/<id>.json` holds it. */
export function solutionOf(id: string): Record<string, unknown> {
  const file: unknown = JSON.parse(readFileSync(`challenges/${id}.json`, "utf8"));
  const solution = (file as { solution: Record<string, unknown> }).solution;
  return solution;
}

export async function seedProgram(page: Page, id: string, program: unknown): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [`algoflow:program:${id}`, JSON.stringify(program)] as const,
  );
}
