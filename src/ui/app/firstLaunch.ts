// With no work stored, a load at the Problems route opens the first problem of the
// first study plan. Only progress and programs count as work; the layout key does not.
import type { Plan } from "@/challenges";
import { PROGRAM_KEY_PREFIX } from "@/store/program";
import { PROGRESS_STORAGE_KEY } from "@/store/progress";
import { routeHash } from "./route";

/** The hashes of the Problems route itself; an unknown hash that falls back to it is not one. */
const PROBLEMS_HASHES: ReadonlySet<string> = new Set(["", "#", "#/"]);

/** The hash to open instead of `hash`, or null to keep it. */
export function firstLaunchTarget(
  hash: string,
  keys: readonly string[],
  plans: readonly Plan[],
): string | null {
  if (!PROBLEMS_HASHES.has(hash)) return null;
  const worked = keys.some(
    (key) => key === PROGRESS_STORAGE_KEY || key.startsWith(PROGRAM_KEY_PREFIX),
  );
  const first = plans[0]?.problems[0];
  return worked || first === undefined ? null : routeHash({ page: "problem", id: first });
}
