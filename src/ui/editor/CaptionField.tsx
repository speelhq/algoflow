// The caption field: one line in the learner's own words, stored trimmed, named by the caption
// line's label `id` points to (`editor.md`, Block editor; Captions).
import { useState } from "react";
import { t } from "@/i18n/t";
import { normalizeCaption, setCaption } from "@/lang/edit";
import type { Stmt } from "@/lang/types";
import { applyTyped } from "./edits";
import { oneLine } from "./fields";
import { FieldInput } from "./FieldInput";

export function CaptionField({ id, stmt }: { id: string; stmt: Stmt }) {
  const stored = stmt.caption ?? "";
  const [typed, setTyped] = useState(stored);
  // An undo changes the stored caption under the field.
  if (normalizeCaption(typed) !== stored) setTyped(stored);
  return (
    <FieldInput
      id={id}
      value={typed}
      placeholder={t("editor.caption.hint")}
      data-testid="caption"
      className="min-w-0 flex-1"
      onChange={(event) => {
        const next = oneLine(event.target.value);
        setTyped(next);
        applyTyped((p) => setCaption(p, stmt.id, next), `${stmt.id}:caption`);
      }}
    />
  );
}
