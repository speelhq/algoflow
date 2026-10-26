// Every reference to a heading of the spec names a heading that exists (`docs/spec/README.md`,
// References). Two forms are read: a spec file's name followed by a comma and a heading, in a
// Markdown or TypeScript file, and a parenthesis in a spec file's prose that opens with a capital
// letter.
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { lineOf, lineStarts } from "./lines";

/** A reference to a heading that the cited spec file doesn't hold. */
export type Broken = { file: string; line: number; cited: string; heading: string };

/**
 * One heading of a spec file: its text, the names a reference may give it, and the texts of the
 * headings it sits under. A heading that ends in handles, `Lists (\`swap\`, \`method:copy\`)`, is
 * also named without them, as `Lists`.
 */
type Heading = { text: string; names: readonly string[]; path: readonly string[] };

/** A text read with each line break as one space, and the offset in the file of each character. */
type Flat = { text: string; at: number[] };

const SPEC = /^docs\/spec\/.*\.md$/;
const CITING = /\.(md|ts|tsx)$/;
/**
 * A file's name and the comma after it, as a reference writes it: `` `chart.md`, ``,
 * `` `docs/spec/ui/chart.md`, ``, or, in a test's title, `chart.md, `.
 */
const FILE = /(?<![\w/.-])`?((?:docs\/spec\/(?:[a-z]+\/)?)?[\w-]+\.md)`?, /g;
/**
 * What may follow a heading's name: a comma, a semicolon, a colon, a period, `)`, a quote, the
 * end of a table cell, or the end of the line.
 */
const AFTER = /^(?:[,;:.)"'`]| *\||\n|$)/;
/** The handles in parentheses that end a heading: ` (\`swap\`, \`method:copy\`)`. */
const HANDLES = / \((?:`[^`]*`(?:, )?)+\)$/;

/** Whether each line of a Markdown text is fenced code, its fences included. */
function fenced(lines: readonly string[]): boolean[] {
  let inside = false;
  return lines.map((line) => {
    const fence = /^[ \t]*```/.test(line);
    const code = inside || fence;
    if (fence) inside = !inside;
    return code;
  });
}

/** The text with each line of fenced code blanked, so it keeps its offsets and line breaks. */
function withoutFences(text: string): string {
  const lines = text.split("\n");
  const code = fenced(lines);
  return lines.map((line, i) => (code[i] ? " ".repeat(line.length) : line)).join("\n");
}

/** The headings below the title of one Markdown text, outside fenced code. */
export function headings(text: string): Heading[] {
  const found: Heading[] = [];
  const stack: Array<{ level: number; text: string }> = [];
  for (const line of withoutFences(text).split("\n")) {
    const match = /^(#{2,6}) (.+)$/.exec(line);
    if (!match?.[1] || !match[2]) continue;
    const level = match[1].length;
    while ((stack.at(-1)?.level ?? 0) >= level) stack.pop();
    const short = match[2].replace(HANDLES, "");
    found.push({
      text: match[2],
      names: short === match[2] ? [short] : [match[2], short],
      path: stack.map((h) => h.text),
    });
    stack.push({ level, text: match[2] });
  }
  return found;
}

/** A line that starts an item of its own in Markdown: a list item, a table row, a heading, a fence. */
const OWN_LINE = /^(?:[-*+] |\d+\. |\||#|```)/;
/** A comment's next line in code: `// …` or ` * …`, not the line that ends the comment. */
const COMMENT_LINE = /^(?:\/\/|\*(?!\/))/;
/** What starts a line that goes on with the line before it: an indent, and `//`, `*`, or `>`. */
const CONTINUATION = /^[ \t]*(?:\/\/ ?|\* ?|> ?)?[ \t]*/;

/**
 * The text with a line break read as one space where the next line goes on with the same text, so
 * a heading wrapped across lines matches: in Markdown prose, any line but one that starts an item
 * of its own; in code (a TypeScript file, or a fenced block), a comment's next line. The spaces
 * around the break and the `//`, `*`, or `>` that continues the line go with it.
 */
function flatten(text: string, code: boolean): Flat {
  const flat: Flat = { text: "", at: [] };
  const lines = text.split("\n");
  const inCode = code ? lines.map(() => true) : fenced(lines);
  let offset = 0;
  // Where this line's text starts: past the continuation the break before it read as a space.
  let from = 0;
  for (const [i, line] of lines.entries()) {
    const next = lines[i + 1]?.trim() ?? "";
    const goesOn = next !== "" && (inCode[i] ? COMMENT_LINE.test(next) : !OWN_LINE.test(next));
    const end = goesOn ? line.trimEnd().length : line.length;
    for (let k = from; k < end; k += 1) {
      flat.text += line[k];
      flat.at.push(offset + k);
    }
    if (i < lines.length - 1) {
      flat.text += goesOn ? " " : "\n";
      flat.at.push(offset + end);
    }
    from = goesOn ? (CONTINUATION.exec(lines[i + 1] ?? "")?.[0].length ?? 0) : 0;
    offset += line.length + 1;
  }
  return flat;
}

/**
 * The headings of `among` with the longest name that `text` starts with, followed by what may
 * follow a heading, and that name's length. Two headings may share a name under different parents.
 */
function longest(
  text: string,
  among: readonly Heading[],
): { headings: Heading[]; length: number } | undefined {
  let best: { headings: Heading[]; length: number } | undefined;
  for (const heading of among)
    for (const name of heading.names) {
      if (!text.startsWith(name) || !AFTER.test(text.slice(name.length))) continue;
      if (!best || name.length > best.length) best = { headings: [heading], length: name.length };
      else if (name.length === best.length) best.headings.push(heading);
    }
  return best;
}

/** Whether `heading` sits under `parent`, at any depth. */
function under(heading: Heading, parent: Heading): boolean {
  const path = [...parent.path, parent.text];
  return heading.path.length >= path.length && path.every((text, i) => heading.path[i] === text);
}

/**
 * The offsets in `text` of the headings that one reference names and `among` doesn't hold. The
 * reference starts at `start`, where a heading is expected, and goes on through each
 * `, heading` under it and each `; heading` after it. A capital letter starts a heading; a code
 * span or a lower-case word ends the reference.
 */
function unknownHeadings(text: string, start: number, among: readonly Heading[]): number[] {
  const startsHeading = (pos: number) => /^[A-Z]/.test(text.slice(pos));
  let pos = start;
  for (;;) {
    let found = longest(text.slice(pos), among);
    if (!found) return startsHeading(pos) ? [pos] : [];
    pos += found.length;
    while (text.startsWith(", ", pos) && startsHeading(pos + 2)) {
      const parents = found.headings;
      found = longest(
        text.slice(pos + 2),
        among.filter((h) => parents.some((parent) => under(h, parent))),
      );
      if (!found) return [pos + 2];
      pos += 2 + found.length;
    }
    // A `; file, heading` after it is a reference of its own, which `checkReferences` reads.
    if (!text.startsWith("; ", pos) || !startsHeading(pos + 2)) return [];
    pos += 2;
  }
}

/** Checks the references in `files` (paths relative to `root`, as `repoFiles` lists them). */
export function checkReferences(opts: { root: string; files: readonly string[] }): Broken[] {
  const read = (file: string) => readFileSync(join(opts.root, file), "utf8");
  const specFiles = opts.files.filter((file) => SPEC.test(file));
  const headingsOf = new Map(specFiles.map((file) => [file, headings(read(file))]));
  const byName = new Map(specFiles.map((file) => [basename(file), file]));

  const broken: Broken[] = [];
  for (const file of opts.files.filter((f) => CITING.test(f))) {
    const original = read(file);
    const starts = lineStarts(original);
    /** Records the heading that starts at `pos` of `flat`, up to what may follow a heading. */
    const report = (flat: Flat, pos: number, cited: string) => {
      let end = pos;
      while (end < flat.text.length && !AFTER.test(flat.text.slice(end, end + 2))) end += 1;
      const heading = flat.text.slice(pos, end).trim();
      broken.push({ file, line: lineOf(starts, flat.at[pos] ?? 0), cited, heading });
    };

    const flat = flatten(original, !file.endsWith(".md"));
    for (const match of flat.text.matchAll(FILE)) {
      const cited = match[1] ?? "";
      // A name that no spec file has names a file outside the spec, such as `CLAUDE.md`.
      const among = headingsOf.get(byName.get(cited) ?? cited);
      if (among)
        for (const pos of unknownHeadings(flat.text, match.index + match[0].length, among))
          report(flat, pos, cited);
    }
    const own = headingsOf.get(file);
    if (own) {
      // Prose only: a parenthesis in fenced code or in a code span, `print(None)`, isn't read.
      const prose = flatten(withoutFences(original), false);
      const spans = [...prose.text.matchAll(/`[^`\n]*`/g)].map((m) => [
        m.index,
        m.index + m[0].length,
      ]);
      for (const match of prose.text.matchAll(/\((?=[A-Z])/g)) {
        if (spans.some(([from = 0, to = 0]) => match.index > from && match.index < to)) continue;
        for (const pos of unknownHeadings(prose.text, match.index + 1, own))
          report(prose, pos, basename(file));
      }
    }
  }
  return broken;
}

export function formatReferences(broken: readonly Broken[]): string[] {
  const lines = broken.map((b) => `${b.file}:${b.line} no heading "${b.heading}" in ${b.cited}`);
  lines.push(`references: ${broken.length === 0 ? "ok" : `${broken.length} problem(s)`}`);
  return lines;
}
