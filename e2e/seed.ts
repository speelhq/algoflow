// Storage the app reads on load: progress and a program. A stored program puts a finished
// chart on the page in one step; the editing tests build theirs through the editor.
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

export async function seedProgress(page: Page, entries: Record<string, unknown>): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("algoflow:progress", value);
  }, JSON.stringify(entries));
}

/** A challenge's solution, as `challenges/<id>.json` holds it. */
export function readSolution(id: string): Record<string, unknown> {
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

/** Lists Playground programs, each stored with `seedProgram`, under `algoflow:playground`. */
export async function seedPlayground(
  page: Page,
  index: Record<string, { edited: number }>,
): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("algoflow:playground", value);
  }, JSON.stringify(index));
}

/**
 * A program whose print reads `total`, which a loop's body first assigns: its print carries the
 * diagnostic `E_DECLARE_FIRST`, with a fix, on the chart node `dgn-prnt-001`.
 */
export function declareFirstProgram(): Record<string, unknown> {
  const loop = {
    id: "dgn-loop-001",
    type: "for",
    var: { id: "dgn-lvar-001", type: "var", name: "i" },
    start: { id: "dgn-zero-001", type: "num", value: 0, float: false, raw: "0" },
    stop: { id: "dgn-stop-001", type: "num", value: 3, float: false, raw: "3" },
    body: [
      {
        id: "dgn-sets-001",
        type: "assign",
        target: { id: "dgn-tgt-0001", type: "var", name: "total" },
        value: { id: "dgn-ivar-001", type: "var", name: "i" },
      },
    ],
  };
  const out = {
    id: "dgn-prnt-001",
    type: "print",
    args: [{ id: "dgn-tvar-001", type: "var", name: "total" }],
  };
  return programWith([loop, out]);
}

/** A stored program for problem id with main as given (opening the problem restores challengeId and inputs). */
export function programWith(main: unknown[]): Record<string, unknown> {
  return { version: 1, title: "", inputs: [], classes: [], functions: [], main };
}
