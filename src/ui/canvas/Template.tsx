// N-02: `node.<key>.template` with `{slot}` placeholders; N-08: the block picks the variant.
import { Fragment, type ReactNode } from "react";
import { t, type MessageKey } from "@/i18n/t";
import type { Node } from "@/lang/types";
import type { FormContext, NodeDef } from "@/nodes/types";

/** The one place a registry key becomes an i18n key (dynamic keys are not scanned by T-08). */
export function nodeText(key: string, part: string): string {
  return t(`node.${key}.${part}` as MessageKey);
}

export function templateOf(def: NodeDef, node: Node, ctx: FormContext): string {
  const form = def.form?.(node, ctx) ?? "";
  return nodeText(def.key, `template${form}`);
}

/** Splits `set {target} to {value}` into text and slot renderings. */
export function renderTemplate(template: string, slot: (name: string) => ReactNode): ReactNode[] {
  return template
    .split(/\{(\w+)\}/)
    .map((part, i) =>
      i % 2 === 1 ? <Fragment key={i}>{slot(part)}</Fragment> : <Fragment key={i}>{part}</Fragment>,
    );
}
