// The diagnostics a chart node shows, and a diagnostic's message with the button applying its fix.
import { errorText, t } from "@/i18n/t";
import { hoistAssign } from "@/lang/edit";
import type { Diagnostic, NodeId, Program } from "@/lang/types";
import { validate } from "@/lang/validate";
import { blocksById, draftText, ownerOf } from "@/lang/walk";
import { Button } from "@/ui/primitives/button";
import { apply } from "./edits";

/** Whether a diagnostic is of a draft, which the learner hasn't finished. */
function ofDraft(program: Program, d: Diagnostic): boolean {
  return draftText(blocksById(program).get(d.nodeId)) !== undefined;
}

/**
 * The diagnostics chart nodes show, by owner, a statement or a function (`chart.md`, Shapes): none
 * of what the learner hasn't finished, a draft or the statement `typing` whose editor has a field
 * with the keyboard, which only Run or Submit reports (`chart.md`, Editing on the chart,
 * Diagnostics).
 */
export function flaggedOwners(program: Program, typing: NodeId | null): Map<NodeId, Diagnostic[]> {
  const flagged = new Map<NodeId, Diagnostic[]>();
  for (const d of validate(program)) {
    const owner = ownerOf(program, d.nodeId);
    if (owner === typing || ofDraft(program, d)) continue;
    flagged.set(owner, [...(flagged.get(owner) ?? []), d]);
  }
  return flagged;
}

/** The same diagnostic in another validation of the program: same node, code, and params. */
function sameDiagnostic(a: Diagnostic, b: Diagnostic): boolean {
  return (
    a.nodeId === b.nodeId &&
    a.code === b.code &&
    JSON.stringify(a.params) === JSON.stringify(b.params)
  );
}

/**
 * The diagnostics statement `id`'s editor shows at its top: those its chart node shows, and first
 * the one Run led to while the program still has it (`editor.md`, Block editor), which Run
 * reported even while a field has the keyboard.
 */
export function editorDiagnostics(
  program: Program,
  id: NodeId,
  led: Diagnostic | null,
  typing: NodeId | null,
): Diagnostic[] {
  const shown = flaggedOwners(program, typing).get(id) ?? [];
  const still = ledStill(program, led);
  const first = still && ownerOf(program, still.nodeId) === id;
  return first && !shown.includes(still) ? [still, ...shown] : shown;
}

/** The diagnostic Run or Submit led to, while the program still has it. */
export function ledStill(program: Program, led: Diagnostic | null): Diagnostic | undefined {
  return led ? validate(program).find((d) => sameDiagnostic(d, led)) : undefined;
}

/** Applies a diagnostic's fix; only the fixes validation names exist. */
function applyFix(diagnostic: Diagnostic): void {
  if (diagnostic.fix !== "hoistAssign") return;
  const { compound, name } = diagnostic.params;
  if (typeof compound === "string" && typeof name === "string") {
    apply((program) => hoistAssign(program, compound, name));
  }
}

/** A diagnostic's message, with the button applying its fix when it has one. */
export function DiagnosticMessage({ diagnostic }: { diagnostic: Diagnostic }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-2"
      role="alert"
    >
      <span className="flex-1 text-destructive">{errorText(diagnostic)}</span>
      {diagnostic.fix && (
        <Button size="sm" variant="outline" onClick={() => applyFix(diagnostic)}>
          {t(`chart.fix.${diagnostic.fix}`, diagnostic.params)}
        </Button>
      )}
    </div>
  );
}
