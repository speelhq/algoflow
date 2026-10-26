// The caption field: one line in the learner's words, stored trimmed.
import { useState } from "react";
import { t } from "@/i18n/t";
import { normalizeCaption, setCaption } from "@/lang/edit";
import type { Stmt } from "@/lang/types";
import { apply } from "./edits";

export function CaptionField({ stmt }: { stmt: Stmt }) {
  const stored = stmt.caption ?? "";
  const [draft, setDraft] = useState(stored);
  // An undo changes the stored caption under the field.
  if (normalizeCaption(draft) !== stored) setDraft(stored);
  return (
    <label className="flex h-9 flex-1 items-center gap-2 rounded-md border px-2.5 focus-within:border-selection">
      <span className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        {t("editor.caption")}
      </span>
      <input
        value={draft}
        placeholder={t("editor.captionHint")}
        aria-label={t("editor.caption")}
        data-testid="caption"
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        onChange={(event) => {
          const next = event.target.value.replace(/[\r\n]+/g, " ");
          setDraft(next);
          apply((p) => setCaption(p, stmt.id, next), `${stmt.id}:caption`);
        }}
      />
    </label>
  );
}
