// C-14: every challenge file is bundled; S-05 orders tracks, `order` orders within a track.
import { describe, expect, it } from "vitest";
import { CHALLENGES, challengesByTrack, getChallenge } from "./index";
import { TRACKS } from "./types";

describe("challenge bundle (C-14)", () => {
  it("loads every challenges/*.json with id, tests, and solution", () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(5);
    for (const challenge of CHALLENGES) {
      expect(challenge.tests.length).toBeGreaterThanOrEqual(3);
      expect(challenge.solution.challengeId).toBe(challenge.id);
    }
  });

  it("orders by track (S-05) then order", () => {
    const day1 = CHALLENGES.filter((c) => c.track === "day1").map((c) => c.id);
    expect(day1).toEqual(["tutorial", "sum-to-n", "fizzbuzz", "max-of-three", "countdown"]);
    const ranks = CHALLENGES.map((c) => TRACKS.indexOf(c.track) * 1000 + c.order);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("looks up by id and groups non-empty tracks", () => {
    expect(getChallenge("fizzbuzz")?.title.en).toBe("FizzBuzz");
    expect(getChallenge("nope")).toBeUndefined();
    expect(getChallenge(undefined)).toBeUndefined();
    const groups = challengesByTrack();
    expect(groups[0]?.track).toBe("day1");
    expect(groups.every((g) => g.challenges.length > 0)).toBe(true);
  });
});
