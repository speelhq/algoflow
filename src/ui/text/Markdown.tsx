// A challenge text as paragraphs with `code`, **bold**, and *italic*.
import { cn } from "@/lib/utils";
import { parseMarkdown, type MarkdownSpan } from "./parseMarkdown";

function MarkdownSpanText({ span }: { span: MarkdownSpan }) {
  switch (span.kind) {
    case "code":
      return <code className="rounded bg-muted px-1 font-mono text-[0.9em]">{span.text}</code>;
    case "bold":
      return <strong>{span.text}</strong>;
    case "italic":
      return <em>{span.text}</em>;
    case "text":
      return span.text;
  }
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {parseMarkdown(text).map((paragraph, i) => (
        // oxlint-disable-next-line react/no-array-index-key -- paragraphs have no identity but their order
        <p key={i}>
          {paragraph.map((span, j) => (
            // oxlint-disable-next-line react/no-array-index-key -- spans have no identity but their order
            <MarkdownSpanText key={j} span={span} />
          ))}
        </p>
      ))}
    </div>
  );
}
