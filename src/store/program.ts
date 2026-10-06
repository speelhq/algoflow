// C-13, L-53, L-55: the current program and challenge loading. Editing, history,
// and the 500 ms persistence writes arrive in M-04; this store only reads storage.
import { create } from "zustand";
import { getChallenge } from "@/challenges";
import { migrate } from "@/lang/migrate";
import type { Program } from "@/lang/types";

export const FREE = "free";

/** L-53: `algoflow:program:<challengeId | "free">`. */
export function programKey(challengeId: string | undefined): string {
  return `algoflow:program:${challengeId ?? FREE}`;
}

export function emptyProgram(title = ""): Program {
  return { version: 1, title, inputs: [], classes: [], functions: [], main: [] };
}

/** L-55: the stored value is the raw Program JSON; anything migrate() rejects is ignored. */
function readStored(key: string): Program | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : migrate(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/** C-13: storage, else `starter`, else an empty main; `challengeId` and `inputs` follow the challenge. */
export function restore(id: string): Program {
  const challenge = id === FREE ? undefined : getChallenge(id);
  const key = programKey(challenge?.id);
  const stored = readStored(key);
  if (!challenge) {
    const { challengeId: _ignored, ...free } = stored ?? emptyProgram();
    return { ...free, inputs: [] };
  }
  const base = stored ?? (challenge.starter ? structuredClone(challenge.starter) : emptyProgram());
  return { ...base, challengeId: challenge.id, inputs: structuredClone(challenge.inputs) };
}

export type ProgramState = {
  program: Program;
  /** Selects a challenge by id, or `"free"` for Playground (U-01 routes, S-07). */
  load: (id: string) => void;
};

export const useProgram = create<ProgramState>()((set) => ({
  program: restore(FREE),
  load: (id) => set({ program: restore(id) }),
}));
