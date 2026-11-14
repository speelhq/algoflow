// The size of a pull request (CLAUDE.md, Issues and pull requests).
import { describe, expect, it } from "vitest";
import { countLines, parseGeneratedPaths, parseNumstat } from "./lib/size";

describe("parseNumstat", () => {
  it("reads each file's lines, a binary file as none, and a renamed file under its new path", () => {
    const output = ["12\t3\tsrc/a.ts", "-\t-\te2e/shot.png", "0\t0\t", "old/b.ts", "new/b.ts", ""];
    expect(parseNumstat(output.join("\0"))).toEqual([
      { path: "src/a.ts", added: 12, deleted: 3 },
      { path: "e2e/shot.png", added: 0, deleted: 0 },
      { path: "new/b.ts", added: 0, deleted: 0 },
    ]);
    expect(parseNumstat("")).toEqual([]);
  });
});

describe("parseGeneratedPaths", () => {
  it("takes the paths whose linguist-generated attribute is set or true", () => {
    const output = [
      ["pnpm-lock.yaml", "linguist-generated", "set"],
      ["src/a.ts", "linguist-generated", "unspecified"],
      ["dist/x.js", "linguist-generated", "true"],
      ["src/b.ts", "linguist-generated", "false"],
    ];
    expect(parseGeneratedPaths(`${output.flat().join("\0")}\0`)).toEqual(
      new Set(["pnpm-lock.yaml", "dist/x.js"]),
    );
  });
});

describe("countLines", () => {
  it("adds the lines added and deleted, and leaves out the generated files", () => {
    const files = [
      { path: "src/a.ts", added: 12, deleted: 3 },
      { path: "pnpm-lock.yaml", added: 400, deleted: 380 },
      { path: "src/b.ts", added: 0, deleted: 5 },
    ];
    expect(countLines(files, new Set(["pnpm-lock.yaml"]))).toEqual({
      lines: 20,
      counted: 2,
      leftOut: 1,
    });
  });
});
