// C-14: every challenge file is bundled; U-12 orders by plan order then title; C-16 plans.
import { describe, expect, it } from "vitest";
import { CHALLENGES, getChallenge, PLANS, planOf, planRank } from "./index";

describe("challenge bundle (C-14, C-16)", () => {
  it("loads every challenges/*.json with id, tests, and solution; plans.json is not one", () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(5);
    for (const challenge of CHALLENGES) {
      expect(challenge.tests.length).toBeGreaterThanOrEqual(3);
      expect(challenge.solution.challengeId).toBe(challenge.id);
      expect(challenge.difficulty).toMatch(/^(easy|medium|hard)$/);
      expect(challenge.topics.length).toBeGreaterThan(0);
    }
    expect(CHALLENGES.some((c) => c.id === "plans")).toBe(false);
  });

  it("orders by plan order (U-12), then title", () => {
    const course = PLANS.find((plan) => plan.id === "course");
    expect(course).toBeDefined();
    expect(CHALLENGES.slice(0, course?.problems.length).map((c) => c.id)).toEqual(course?.problems);
    const rest = CHALLENGES.slice(course?.problems.length).map((c) => c.title.en);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
  });

  it("every plan member is a bundled challenge (C-16)", () => {
    expect(PLANS.map((plan) => plan.id)).toEqual(["course"]);
    for (const plan of PLANS) {
      for (const id of plan.problems) expect(getChallenge(id)?.id).toBe(id);
    }
  });

  it("ranks members before non-members and finds a challenge's plan", () => {
    expect(planRank("tutorial")).toBeLessThan(planRank("sum-to-n"));
    expect(planRank("nope")).toBe(Number.MAX_SAFE_INTEGER);
    expect(planRank("nope") - planRank("also-nope")).toBe(0);
    expect(planOf("fizzbuzz")?.id).toBe("course");
    expect(planOf("nope")).toBeUndefined();
  });

  it("looks up by id", () => {
    expect(getChallenge("fizzbuzz")?.title.en).toBe("FizzBuzz");
    expect(getChallenge("nope")).toBeUndefined();
    expect(getChallenge(undefined)).toBeUndefined();
  });
});
