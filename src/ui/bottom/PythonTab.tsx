// U-61 Python: emitted code with line numbers; the active card's line highlighted (E-01);
// hovering a line outlines its card; Copy; `.py` download.
import { CopyIcon, DownloadIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import type { NodeId } from "@/lang/types";
import { emit } from "@/python/emit";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { Button } from "@/ui/primitives/button";

function download(name: string, code: string): void {
  const url = URL.createObjectURL(new Blob([code], { type: "text/x-python" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PythonTab() {
  const program = useProgram((s) => s.program);
  const activeId = useRun((s) => s.activeId);
  const setHovered = useEditor((s) => s.setHovered);
  const [copied, setCopied] = useState(false);

  const { code, map } = useMemo(() => emit(program), [program]);
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);
  const owners = useMemo(() => {
    const byLine = new Map<number, NodeId>();
    for (const [id, range] of Object.entries(map)) {
      for (let line = range.start; line <= range.end; line += 1) byLine.set(line, id);
    }
    return byLine;
  }, [map]);
  const activeLine = activeId === null ? undefined : map[activeId]?.start;

  useEffect(() => {
    if (!copied) return;
    const handle = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(handle);
  }, [copied]);

  // Hovering a line outlines its card (U-61). Delegated on the list so the lines stay plain markup.
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const over = (event: MouseEvent) => {
      const line = (event.target as Element | null)?.closest<HTMLElement>("[data-line]");
      const number = Number(line?.dataset.line);
      setHovered(Number.isFinite(number) ? (owners.get(number) ?? null) : null);
    };
    const out = () => setHovered(null);
    element.addEventListener("mouseover", over);
    element.addEventListener("mouseleave", out);
    return () => {
      element.removeEventListener("mouseover", over);
      element.removeEventListener("mouseleave", out);
    };
  }, [owners, setHovered]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="xs"
          onClick={() => void navigator.clipboard.writeText(code).then(() => setCopied(true))}
        >
          <CopyIcon data-icon="inline-start" />
          {copied ? t("view.copied") : t("view.copy")}
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => download(`${program.title || "program"}.py`, code)}
        >
          <DownloadIcon data-icon="inline-start" />
          {t("view.download")}
        </Button>
      </div>
      <ol ref={list} data-testid="python-code" className="font-mono text-xs">
        {lines.map((text, i) => {
          const line = i + 1;
          return (
            <li
              key={line}
              data-testid="python-line"
              data-line={line}
              data-active={line === activeLine || undefined}
              className={cn("flex", line === activeLine && "bg-accent")}
            >
              <span className="w-8 shrink-0 pr-2 text-right text-muted-foreground select-none">
                {line}
              </span>
              <pre className="whitespace-pre">{text}</pre>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
