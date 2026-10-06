// A drag of a statement onto a connector: where it lands, which connectors accept it, and
// why a drop is refused (a `break`, `continue`, or `return` taken out of where it may stand).
import { errorText } from "@/i18n/t";
import { findRegion, locateStmt, moveStmt } from "@/lang/edit";
import type { NodeId, Place, Program } from "@/lang/types";
import { validate } from "@/lang/validate";
import { idsUnder } from "@/lang/walk";

const PLACEMENT = new Set(["E_BREAK_OUTSIDE", "E_RETURN_OUTSIDE"]);

/** `place` counted as `moveStmt` counts it: after the moved statement has left its region. */
export function moveTarget(program: Program, id: NodeId, place: Place): Place {
  const from = locateStmt(program, id);
  const same = from !== undefined && from.region === findRegion(program, place);
  return same && from.index < place.index ? { ...place, index: place.index - 1 } : place;
}

/** False for a place inside statement `id` itself: its own regions accept no drop. */
export function accepts(program: Program, id: NodeId, place: Place): boolean {
  if (place.parent === id) return false;
  const located = locateStmt(program, id);
  return !located || ![...idsUnder([located.stmt])].includes(place.parent);
}

/** The program after the move, or the message of the placement rule the move would break. */
export function tryMove(
  program: Program,
  id: NodeId,
  place: Place,
): { program: Program } | { refused: string } {
  const moved = moveStmt(program, id, moveTarget(program, id, place));
  const located = locateStmt(program, id);
  const inside = new Set(located ? idsUnder([located.stmt]) : []);
  const before = new Set(
    validate(program)
      .filter((d) => PLACEMENT.has(d.code))
      .map((d) => d.nodeId),
  );
  const broken = validate(moved).find(
    (d) => PLACEMENT.has(d.code) && inside.has(d.nodeId) && !before.has(d.nodeId),
  );
  return broken ? { refused: errorText(broken) } : { program: moved };
}
