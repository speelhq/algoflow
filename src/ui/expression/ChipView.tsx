// An expression as nested chips: each block's template, its expression slots as chips of
// their own and its other slots as text. A leaf is one button; a chip with slots is a group
// whose own words select it. A chip's context menu offers `Delete` and, for an operator,
// `Unwrap`. Reads slot roles and `params`, never a kind.
import type { ReactNode } from "react";
import { t } from "@/i18n/t";
import type { Expr, NodeId } from "@/lang/types";
import { isExpr } from "@/lang/walk";
import { cn } from "@/lib/utils";
import { getNode, keyOf } from "@/nodes";
import { exprText, nodeText, placeholder, slotText } from "@/ui/chart/text";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/ui/primitives/context-menu";
import { isOperator } from "./chips";

type Bag = Record<string, unknown>;

export type ChipActions = {
  /** The chip whose menu is open. */
  open: NodeId | null;
  choose: (expr: Expr) => void;
  remove: (expr: Expr) => void;
  unwrap: (expr: Expr) => void;
};

/** The block's template split into its words and the children in its placeholders. */
function pieces(expr: Expr): Array<{ text: string } | { child: Expr } | { list: Expr[] }> {
  const def = getNode(keyOf(expr));
  const bag = expr as unknown as Bag;
  const form = def.form?.(expr, { creates: false }) ?? "";
  const template = nodeText(def.key, `template${form}`);
  const out: Array<{ text: string } | { child: Expr } | { list: Expr[] }> = [];
  let at = 0;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    const name = found[1] ?? "";
    out.push({ text: template.slice(at, found.index) });
    const slot = def.slots.find((s) => s.name === name);
    const value = bag[name];
    const param = def.params?.indexOf(name) ?? -1;
    const arg = param >= 0 && Array.isArray(bag.args) ? (bag.args[param] as unknown) : undefined;
    if (slot?.role === "expr" && isExpr(value)) out.push({ child: value });
    else if (slot?.role === "exprs" && Array.isArray(value))
      out.push({ list: value.filter(isExpr) });
    else if (isExpr(arg)) out.push({ child: arg });
    else out.push({ text: slotText(expr, def, name) });
    at = found.index + found[0].length;
  }
  out.push({ text: template.slice(at) });
  return out.filter((piece) => !("text" in piece) || piece.text.trim() !== "");
}

function hasChildren(expr: Expr): boolean {
  return getNode(keyOf(expr)).slots.some((slot) => slot.role === "expr" || slot.role === "exprs");
}

function Menu({
  expr,
  actions,
  children,
}: {
  expr: Expr;
  actions: ChipActions;
  children: ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={<span className="inline-flex" />}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => actions.remove(expr)}>
          {t("editor.chip.delete")}
        </ContextMenuItem>
        {isOperator(expr) && (
          <ContextMenuItem onClick={() => actions.unwrap(expr)}>
            {t("editor.chip.unwrap")}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

const chip =
  "inline-flex h-7 cursor-pointer items-center rounded-full border px-2.5 font-mono text-[0.8rem] whitespace-nowrap";

export function ChipView({ expr, actions }: { expr: Expr; actions: ChipActions }) {
  const open = actions.open === expr.id;
  if (expr.kind === "empty" || !hasChildren(expr)) {
    const empty = expr.kind === "empty";
    return (
      <Menu expr={expr} actions={actions}>
        <button
          type="button"
          data-chip={expr.id}
          data-open={open || undefined}
          aria-pressed={open}
          className={cn(
            chip,
            empty && "border-dashed font-sans text-muted-foreground",
            open && "border-selection text-selection ring-1 ring-selection",
          )}
          onClick={() => actions.choose(expr)}
        >
          {empty ? placeholder() : exprText(expr)}
        </button>
      </Menu>
    );
  }
  return (
    <Menu expr={expr} actions={actions}>
      <span
        className={cn(
          "inline-flex flex-wrap items-center gap-1 rounded-full border border-muted-foreground/40 px-1 py-0.5",
          open && "border-selection ring-1 ring-selection",
        )}
      >
        {pieces(expr).map((piece, i) => {
          // oxlint-disable-next-line react/no-array-index-key -- pieces are positional
          const key = i;
          if ("child" in piece) return <ChipView key={key} expr={piece.child} actions={actions} />;
          if ("list" in piece) {
            return (
              <span key={key} className="inline-flex items-center gap-1">
                {piece.list.map((item, j) => (
                  <span key={item.id} className="inline-flex items-center gap-1">
                    {j > 0 && <span>,</span>}
                    <ChipView expr={item} actions={actions} />
                  </span>
                ))}
              </span>
            );
          }
          return (
            <button
              key={key}
              type="button"
              data-chip={expr.id}
              aria-pressed={open}
              className="cursor-pointer rounded px-0.5 font-mono text-[0.8rem] hover:bg-muted"
              onClick={() => actions.choose(expr)}
            >
              {piece.text.trim()}
            </button>
          );
        })}
      </span>
    </Menu>
  );
}
