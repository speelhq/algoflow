import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoFiles } from "./lib/files";
import { checkReferences, formatReferences, headings } from "./lib/references";

// The spec files here are named so that no real spec file has their names, because the check
// reads this file's text too.
let root: string;

function write(rel: string, text: string) {
  const path = join(root, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

const run = () => checkReferences({ root, files: repoFiles(root) });
const named = () => run().map((b) => `${b.cited} ${b.heading}`);
const SPEC = [
  "# Sample",
  "",
  "## Shapes",
  "",
  "### Loops (`for`, `while`)",
  "",
  "## Input chart nodes",
  "",
  "### Errors",
  "",
  "## Help and `⋯`",
  "",
  "### Errors",
  "",
  "#### Overflow",
  "",
  "```ts",
  "## Not a heading",
  "```",
  "",
].join("\n");

describe("headings", () => {
  it("lists the headings below the title outside fenced code, each with the ones it sits under", () => {
    expect(headings(SPEC)).toEqual([
      { text: "Shapes", names: ["Shapes"], path: [] },
      {
        text: "Loops (`for`, `while`)",
        names: ["Loops (`for`, `while`)", "Loops"],
        path: ["Shapes"],
      },
      { text: "Input chart nodes", names: ["Input chart nodes"], path: [] },
      { text: "Errors", names: ["Errors"], path: ["Input chart nodes"] },
      { text: "Help and `⋯`", names: ["Help and `⋯`"], path: [] },
      { text: "Errors", names: ["Errors"], path: ["Help and `⋯`"] },
      { text: "Overflow", names: ["Overflow"], path: ["Help and `⋯`", "Errors"] },
    ]);
  });
});

describe("the reference check", () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "algoflow-references-"));
    execFileSync("git", ["init", "-q"], { cwd: root });
    write("docs/spec/ui/sample.md", SPEC);
    write("docs/spec/ui/other.md", "# Other\n\n## Path and marks\n");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("passes a file and its heading, a heading under it, and a heading without its handles", () => {
    write(
      "docs/spec/ui/other.md",
      "# Other\n\nSee (`sample.md`, Input chart nodes) and (`sample.md`, Shapes, Loops).\n",
    );
    write("src/a.ts", "// Drawn as `docs/spec/ui/sample.md`, Shapes, states.\n");
    write("src/a.test.ts", 'describe("loops (sample.md, Loops)", () => {});\n');
    write("docs/design/README.md", "| a | `sample.md`, Shapes; Input chart nodes |\n");
    expect(run()).toEqual([]);
    expect(formatReferences([])).toEqual(["references: ok"]);
  });

  it("reports a heading the cited file doesn't hold, with the line it starts on", () => {
    write("docs/spec/ui/other.md", "# Other\n\nOne line.\n\nSee (`sample.md`, Input nodes).\n");
    const broken = run();
    expect(broken).toEqual([
      { file: "docs/spec/ui/other.md", line: 5, cited: "sample.md", heading: "Input nodes" },
    ]);
    expect(formatReferences(broken)).toEqual([
      'docs/spec/ui/other.md:5 no heading "Input nodes" in sample.md',
      "references: 1 problem(s)",
    ]);
  });

  it("reports words after a heading that no comma, semicolon, colon, period, or parenthesis ends", () => {
    write("src/b.ts", "// (`sample.md`, Shapes of loops) and as `sample.md`, Shapes states it.\n");
    expect(named()).toEqual(["sample.md Shapes of loops", "sample.md Shapes states it"]);
  });

  it("reads a file name with capitals, digits, or hyphens", () => {
    write("docs/spec/Sample-2.md", "# Sample\n\n## Kinds\n");
    write("src/c.ts", "// (`Sample-2.md`, Kinds) and (`docs/spec/Sample-2.md`, Kind)\n");
    expect(named()).toEqual(["docs/spec/Sample-2.md Kind"]);
  });

  it("reads a heading wrapped across lines, in Markdown and in a comment", () => {
    write(
      "docs/spec/ui/other.md",
      "# Other\n\nSee (`sample.md`, Input  \n  chart nodes) and (`sample.md`, Input\nnode).\n",
    );
    write(
      "src/d.ts",
      "// as `sample.md`, Input\n// chart nodes, states\nconst x = 1; // (`sample.md`, Shape)\n",
    );
    expect(run()).toEqual([
      { file: "docs/spec/ui/other.md", line: 4, cited: "sample.md", heading: "Input node" },
      { file: "src/d.ts", line: 3, cited: "sample.md", heading: "Shape" },
    ]);
  });

  it("joins no line that starts an item of its own, and no line of code after a comment", () => {
    write(
      "docs/spec/ui/other.md",
      "# Other\n\n- `sample.md`, Shapes\n- Gone\n\n| `sample.md`, Shapes |\n| Gone |\n",
    );
    write("src/e.ts", "const a = 1; // `sample.md`, Shapes\nConst();\n");
    expect(run()).toEqual([]);
  });

  it("reports a heading that doesn't sit under the one before it", () => {
    write("docs/spec/ui/other.md", "# Other\n\nSee (`sample.md`, Input chart nodes, Loops).\n");
    expect(named()).toEqual(["sample.md Loops"]);
  });

  it("finds a heading under any of the headings that share a name", () => {
    write("docs/spec/ui/other.md", "# Other\n\nSee (`sample.md`, Errors, Overflow).\n");
    expect(run()).toEqual([]);
  });

  it("reads each heading after a semicolon in the same file, and a file after it on its own", () => {
    write(
      "docs/design/README.md",
      "| a | `sample.md`, Shapes; Input chart nodes; Inputs; `other.md`, Gone |\n",
    );
    expect(named()).toEqual(["sample.md Inputs", "other.md Gone"]);
  });

  it("ends a reference at a lower-case word or a code span, and skips a file outside the spec", () => {
    write(
      "docs/spec/ui/other.md",
      "# Other\n\nOf `sample.md`, not `hidden`. (`sample.md`, `x`) (`CLAUDE.md`, Judgment)\n",
    );
    expect(run()).toEqual([]);
  });

  it("reads a parenthesis in a spec file's prose that opens with a capital letter", () => {
    write(
      "docs/spec/ui/other.md",
      [
        "# Other",
        "",
        "## Path and marks",
        "",
        "See (Path and marks) and (Paths). (`hidden`) (a note) `print(None)`",
        "",
        "  ```ts",
        "  x(Unread);",
        "  ```",
        "",
      ].join("\n"),
    );
    write("docs/spec/ui/third.md", "# Third\n\n## Help and `⋯`\n\nSee (Help and `⋯`).\n");
    write("src/f.ts", "// (Path and marks) is read only in the spec.\n");
    expect(run()).toEqual([
      { file: "docs/spec/ui/other.md", line: 5, cited: "other.md", heading: "Paths" },
    ]);
  });
});
