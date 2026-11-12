// Paragraphs, `code`, **bold**, *italic*; anything else as written.
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parseMarkdown";

describe("parseMarkdown", () => {
  it("splits paragraphs on a blank line and keeps a single line break inside one", () => {
    expect(parseMarkdown("one\ntwo\n\n  \nthree")).toEqual([
      [{ kind: "text", text: "one\ntwo" }],
      [{ kind: "text", text: "three" }],
    ]);
    expect(parseMarkdown("\n\n")).toEqual([]);
  });

  it("reads code, bold, and italic runs between plain text", () => {
    expect(parseMarkdown("Print `n`, **Fizz**, or *Buzz*.")).toEqual([
      [
        { kind: "text", text: "Print " },
        { kind: "code", text: "n" },
        { kind: "text", text: ", " },
        { kind: "bold", text: "Fizz" },
        { kind: "text", text: ", or " },
        { kind: "italic", text: "Buzz" },
        { kind: "text", text: "." },
      ],
    ]);
  });

  it("keeps markers inside code, and shows other markdown as written", () => {
    expect(parseMarkdown("`a * b * c`")).toEqual([[{ kind: "code", text: "a * b * c" }]]);
    expect(parseMarkdown("# Title and [link](x) and 2 * 3")).toEqual([
      [{ kind: "text", text: "# Title and [link](x) and 2 * 3" }],
    ]);
  });
});
