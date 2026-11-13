// The hidden `draft` block definition: the text typed into a slot that is no value of the slot
// yet, and with no text an empty slot (`language.md`, Expressions, Drafts). Never in the block
// menu; validate reports every draft before anything runs.
import { newId } from "@/lang/id";
import type { Expr, Value } from "@/lang/types";
import type { Event } from "@/runtime/types";
import { defineExpr } from "./types";

/** A draft that holds `text`, as a value line makes one for text that writes no value. */
export function createDraft(text: string): Extract<Expr, { type: "draft" }> {
  return { id: newId(), type: "draft", text };
}

/** A new empty slot's value, a draft with no text, as every block's `create()` and the editor make one. */
export function emptyDraft(): Extract<Expr, { type: "draft" }> {
  return createDraft("");
}

export const draft = defineExpr<"draft">({
  key: "draft",
  category: "basic",
  hidden: true,
  slots: [],
  // A draft is text a field holds, one line (`editor.md`, Value line).
  fieldsError: (fields) =>
    typeof fields.text === "string" && !/[\n\r]/.test(fields.text)
      ? undefined
      : { field: "text", message: "expected one line of text" },
  create: emptyDraft,
  run(block): Generator<Event, Value, void> {
    throw new Error(`draft ${block.id} cannot run`);
  },
  // Python's own mark for code still to be written stands for a draft with no text.
  python: (block) => block.text || "...",
  notation: (block) => block.text,
});
