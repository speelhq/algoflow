// U-26: a challenge text as paragraphs with `code`, **bold**, and *italic*.
import { cn } from "@/lib/utils";
import { markdown, type Run } from "./markdown";

function RunText({ run }: { run: Run }) {
  switch (run.kind) {
    case "code":
      return <code className="rounded bg-muted px-1 font-mono text-[0.9em]">{run.text}</code>;
    case "bold":
      return <strong>{run.text}</strong>;
    case "italic":
      return <em>{run.text}</em>;
    case "text":
      return run.text;
  }
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {markdown(text).map((paragraph, i) => (
        // oxlint-disable-next-line react/no-array-index-key -- paragraphs have no identity but their order
        <p key={i}>
          {paragraph.map((run, j) => (
            // oxlint-disable-next-line react/no-array-index-key -- runs have no identity but their order
            <RunText key={j} run={run} />
          ))}
        </p>
      ))}
    </div>
  );
}
