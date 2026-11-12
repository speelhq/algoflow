// The caption field: one line in the learner's words, stored trimmed.
import { useState } from "react";
import { t } from "@/i18n/t";
import { normalizeCaption, setCaption } from "@/lang/edit";
import type { Stmt } from "@/lang/types";
import { applyTyped } from "./edits";
import { oneLine } from "./fields";

export function CaptionField({ stmt }: { stmt: Stmt }) {
  const stored = stmt.caption ?? "";
  const [typed, setTyped] = useState(stored);
  // An undo changes the stored caption under the field.
  if (normalizeCaption(typed) !== stored) setTyped(stored);
  return (
    <label className="flex h-9 flex-1 items-center gap-2 rounded-md border px-2.5 focus-within:border-selection">
      <span className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        {t("editor.caption.label")}
      </span>
      <input
        value={typed}
        placeholder={t("editor.caption.hint")}
        aria-label={t("editor.caption.label")}
        data-testid="caption"
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        onChange={(event) => {
          const next = oneLine(event.target.value);
          setTyped(next);
          applyTyped((p) => setCaption(p, stmt.id, next), `${stmt.id}:caption`);
        }}
      />
    </label>
  );
}
