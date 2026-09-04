// U-32: slot chips. Every expression renders through its block's template (N-02, N-08);
// this file reads slot roles and `params` only, never a kind.
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Expr, Node, Target } from "@/lang/types";
import { getNode, keyOf } from "@/nodes";
import type { NodeDef } from "@/nodes/types";
import { renderTemplate, templateOf } from "./Template";

type Bag = Record<string, unknown>;

const isExpr = (value: unknown): value is Expr =>
  typeof value === "object" && value !== null && "kind" in value && "id" in value;

function joinChips(items: unknown[]): ReactNode {
  return items.map((item, i) => (
    <Fragment key={isExpr(item) ? item.id : i}>
      {i > 0 && ", "}
      {isExpr(item) ? <Chip expr={item} /> : null}
    </Fragment>
  ));
}

function TargetText({ target }: { target: Target }) {
  switch (target.kind) {
    case "var":
      return <span className="font-medium">{target.name}</span>;
    case "index":
      return (
        <>
          <Chip expr={target.list} />[<Chip expr={target.index} />]
        </>
      );
    case "key":
      return (
        <>
          <Chip expr={target.dict} />[<Chip expr={target.key} />]
        </>
      );
    case "field":
      return (
        <>
          <Chip expr={target.obj} />.{target.field}
        </>
      );
  }
}

/** Renders one `{name}` placeholder of `node`'s template. */
export function SlotContent({ node, def, name }: { node: Node; def: NodeDef; name: string }) {
  const bag = node as unknown as Bag;
  const slot = def.slots.find((s) => s.name === name);
  if (slot) {
    const value = bag[slot.name];
    switch (slot.role) {
      case "expr":
        return isExpr(value) ? <Chip expr={value} /> : null;
      case "exprs":
        return Array.isArray(value) ? joinChips(value) : null;
      case "id":
        return <span className="font-medium">{typeof value === "string" ? value : ""}</span>;
      case "text":
        return <>{def.text?.(node, slot.name) ?? (typeof value === "string" ? value : "")}</>;
      case "target":
        return value && typeof value === "object" ? <TargetText target={value as Target} /> : null;
      default:
        return null;
    }
  }
  // Builtin templates name their parameters (`{a}`, `{b}`): the i-th argument.
  const index = def.params?.indexOf(name) ?? -1;
  const args = bag.args;
  const arg = index >= 0 && Array.isArray(args) ? args[index] : undefined;
  return isExpr(arg) ? <Chip expr={arg} /> : null;
}

export function Chip({ expr }: { expr: Expr }) {
  const def = getNode(keyOf(expr));
  const template = templateOf(def, expr, { creates: false });
  return (
    <span
      data-testid="chip"
      data-kind={def.key}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs whitespace-nowrap",
        def.key === "empty" && "border-dashed text-muted-foreground italic",
      )}
    >
      {renderTemplate(template, (name) => (
        <SlotContent node={expr} def={def} name={name} />
      ))}
    </span>
  );
}
