// C-14: the browser bundles `challenges/*.json` at build time; S-05 orders the tracks.
import { TRACKS, type Challenge, type Track } from "./types";

const modules = import.meta.glob<Challenge>("../../challenges/*.json", {
  eager: true,
  import: "default",
});

const rank = (challenge: Challenge) => TRACKS.indexOf(challenge.track);

export const CHALLENGES: readonly Challenge[] = Object.values(modules).toSorted(
  (a, b) => rank(a) - rank(b) || a.order - b.order,
);

export function getChallenge(id: string | undefined): Challenge | undefined {
  return id === undefined ? undefined : CHALLENGES.find((challenge) => challenge.id === id);
}

/** Tracks in S-05 order, each with its challenges by `order`; empty tracks are omitted. */
export const CHALLENGE_GROUPS: ReadonlyArray<{ track: Track; challenges: Challenge[] }> =
  TRACKS.map((track) => ({
    track,
    challenges: CHALLENGES.filter((challenge) => challenge.track === track),
  })).filter((group) => group.challenges.length > 0);

export type { Challenge, Localized, Test, Track } from "./types";
