// The statement-identifier check. The identifiers here are built at run time, so that this
// file cites none of the specification's.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoFiles } from "./lib/files";
import {
  checkSpecIds,
  failed,
  formatReport,
  nextId,
  SPEC_README,
  specFiles,
  type SpecIdReport,
} from "./lib/spec-ids";

const id = (prefix: string, n: number) => `${prefix}-${String(n).padStart(2, "0")}`;
const [L1, L2, L3, L9, U7, U8, V1] = [
  id("L", 1),
  id("L", 2),
  id("L", 3),
  id("L", 9),
  id("U", 7),
  id("U", 8),
  id("V", 1),
];
const LANGUAGE = "docs/spec/language/language.md";

const README = [
  "# Specification",
  "",
  "## Files",
  "",
  "| Folder | File | Ids | Defines |",
  "| --- | --- | --- | --- |",
  "| `language/` | `language.md` | L | the language |",
  "| `ui/` | `pages.md` | U | pages |",
  "| | `views.md` | V | views |",
  "",
  "## Terms",
  "",
].join("\n");

let root: string;

function write(rel: string, text: string) {
  const path = join(root, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

function check(): SpecIdReport {
  return checkSpecIds(root, repoFiles(root));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "algoflow-spec-ids-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  write(SPEC_README, README);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("specFiles", () => {
  it("reads each prefix's files from the Files table, a blank folder continuing the last", () => {
    expect(specFiles(README)).toEqual(
      new Map([
        ["L", [LANGUAGE]],
        ["U", ["docs/spec/ui/pages.md"]],
        ["V", ["docs/spec/ui/views.md"]],
      ]),
    );
  });

  it("refuses an Ids cell that is no list of prefixes", () => {
    expect(() => specFiles(README.replace("| V |", "| — |"))).toThrow(/not a list of prefixes/);
  });
});

describe("checkSpecIds: definitions", () => {
  it("defines at a paragraph start, under a heading, or in a table's first cell", () => {
    write(
      LANGUAGE,
      [
        "# Language",
        `${L1} The first statement.`,
        "",
        `|${L2}| the second |`,
        "",
        "A paragraph that wraps and ends with",
        `${L3} on its second line, which cites it.`,
        "",
        "````md",
        "```",
        "",
        `${L9} inside a fence that a shorter one does not close cites it.`,
        "````python",
        "",
        `${L9} inside it still: a fence with an info string closes nothing.`,
        "````",
        "```inline``` code at a line's start opens no fence.",
        "",
        `|${L2}| defined again, so the fence above stayed shut |`,
        "  ~~~",
        "```",
        "",
        `${L9} inside a fence that a backtick fence does not close cites it.`,
        "  ~~~",
        `${U7} after a fence opens a paragraph, here in the wrong file.`,
      ].join("\n"),
    );
    const report = check();
    expect([...report.defined.keys()]).toEqual([L1, L2, U7]);
    expect(report.unknown).toEqual([
      { id: L3, file: LANGUAGE, line: 7 },
      { id: L9, file: LANGUAGE, line: 12 },
      { id: L9, file: LANGUAGE, line: 15 },
      { id: L9, file: LANGUAGE, line: 23 },
    ]);
    expect(report.duplicates).toEqual([{ id: L2, file: LANGUAGE, line: 19 }]);
  });

  it("reports a second definition, and one in a file its prefix does not name", () => {
    write(LANGUAGE, `${L1} One.\n\n${L1} Again.\n\n${U7} Not a language statement.\n`);
    write("docs/spec/ui/notes.md", `${V1} In no file of the table.\n`);
    const report = check();
    expect(report.duplicates).toEqual([{ id: L1, file: LANGUAGE, line: 3 }]);
    expect(report.misplaced).toEqual([
      { id: U7, file: LANGUAGE, line: 5 },
      { id: V1, file: "docs/spec/ui/notes.md", line: 1 },
    ]);
  });

  it("reads the decisions of a folder as citations, never definitions", () => {
    write(LANGUAGE, `${L1} One.\n`);
    write("docs/spec/language/decisions.md", `${L2} at a paragraph start cites it.\n`);
    expect(check().unknown).toEqual([{ id: L2, file: "docs/spec/language/decisions.md", line: 1 }]);
  });
});

describe("checkSpecIds: citations", () => {
  it("reads every other identifier on a definition's line", () => {
    write(LANGUAGE, `${L1} Like ${L9}.\n\n| ${L2} | per ${L9} |\n`);
    expect(check().unknown).toEqual([
      { id: L9, file: LANGUAGE, line: 1 },
      { id: L9, file: LANGUAGE, line: 3 },
    ]);
  });

  it("reports a range however it is written", () => {
    write(LANGUAGE, `${L1} One.\n\n${L2} Two.\n`);
    const joins = ["..", "...", "…", " .. "];
    const ranges = [
      ...joins.flatMap((joiner) => [`${L1}${joiner}${L2}`, `${L1}${joiner}02`]),
      `${L1}..${L2.replace("02", "01")}`,
    ];
    write("ARCHITECTURE.md", ranges.map((range) => `See ${range}.`).join("\n"));
    expect(check().ranges.map((r) => [r.id, r.line])).toEqual(ranges.map((_, i) => [L1, i + 1]));
  });

  it("reads identifiers joined by words or dashes as citations, not a range", () => {
    write(LANGUAGE, `${L1} One.\n\n${L2} Two.\n`);
    write("docs/spec/ui/pages.md", `${U7} Pages.\n`);
    write(
      "ARCHITECTURE.md",
      [
        `Compare ${L1} to ${L2}; ${L1} — an aside — ${L2}; ${U7} maps to ${L2}.`,
        `The chart follows ${L1}`,
        `- ${L2} adds the rest, and ${L1} takes 10 to 50 ms, ${L2} through 12 steps.`,
      ].join("\n"),
    );
    const report = check();
    expect(report.ranges).toEqual([]);
    expect(failed(report)).toBe(false);
  });

  it("reads every Markdown file, skips a binary one, and reports an unknown id", () => {
    write(LANGUAGE, `${L1} One.\n`);
    write(".github/pull_request_template.md", `Cites ${U8}.\n`);
    write("docs/design/a.png", `\0PNG ${U7}`);
    write("README.md", `An emphasised _${L9}_ is still cited.\n`);
    const report = check();
    expect(report.unknown).toEqual([
      { id: U8, file: ".github/pull_request_template.md", line: 1 },
      { id: L9, file: "README.md", line: 1 },
    ]);
    expect(report.elsewhere).toEqual([]);
  });

  it("passes when every citation is defined and written out", () => {
    write(LANGUAGE, `${L1} One.\n\n| ${L2} | two |\n`);
    write("src/lang/a.test.ts", `// ${L1}, ${L2}\n`);
    const report = check();
    expect(failed(report)).toBe(false);
    expect(formatReport(report)).toEqual(["spec ids: 2 defined, 2 citations, ok"]);
  });
});

describe("checkSpecIds: other files", () => {
  beforeEach(() => write(LANGUAGE, `${L1} One.\n`));

  it("reports an identifier anywhere in code or data, in any language", () => {
    write("src/lang/a.ts", `const s = "${L1}"; // ${L1}..${L2}\n`);
    write("src/ui/theme.css", `/* ${L1} */\n`);
    write(".github/workflows/ci.yml", `# ${L1}\n`);
    write("tsconfig.json", `{ // ${L1}\n}\n`);
    write("challenges/a.json", `{ "hint": "${L1}" }\n`);
    write("src/i18n/en.json", `{ "key": "${L1}" }\n`);
    write("scripts/lib/check.ts", `problems.push("hints must be exactly 3 (${L1})");\n`);
    const report = check();
    expect(report.elsewhere).toEqual([
      { id: L1, file: ".github/workflows/ci.yml", line: 1 },
      { id: L1, file: "challenges/a.json", line: 1 },
      { id: L1, file: "scripts/lib/check.ts", line: 1 },
      { id: L1, file: "src/i18n/en.json", line: 1 },
      { id: L1, file: "src/lang/a.ts", line: 1 },
      { id: L1, file: "src/lang/a.ts", line: 1 },
      { id: L2, file: "src/lang/a.ts", line: 1 },
      { id: L1, file: "src/ui/theme.css", line: 1 },
      { id: L1, file: "tsconfig.json", line: 1 },
    ]);
    expect(report.ranges).toEqual([]);
    expect(report.citations).toBe(0);
  });

  it("lets tests and their helpers cite identifiers", () => {
    write("src/lang/a.test.ts", `// ${L1}\n`);
    write("e2e/a.spec.ts", `// ${L1}\n`);
    write("e2e/seed.ts", `// ${L1}\n`);
    expect(check().elsewhere).toEqual([]);
  });
});

describe("nextId", () => {
  it("takes the number after the highest of its prefix, wherever it is defined", () => {
    const defined = new Map([
      [id("U", 9), { file: "a.md", line: 1 }],
      [id("U", 12), { file: "b.md", line: 1 }],
      [id("L", 40), { file: "c.md", line: 1 }],
    ]);
    expect(nextId(defined, "U")).toBe(id("U", 13));
    expect(nextId(defined, "S")).toBe(id("S", 1));
  });
});
