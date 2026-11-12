// Spans of a block's text in the editor, each drawn in its style (`blocks.md`, Notation, Drawing).
import { cn } from "@/lib/utils";
import { spanStyle } from "@/ui/chart/style";
import type { NotationSpan } from "@/ui/chart/text";

export function Spans({ spans }: { spans: readonly NotationSpan[] }) {
  return spans.map((span, i) => {
    const style = spanStyle(span);
    return (
      <span
        // oxlint-disable-next-line react/no-array-index-key -- spans are positional
        key={i}
        className={cn(style.colorClass, span.underline && "underline underline-offset-2")}
        style={{ fontWeight: style.fontWeight }}
      >
        {span.text}
      </span>
    );
  });
}
