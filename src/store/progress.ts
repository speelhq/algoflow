// C-17: per-problem progress under `algoflow:progress`. An entry appears on the first
// submission, hint, or shown solution; `solved` is never cleared. The stored value is the
// bare record of C-17, validated when read back, so storage never yields a malformed entry.
import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { isRecord } from "@/i18n/flatten";
import { clamp } from "./layout";

export const PROGRESS_STORAGE_KEY = "algoflow:progress";

/** C-22: a challenge has exactly three hints. */
export const HINTS = 3;

export type ProgressStatus = "attempted" | "solved";
export type ProgressEntry = { status: ProgressStatus; hints: number; solution: boolean };
export type Progress = Record<string, ProgressEntry>;

export type ProgressState = {
  entries: Progress;
  /** U-80: records a submission; an accepted one makes the problem solved. */
  submitted: (id: string, accepted: boolean) => void;
  /** U-21: records that `count` hints are revealed; the number never goes down. */
  hintShown: (id: string, count: number) => void;
  /** U-22 */
  solutionShown: (id: string) => void;
};

const FRESH: ProgressEntry = { status: "attempted", hints: 0, solution: false };

/** U-10: the status mark of a problem row; undefined while untouched. */
export function statusOf(entries: Progress, id: string): ProgressStatus | undefined {
  return Object.hasOwn(entries, id) ? entries[id]?.status : undefined;
}

/** U-12: `n of m solved`. */
export function solvedCount(entries: Progress, ids: readonly string[]): number {
  return ids.filter((id) => statusOf(entries, id) === "solved").length;
}

function entryOf(value: unknown): ProgressEntry | undefined {
  if (!isRecord(value) || Array.isArray(value)) return undefined;
  if (value.status !== "attempted" && value.status !== "solved") return undefined;
  const hints = typeof value.hints === "number" && Number.isFinite(value.hints) ? value.hints : 0;
  return {
    status: value.status,
    hints: clamp(Math.round(hints), 0, HINTS),
    solution: value.solution === true,
  };
}

/** Validates a stored record; malformed entries are dropped. */
export function readProgress(stored: unknown): Progress {
  const entries: Progress = {};
  if (!isRecord(stored) || Array.isArray(stored)) return entries;
  for (const [id, value] of Object.entries(stored)) {
    const entry = entryOf(value);
    if (entry) entries[id] = entry;
  }
  return entries;
}

type Persisted = { entries: Progress };

/** C-17: the key holds `Record<id, entry>` itself, with no wrapper around it. */
const storage: PersistStorage<Persisted> = {
  getItem(name) {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(name);
      if (raw === null) return null;
      const stored: unknown = JSON.parse(raw);
      return { state: { entries: readProgress(stored) } };
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(name, JSON.stringify(value.state.entries));
    }
  },
  removeItem(name) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(name);
  },
};

export const useProgress = create<ProgressState>()(
  persist(
    (set) => {
      const update = (id: string, change: (entry: ProgressEntry) => ProgressEntry) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [id]: change((Object.hasOwn(state.entries, id) && state.entries[id]) || FRESH),
          },
        }));
      return {
        entries: {},
        submitted: (id, accepted) =>
          update(id, (entry) => ({
            ...entry,
            status: accepted || entry.status === "solved" ? "solved" : "attempted",
          })),
        hintShown: (id, count) =>
          update(id, (entry) => ({
            ...entry,
            hints: Math.max(entry.hints, clamp(Math.round(count), 0, HINTS)),
          })),
        solutionShown: (id) => update(id, (entry) => ({ ...entry, solution: true })),
      };
    },
    {
      name: PROGRESS_STORAGE_KEY,
      storage,
      partialize: ({ entries }) => ({ entries }),
    },
  ),
);
