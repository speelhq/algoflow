// The diagnostics a chart node shows, and a diagnostic's message with the button applying its fix.
import { errorText, t } from "@/i18n/t";
import { hoistAssign } from "@/lang/edit";
import type { Diagnostic, NodeId, Program } from "@/lang/types";
import { validate } from "@/lang/validate";
import { blocksById, draftText, ownerOf } from "@/lang/walk";
import { Button } from "@/ui/primitives/button";
import { apply } from "./edits";

/**
 * The diagnostics chart nodes show, by owner, a statement or a function (`chart.md`, Shapes): none
 * of a draft, which is reported only once Run or Submit leads to it (`run.md`, Run bar, Starting a
 * run), because a block drawn red while it is built would report an error before the learner had
 * finished its value.
 */
export function flaggedOwners(program: Program): Map<NodeId, Diagnostic[]> {
  const flagged = new Map<NodeId, Diagnostic[]>();
  const blocks = blocksById(program);
  for (const d of validate(program)) {
    if (draftText(blocks.get(d.nodeId)) !== undefined) continue;
    const owner = ownerOf(program, d.nodeId);
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
 * The diagnostics statement `id`'s editor shows: those its chart node shows, and first the one Run led
 * to, while the program still has it.
 */
export function editorDiagnostics(
  program: Program,
  id: NodeId,
  led: Diagnostic | null,
): Diagnostic[] {
  const shown = flaggedOwners(program).get(id) ?? [];
  const still = led ? validate(program).find((d) => sameDiagnostic(d, led)) : undefined;
  const owner = still ? ownerOf(program, still.nodeId) : undefined;
  return still && owner === id && !shown.includes(still) ? [still, ...shown] : shown;
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
