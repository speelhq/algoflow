// The statement identifiers of the specification: where each is defined, and every citation of
// one in the repository, as docs/spec/README.md states them (Files, Requirement identifiers).
// Run by `pnpm spec` and by `pnpm check`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lineOf, lineStarts } from "./lines";

/** The file whose Files table names every prefix and the spec files that hold it. */
export const SPEC_README = "docs/spec/README.md";

/** Each prefix and the spec files, relative to the root, that hold its statements. */
export type SpecFiles = ReadonlyMap<string, readonly string[]>;
export type Place = { file: string; line: number };
export type Cited = Place & { id: string };
export type Definitions = {
  /** Each defined identifier and where it is defined first. */
  defined: Map<string, Place>;
  /** A definition of an identifier defined earlier. */
  duplicates: Cited[];
  /** A definition in a file the Files table does not name for its prefix. */
  misplaced: Cited[];
};
export type SpecIdReport = Definitions & {
  /** A citation of an identifier no statement defines. */
  unknown: Cited[];
  /** A citation of a range; `id` is its first identifier. */
  ranges: Cited[];
  /** An identifier in a file other than Markdown or a test. */
  elsewhere: Cited[];
  /** How many citations were read. */
  citations: number;
};

/**
 * Reads the Files table of the spec README: rows of folder, file, and prefixes, a blank folder
 * cell continuing the folder of the row above.
 */
export function specFiles(readme: string): SpecFiles {
  const section = readme.split(/^## /m).find((part) => part.startsWith("Files\n"));
  if (section === undefined) throw new Error(`${SPEC_README} has no Files section`);
  const files = new Map<string, string[]>();
  let folder = "";
  for (const row of section.split("\n")) {
    const cells = row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replaceAll("`", ""));
    const [folderCell, file, prefixes] = cells;
    if (file === undefined || prefixes === undefined || !file.endsWith(".md")) continue;
    if (folderCell !== "" && folderCell !== undefined) folder = folderCell;
    for (const prefix of prefixes.split(/,\s*/)) {
      if (!/^[A-Z]+$/.test(prefix))
        throw new Error(`${SPEC_README}: "${prefixes}" for ${file} is not a list of prefixes`);
      files.set(prefix, [...(files.get(prefix) ?? []), `docs/spec/${folder}${file}`]);
    }
  }
  if (files.size === 0) throw new Error(`${SPEC_README}'s Files table names no prefix`);
  return files;
}

/** The patterns of one set of prefixes. */
function patterns(prefixes: Iterable<string>) {
  const prefix = `(${[...prefixes].join("|")})`;
  const id = `(?:${prefix})-\\d{2,}`;
  return {
    /** An identifier not inside a longer word; markup such as `_` or `*` around it is no word. */
    citation: new RegExp(`(?<![A-Za-z0-9])(${id})(?![A-Za-z0-9])`, "g"),
    /**
     * A range in the notation of two or three dots or an ellipsis, the second end written in
     * full or as its number. A range in words or with a dash is left to review: prose joins
     * identifiers that way without meaning a range.
     */
    range: new RegExp(
      `(?<![A-Za-z0-9])(${id})[ \\t]*(?:\\.{2,3}|…)[ \\t]*(?:${prefix}-)?\\d{2,}`,
      "g",
    ),
    /** A statement: a paragraph opening with its identifier and a space. */
    paragraph: new RegExp(`^(${id}) `),
    /** A statement: a table row whose first cell is its identifier. */
    cell: new RegExp(`^\\|\\s*(${id})\\s*\\|`),
  };
}
type Patterns = ReturnType<typeof patterns>;

/** A file whose definitions are read: a spec folder's file other than its reasons. */
const SPEC_FILE = /^docs\/spec\/[^/]+\/(?!decisions\.md$)[^/]+\.md$/;
/** The files that cite identifiers: Markdown, and tests with the end-to-end suite's helpers. */
const CITING = /(\.md$|^e2e\/|\.test\.[^/]+$)/;
const HEADING = /^#{1,6}\s/;
/** A code fence; a backtick fence's info string holds no backtick (CommonMark). */
const FENCE = /^\s{0,3}(`{3,}(?=[^`]*$)|~{3,})(.*)$/;

/** The offset of each definition in a spec file's text. */
function definitionsIn(text: string, p: Patterns): { id: string; offset: number }[] {
  const out: { id: string; offset: number }[] = [];
  /** The fence a code block opened with, while one is open. */
  let fence: string | null = null;
  let opens = true;
  let offset = 0;
  for (const content of text.split("\n")) {
    const [, marker, info] = FENCE.exec(content) ?? [];
    const closes =
      fence !== null && marker !== undefined && marker.startsWith(fence) && info?.trim() === "";
    if (fence === null && marker !== undefined) fence = marker;
    else if (closes) fence = null;
    else if (fence === null) {
      const paragraph = opens ? p.paragraph.exec(content)?.[1] : undefined;
      const id = paragraph ?? p.cell.exec(content)?.[1];
      if (id !== undefined) out.push({ id, offset: offset + content.indexOf(id) });
    }
    opens = content.trim() === "" || HEADING.test(content) || marker !== undefined;
    offset += content.length + 1;
  }
  return out;
}

/** The defined identifiers, read from the spec files the README's table names. */
export function specDefinitions(
  root: string,
  files: readonly string[],
  table: SpecFiles,
): Definitions {
  const p = patterns(table.keys());
  const result: Definitions = { defined: new Map(), duplicates: [], misplaced: [] };
  for (const file of files.filter((f) => SPEC_FILE.test(f))) {
    const text = readFileSync(join(root, file), "utf8");
    const starts = lineStarts(text);
    for (const { id, offset } of definitionsIn(text, p)) {
      const line = lineOf(starts, offset);
      const prefix = id.slice(0, id.indexOf("-"));
      if (!(table.get(prefix) ?? []).includes(file)) result.misplaced.push({ id, file, line });
      if (result.defined.has(id)) result.duplicates.push({ id, file, line });
      else result.defined.set(id, { file, line });
    }
  }
  return result;
}

/** Checks every definition, and every identifier in the files given (paths relative to `root`). */
export function checkSpecIds(root: string, files: readonly string[]): SpecIdReport {
  const table = specFiles(readFileSync(join(root, SPEC_README), "utf8"));
  const p = patterns(table.keys());
  const report: SpecIdReport = {
    ...specDefinitions(root, files, table),
    unknown: [],
    ranges: [],
    elsewhere: [],
    citations: 0,
  };
  for (const file of files) {
    const bytes = readFileSync(join(root, file));
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    const starts = lineStarts(text);
    const at = (index: number): Place => ({ file, line: lineOf(starts, index) });
    /** In any other file an identifier is reported as such, and cites nothing. */
    const citing = CITING.test(file);
    const definitions = new Set(
      SPEC_FILE.test(file) ? definitionsIn(text, p).map((d) => d.offset) : [],
    );
    for (const match of text.matchAll(p.range))
      if (citing) report.ranges.push({ id: match[1] ?? "", ...at(match.index) });
    for (const match of text.matchAll(p.citation)) {
      if (definitions.has(match.index)) continue;
      const id = match[1] ?? "";
      if (!citing) {
        report.elsewhere.push({ id, ...at(match.index) });
        continue;
      }
      report.citations += 1;
      if (!report.defined.has(id)) report.unknown.push({ id, ...at(match.index) });
    }
  }
  return report;
}

/** True when the report holds anything to fix. */
export function failed(report: SpecIdReport): boolean {
  return (
    report.duplicates.length +
      report.misplaced.length +
      report.unknown.length +
      report.ranges.length +
      report.elsewhere.length >
    0
  );
}

/** The identifier a new statement with this prefix takes: one past the highest defined. */
export function nextId(defined: ReadonlyMap<string, Place>, prefix: string): string {
  let highest = 0;
  for (const id of defined.keys()) {
    const [p, n] = id.split("-");
    if (p === prefix) highest = Math.max(highest, Number(n));
  }
  return `${prefix}-${String(highest + 1).padStart(2, "0")}`;
}

const place = (c: Cited) => `${c.file}:${c.line}`;

export function formatReport(report: SpecIdReport): string[] {
  const lines = [
    ...report.duplicates.map((c) => {
      const first = report.defined.get(c.id);
      return `${place(c)} ${c.id} is defined again (first at ${first?.file}:${first?.line})`;
    }),
    ...report.misplaced.map(
      (c) => `${place(c)} ${c.id} is defined in a file its prefix does not name (${SPEC_README})`,
    ),
    ...report.unknown.map((c) => `${place(c)} ${c.id} is cited but no statement defines it`),
    ...report.ranges.map((c) => `${place(c)} a range from ${c.id}: write each identifier out`),
    ...report.elsewhere.map((c) => `${place(c)} ${c.id}: only Markdown and tests cite one`),
  ];
  const problems = lines.length;
  lines.push(
    `spec ids: ${report.defined.size} defined, ${report.citations} citations, ${problems === 0 ? "ok" : `${problems} problem(s)`}`,
  );
  return lines;
}
