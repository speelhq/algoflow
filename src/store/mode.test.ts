// The page's mode, from the driver's status and the shown solution.
import { describe, expect, it } from "vitest";
import { editable, inRun, deriveMode, type Mode } from "./mode";

const MODES: Mode[] = ["build", "solution", "running", "ended"];

describe("deriveMode", () => {
  it("is build or solution while idle, running before the end, and ended at it", () => {
    expect(deriveMode("idle", false)).toBe("build");
    expect(deriveMode("idle", true)).toBe("solution");
    expect(deriveMode("playing", false)).toBe("running");
    expect(deriveMode("paused", false)).toBe("running");
    expect(deriveMode("done", false)).toBe("ended");
    expect(deriveMode("error", false)).toBe("ended");
  });

  it("only build mode edits; running and ended are run mode", () => {
    expect(MODES.map(editable)).toEqual([true, false, false, false]);
    expect(MODES.map(inRun)).toEqual([false, false, true, true]);
  });
});
