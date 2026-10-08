// The list under the sentence: titled groups of rows, each with an optional
// symbol, a label (a variable's in bold and the variable colour), and a note on the right;
// one row is highlighted. One delegated listener reads the row from `data-row`.
import type { SyntheticEvent } from "react";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

export type Item = {
  id: string;
  label: string;
  symbol?: string;
  variable?: boolean;
  /** Before the label: `New variable`. */
  lead?: string;
  note?: string;
  link?: boolean;
};

export type Section = { id: string; title?: string; items: Item[] };

type Props = {
  sections: Section[];
  highlight: string | null;
  onChoose: (id: string) => void;
  onHover: (id: string) => void;
};

/** The row a pointer event is on. */
function rowOf(event: SyntheticEvent<HTMLElement>): string | undefined {
  const target = event.target as HTMLElement | null;
  return target?.closest<HTMLElement>("[data-row]")?.dataset.row;
}

/** Whether a section's rows keep a column for symbols (`× Multiply`). */
const symbols = (items: Item[]) => items.some((item) => item.symbol !== undefined);

export function ListView({ sections, highlight, onChoose, onHover }: Props) {
  return (
    <div
      className="-mx-1 flex max-h-72 flex-col gap-1.5 overflow-y-auto"
      data-testid="value-list"
      role="listbox"
      tabIndex={-1}
      aria-label={t("editor.label")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        const id = rowOf(event);
        if (id) onChoose(id);
      }}
      onMouseOver={(event) => {
        const id = rowOf(event);
        if (id) onHover(id);
      }}
      onKeyDown={(event) => {
        const id = rowOf(event);
        if (id && event.key === "Enter") onChoose(id);
      }}
      onFocus={(event) => {
        const id = rowOf(event);
        if (id) onHover(id);
      }}
    >
      {sections.length === 0 && <p className="px-1 text-muted-foreground">{t("editor.noItems")}</p>}
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col" data-group={section.id}>
          {section.title && (
            <div className="px-1 text-xs tracking-wide text-muted-foreground uppercase">
              {section.title}
            </div>
          )}
          {section.items.map((item) => (
            <div
              key={item.id}
              data-row={item.id}
              role="option"
              aria-selected={highlight === item.id}
              className={cn(
                "flex min-h-7 cursor-pointer items-center gap-2.5 rounded-md px-1",
                highlight === item.id && "bg-selection/10",
                item.link && "text-selection",
              )}
            >
              {symbols(section.items) && (
                <span className="w-4 text-center text-base">{item.symbol ?? ""}</span>
              )}
              {item.lead && <span>{item.lead}</span>}
              <span className={cn(item.variable && "font-bold text-variable")}>{item.label}</span>
              {item.note && (
                <span className="ml-auto text-xs text-muted-foreground">{item.note}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
