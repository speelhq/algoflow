// A challenge text as paragraphs of inline runs: `code`, **bold**, *italic*, and
// plain text. Anything else is plain text, shown as written.

export type Run = { kind: "text" | "code" | "bold" | "italic"; text: string };

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;

function runs(paragraph: string): Run[] {
  const out: Run[] = [];
  let at = 0;
  for (const match of paragraph.matchAll(INLINE)) {
    if (match.index > at) out.push({ kind: "text", text: paragraph.slice(at, match.index) });
    const [, code, bold, italic] = match;
    if (code !== undefined) out.push({ kind: "code", text: code });
    else if (bold !== undefined) out.push({ kind: "bold", text: bold });
    else out.push({ kind: "italic", text: italic ?? "" });
    at = match.index + match[0].length;
  }
  if (at < paragraph.length) out.push({ kind: "text", text: paragraph.slice(at) });
  return out;
}

/** Paragraphs are separated by a blank line; a single line break stays inside its paragraph. */
export function markdown(source: string): Run[][] {
  return source
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "")
    .map(runs);
}
