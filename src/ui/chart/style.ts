// A span's style, its weight and its color (`blocks.md`, Notation, Drawing): the one place for
// it, which the chart's nodes, the drag ghost, and the editor's spans read, so a variable and a
// hint are drawn alike wherever they are drawn.
import type { NotationSpan } from "./text";

/**
 * A span's weight, undefined for the weight around it, and its color as a `text-*` utility class,
 * empty for the color around it. An SVG text takes the color by `fill-current`.
 */
export type SpanStyle = { fontWeight: 400 | 600 | undefined; colorClass: string };

/**
 * A variable is a bold word in the variable color, and a hint is gray and never bold, so it never
 * reads as a variable; any other span takes the weight and the color around it.
 */
export function spanStyle(span: Pick<NotationSpan, "variable" | "hint">): SpanStyle {
  if (span.variable) return { fontWeight: 600, colorClass: "text-variable" };
  if (span.hint) return { fontWeight: 400, colorClass: "text-muted-foreground" };
  return { fontWeight: undefined, colorClass: "" };
}
