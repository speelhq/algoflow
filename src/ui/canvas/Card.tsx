// U-32: icon, template with chips, drag handle; frames show a header, a left rail, and
// one region per body slot. U-36/U-38: the active card is outlined and scrolled into view,
// a frame header shows ✓/✗ after its compare, and the failing card shows the error.
import { CheckIcon, GripVerticalIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { t, type MessageKey } from "@/i18n/t";
import { cn } from "@/lib/utils";
import type { NodeId, Stmt } from "@/lang/types";
import { regionsOf } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes";
import { useEditor } from "@/store/editor";
import { useRun } from "@/store/run";
import { SlotContent } from "./Chip";
import { CATEGORY_ICONS } from "./icons";
import { Region } from "./Region";
import { renderTemplate, templateOf } from "./Template";

const REGION_LABELS: Partial<Record<string, MessageKey>> = {
  then: "canvas.region.then",
  else: "canvas.region.else",
};

export function Card({ stmt, creates }: { stmt: Stmt; creates: Set<NodeId> }) {
  const def = getNode(keyOf(stmt));
  const Icon = CATEGORY_ICONS[def.category];
  const template = templateOf(def, stmt, { creates: creates.has(stmt.id) });
  const regions = regionsOf(stmt);

  const active = useRun((s) => s.activeId === stmt.id);
  const verdict = useRun((s) => s.verdicts[stmt.id]);
  const error = useRun((s) =>
    s.status === "error" && s.activeId === stmt.id && s.done?.type === "error"
      ? s.done.error
      : null,
  );
  const hovered = useEditor((s) => s.hoveredId === stmt.id);

  const header = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) header.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <li data-testid="card" data-node-id={stmt.id} data-active={active || undefined}>
      <div
        ref={header}
        className={cn(
          "flex w-fit max-w-full items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm shadow-xs",
          active && "ring-2 ring-primary",
          hovered && "outline-2 outline-offset-2 outline-ring",
        )}
      >
        <GripVerticalIcon
          aria-label={t("canvas.dragHandle")}
          className="size-4 shrink-0 cursor-grab text-muted-foreground"
        />
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex flex-wrap items-center gap-1">
          {renderTemplate(template, (name) => (
            <SlotContent node={stmt} def={def} name={name} />
          ))}
        </span>
        {verdict !== undefined && (
          <span
            data-testid="verdict"
            aria-label={t(verdict ? "canvas.verdictTrue" : "canvas.verdictFalse")}
            className={cn("ml-1", verdict ? "text-green-600" : "text-destructive")}
          >
            {verdict ? <CheckIcon className="size-4" /> : <XIcon className="size-4" />}
          </span>
        )}
      </div>
      {error && (
        <p data-testid="card-error" className="mt-1 text-xs text-destructive">
          {t(`error.${error.code}`, error.params)}
        </p>
      )}
      {regions.map((region, i) => {
        // U-32: an empty secondary region (`else`) is hidden until shown from the header's menu (M-03).
        if (i > 0 && region.stmts.length === 0) return null;
        const label = REGION_LABELS[region.slot];
        return (
          <div key={region.slot} className="ml-3 border-l-2 border-border pl-3">
            {label && <div className="text-xs text-muted-foreground">{t(label)}</div>}
            <Region stmts={region.stmts} creates={creates} />
          </div>
        );
      })}
    </li>
  );
}
