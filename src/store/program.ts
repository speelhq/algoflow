// The open program, its undo history, and its persistence. A problem's program is
// stored under its challenge id, a Playground program under its Playground id; a save
// follows 500 ms after the last edit, or comes at once when the page is hidden.
import { create } from "zustand";
import { getChallenge } from "@/challenges";
import { migrate } from "@/lang/migrate";
import type { Program } from "@/lang/types";
import { asPlayground, forget, isPlaygroundId, newPlaygroundId, touch } from "./playground";
import { readStored, writeStored } from "./storage";

export const PROGRAM_KEY_PREFIX = "algoflow:program:";
/** Programs kept for undo. */
export const HISTORY = 100;
/** Milliseconds from the last edit to its save. */
export const SAVE_DELAY = 500;

/** `algoflow:program:<challengeId | playground id>`. */
export function programKey(id: string): string {
  return `${PROGRAM_KEY_PREFIX}${id}`;
}

export function emptyProgram(title = ""): Program {
  return { version: 1, title, inputs: [], classes: [], functions: [], main: [] };
}

/** The stored value is the raw Program JSON; anything migrate() rejects is ignored. */
function readProgram(id: string): Program | undefined {
  return readStored(programKey(id), (stored) => {
    try {
      return migrate(stored);
    } catch {
      return undefined;
    }
  });
}

/** The title of a stored program, or undefined when none is stored under `id`. */
export function storedTitle(id: string): string | undefined {
  return readProgram(id)?.title;
}

/**
 * A Playground program from storage without `challengeId` or inputs; a problem's
 * program from storage, else an empty main, with the challenge's `challengeId` and inputs.
 */
export function restore(id: string): Program {
  const stored = readProgram(id);
  if (isPlaygroundId(id)) return asPlayground(stored ?? emptyProgram());
  const challenge = getChallenge(id);
  if (!challenge) return emptyProgram();
  const base = stored ?? emptyProgram();
  return { ...base, challengeId: challenge.id, inputs: structuredClone(challenge.inputs) };
}

// ---------------------------------------------------------------- saving

let pending: { id: string; program: Program } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function save(id: string, program: Program): void {
  if (id === "") return;
  writeStored(programKey(id), program);
  if (isPlaygroundId(id)) touch(id);
}

/** Writes the edit waiting for its delay, if any. */
export function flushSave(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  const due = pending;
  pending = null;
  if (due) save(due.id, due.program);
}

function scheduleSave(id: string, program: Program): void {
  if (pending && pending.id !== id) flushSave();
  pending = { id, program };
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(flushSave, SAVE_DELAY);
}

if (typeof window !== "undefined") window.addEventListener("pagehide", flushSave);

/** Stores `program` as a new Playground program at once and returns its id. */
export function createPlaygroundProgram(program: Program): string {
  const id = newPlaygroundId();
  save(id, asPlayground(program));
  return id;
}

/** Removes a Playground program from storage, with any save still waiting for it. */
export function deletePlaygroundProgram(id: string): void {
  if (pending?.id === id) {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = null;
  }
  forget(id, programKey(id));
}

// ---------------------------------------------------------------- the store

export type ProgramState = {
  program: Program;
  /** The id the program is stored under: a challenge id or a Playground id; "" before any is open. */
  id: string;
  /** Earlier programs, the latest last, and the programs undone, the next to redo last. */
  past: Program[];
  future: Program[];
  /** Opens the program stored under `id` (the Problem and Playground program routes). */
  load: (id: string) => void;
  /**
   * Replaces the program as one history entry, saved after the delay; consecutive edits
   * that name the same `field` (typing into one input) share one entry.
   */
  edit: (next: Program, field?: string) => void;
  undo: () => void;
  redo: () => void;
};

/** The field of the last edit, while consecutive edits may share its history entry. */
let lastField: string | undefined;

export const useProgram = create<ProgramState>()((set, get) => {
  const change = (program: Program, past: Program[], future: Program[]) => {
    set({ program, past, future });
    scheduleSave(get().id, program);
  };
  return {
    program: emptyProgram(),
    id: "",
    past: [],
    future: [],
    load: (id) => {
      flushSave();
      lastField = undefined;
      set({ program: restore(id), id, past: [], future: [] });
    },
    edit: (next, field) => {
      const { program, past } = get();
      // An edit that changes nothing (a drop where the node already is) is no history entry.
      if (next === program || JSON.stringify(next) === JSON.stringify(program)) return;
      const joins = field !== undefined && field === lastField && past.length > 0;
      lastField = field;
      change(next, joins ? past : [...past, program].slice(-HISTORY), []);
    },
    undo: () => {
      const { program, past, future } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      lastField = undefined;
      change(previous, past.slice(0, -1), [...future, program]);
    },
    redo: () => {
      const { program, past, future } = get();
      const next = future[future.length - 1];
      if (!next) return;
      lastField = undefined;
      change(next, [...past, program], future.slice(0, -1));
    },
  };
});
