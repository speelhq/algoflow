// The current program and challenge loading. Editing, history,
// and the 500 ms persistence writes arrive in M-04; this store only reads storage.
import { create } from "zustand";
import { getChallenge } from "@/challenges";
import { migrate } from "@/lang/migrate";
import type { Program } from "@/lang/types";
import { readStored } from "./storage";

export const FREE = "free";
export const PROGRAM_KEY_PREFIX = "algoflow:program:";

/** `algoflow:program:<challengeId | "free">`. */
export function programKey(challengeId: string | undefined): string {
  return `${PROGRAM_KEY_PREFIX}${challengeId ?? FREE}`;
}

export function emptyProgram(title = ""): Program {
  return { version: 1, title, inputs: [], classes: [], functions: [], main: [] };
}

/** The stored value is the raw Program JSON; anything migrate() rejects is ignored. */
function readProgram(key: string): Program | undefined {
  return readStored(key, (stored) => {
    try {
      return migrate(stored);
    } catch {
      return undefined;
    }
  });
}

/** Storage, else an empty main; `challengeId` and `inputs` follow the challenge. */
export function restore(id: string): Program {
  const challenge = id === FREE ? undefined : getChallenge(id);
  const key = programKey(challenge?.id);
  const stored = readProgram(key);
  if (!challenge) {
    const { challengeId: _ignored, ...free } = stored ?? emptyProgram();
    return { ...free, inputs: [] };
  }
  const base = stored ?? emptyProgram();
  return { ...base, challengeId: challenge.id, inputs: structuredClone(challenge.inputs) };
}

export type ProgramState = {
  program: Program;
  /** Selects a challenge by id, or `"free"` for Playground (the Problem and Playground routes). */
  load: (id: string) => void;
};

export const useProgram = create<ProgramState>()((set) => ({
  program: restore(FREE),
  load: (id) => set({ program: restore(id) }),
}));
