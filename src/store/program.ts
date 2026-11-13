// The open program, its undo history, and its persistence. A problem's program is
// stored under its challenge id, a Playground program under its Playground id; a save
// follows 500 ms after the last edit, or comes at once when the page is hidden.
import { create } from "zustand";
import { findChallenge } from "@/challenges";
import { migrate } from "@/lang/migrate";
import type { Program } from "@/lang/types";
import { asPlayground, forget, isPlaygroundId, createPlaygroundId, touch } from "./playground";
import { readStored, writeStored } from "./storage";

export const PROGRAM_STORAGE_PREFIX = "algoflow:program:";
/** Programs kept for undo. */
export const HISTORY = 100;
/** Milliseconds from the last edit to its save. */
export const SAVE_DELAY = 500;

/** `algoflow:program:<challengeId | playground id>`. */
export function programKey(id: string): string {
  return `${PROGRAM_STORAGE_PREFIX}${id}`;
}

export function createProgram(title: string): Program {
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
  if (isPlaygroundId(id)) return asPlayground(stored ?? createProgram(""));
  const challenge = findChallenge(id);
  if (!challenge) return createProgram("");
  const base = stored ?? createProgram("");
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
  const id = createPlaygroundId();
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
  /** The field the last change was typed into; null after any other change. */
  lastField: string | null;
  /** Opens the program stored under `id` (the Problem and Playground program routes). */
  load: (id: string) => void;
  /** Replaces the program as a history entry of its own, saved after the delay. */
  edit: (next: Program) => void;
  /**
   * Replaces the program with `next`, typed into `field`, saved after the delay. It joins the
   * last history entry when the last change was typed into the same field (`language.md`,
   * Edits, History).
   */
  typeInto: (next: Program, field: string) => void;
  undo: () => void;
  redo: () => void;
};

export const useProgram = create<ProgramState>()((set, get) => {
  /** Sets the program and its history, and schedules the save. */
  const replace = (
    program: Program,
    history: Pick<ProgramState, "past" | "future" | "lastField">,
  ) => {
    set({ program, ...history });
    scheduleSave(get().id, program);
  };
  /**
   * Replaces the program with `next`, and makes or joins a history entry. `field` is the field
   * `next` was typed into, or null.
   */
  const commit = (next: Program, field: string | null) => {
    const { program, past, lastField } = get();
    // An edit that changes nothing (a drop where the block already is) is no history entry.
    if (next === program || JSON.stringify(next) === JSON.stringify(program)) return;
    const shouldJoin = field !== null && field === lastField;
    replace(next, {
      past: shouldJoin ? past : [...past, program].slice(-HISTORY),
      future: [],
      lastField: field,
    });
  };
  return {
    program: createProgram(""),
    id: "",
    past: [],
    future: [],
    lastField: null,
    load: (id) => {
      flushSave();
      set({ program: restore(id), id, past: [], future: [], lastField: null });
    },
    edit: (next) => commit(next, null),
    typeInto: (next, field) => commit(next, field),
    undo: () => {
      const { program, past, future } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      replace(previous, { past: past.slice(0, -1), future: [...future, program], lastField: null });
    },
    redo: () => {
      const { program, past, future } = get();
      const next = future[future.length - 1];
      if (!next) return;
      replace(next, { past: [...past, program], future: future.slice(0, -1), lastField: null });
    },
  };
});
