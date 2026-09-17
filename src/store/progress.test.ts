// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { PROGRESS_STORAGE_KEY, readProgress, solvedCount, statusOf, useProgress } from "./progress";

const stored = (): unknown => JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? "null");

describe("progress store (C-17)", () => {
  beforeEach(() => {
    localStorage.clear();
    useProgress.setState({ entries: {} });
  });

  it("an entry appears on the first submission, hint, or shown solution", () => {
    expect(statusOf(useProgress.getState().entries, "fizzbuzz")).toBeUndefined();
    useProgress.getState().submitted("fizzbuzz", false);
    useProgress.getState().hintShown("gcd", 1);
    useProgress.getState().solutionShown("hanoi");
    expect(useProgress.getState().entries).toEqual({
      fizzbuzz: { status: "attempted", hints: 0, solution: false },
      gcd: { status: "attempted", hints: 1, solution: false },
      hanoi: { status: "attempted", hints: 0, solution: true },
    });
  });

  it("an accepted submission solves the problem, and solved is never cleared", () => {
    const { submitted } = useProgress.getState();
    submitted("fizzbuzz", true);
    submitted("fizzbuzz", false);
    expect(useProgress.getState().entries.fizzbuzz?.status).toBe("solved");
  });

  it("hints is the number revealed: it never goes down and stays within 0–3", () => {
    const { hintShown } = useProgress.getState();
    hintShown("fizzbuzz", 2);
    hintShown("fizzbuzz", 1);
    expect(useProgress.getState().entries.fizzbuzz?.hints).toBe(2);
    hintShown("fizzbuzz", 9);
    expect(useProgress.getState().entries.fizzbuzz?.hints).toBe(3);
  });

  it("U-10, U-12: the status mark of a row and the solved count of a plan", () => {
    const { submitted } = useProgress.getState();
    submitted("tutorial", true);
    submitted("sum-to-n", false);
    const { entries } = useProgress.getState();
    expect(statusOf(entries, "tutorial")).toBe("solved");
    expect(statusOf(entries, "sum-to-n")).toBe("attempted");
    expect(statusOf(entries, "toString")).toBeUndefined();
    expect(solvedCount(entries, ["tutorial", "sum-to-n", "fizzbuzz"])).toBe(1);
  });

  it("persists the bare record under algoflow:progress", () => {
    useProgress.getState().submitted("fizzbuzz", true);
    expect(stored()).toEqual({ fizzbuzz: { status: "solved", hints: 0, solution: false } });
    expect(localStorage.length).toBe(1);
  });

  it("validates a stored record instead of trusting it", async () => {
    expect(
      readProgress({
        ok: { status: "solved", hints: 2, solution: true },
        loose: { status: "attempted", hints: 40, solution: "yes" },
        bad: { status: "won" },
        worse: [1, 2],
      }),
    ).toEqual({
      ok: { status: "solved", hints: 2, solution: true },
      loose: { status: "attempted", hints: 3, solution: false },
    });
    expect(readProgress("nonsense")).toEqual({});

    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ gcd: { status: "solved" } }));
    await useProgress.persist.rehydrate();
    expect(useProgress.getState().entries).toEqual({
      gcd: { status: "solved", hints: 0, solution: false },
    });
    localStorage.setItem(PROGRESS_STORAGE_KEY, "{not json");
    await useProgress.persist.rehydrate();
    expect(useProgress.getState().entries).toEqual({
      gcd: { status: "solved", hints: 0, solution: false },
    });
  });
});
