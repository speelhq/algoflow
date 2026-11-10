// The editable slots of the editor's notation other than a value line: `+ value`, and a list of
// values with a remove button on each item.
import type { ReactNode } from "react";
import { t } from "@/i18n/t";
import { SEPARATOR } from "@/ui/chart/text";
import type { Expr } from "@/lang/types";
import { cn } from "@/lib/utils";

/** `+ value`: adds an optional value, or an item at the end of a list. */
export function AddValue({ onAdd, small }: { onAdd: () => void; small: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "h-7 cursor-pointer rounded-full border border-dashed px-2.5 font-sans text-muted-foreground hover:bg-muted",
        small && "text-sm",
      )}
      onClick={onAdd}
    >
      {t("editor.addValue")}
    </button>
  );
}

/** A list of values: each item's line with a remove button, separated, then `+ value`. */
export function ValueItems(props: {
  items: readonly Expr[];
  line: (item: Expr, index: number) => ReactNode;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {props.items.map((item, index) => (
        // An item keeps its field while the value in it changes.
        // oxlint-disable-next-line react/no-array-index-key -- the field is the position
        <span key={index} className="inline-flex items-center gap-0.5">
          {index > 0 && <span>{SEPARATOR}</span>}
          {props.line(item, index)}
          <button
            type="button"
            aria-label={t("editor.removeValue.label")}
            // Pressing it leaves the keyboard where it is, and the line as it is drawn.
            onMouseDown={(event) => event.preventDefault()}
            className="size-5 cursor-pointer rounded-full text-muted-foreground hover:bg-muted"
            onClick={() => props.onRemove(index)}
          >
            {t("editor.removeValue.icon")}
          </button>
        </span>
      ))}
      <AddValue onAdd={props.onAdd} small />
    </span>
  );
}
