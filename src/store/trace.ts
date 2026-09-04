// U-61 Trace rows, projected eagerly from events: a cell holds the `str()` text of a
// variable at the moment it changed, because the heap keeps moving after the event.
import type { Id, Value } from "@/lang/types";
import type { Event, Ref, State } from "@/runtime/types";
import { str } from "@/runtime/values";

export type TraceRow = {
  step: number;
  event: Event;
  /** Variables of the current frame whose value this event changed, with their new text. */
  cells: Record<Id, string>;
  /** `compare` rows only: `5 > 3 → True`. */
  condition?: string;
};

const isRef = (value: Value): value is Extract<Value, { ref: number }> => "ref" in value;

/** The current-frame variables that a ref belongs to: the variable itself, or every name holding the heap entry. */
function cellsFor(ref: Ref, state: State, written?: Value): Record<Id, string> {
  const frame = state.frames[state.frames.length - 1];
  if (!frame) return {};
  const cells: Record<Id, string> = {};
  if ("var" in ref) {
    const value = written ?? frame.vars.get(ref.var);
    if (value) cells[ref.var] = str(value, state.heap);
    return cells;
  }
  for (const [name, value] of frame.vars) {
    if (isRef(value) && value.ref === ref.heap) cells[name] = str(value, state.heap);
  }
  return cells;
}

/** One row for `write`, `swap`, `compare`, `loop`; undefined for every other event. */
export function traceRow(event: Event, state: State, step: number): TraceRow | undefined {
  switch (event.type) {
    case "write":
      return { step, event, cells: cellsFor(event.ref, state, event.value) };
    case "swap":
      return { step, event, cells: { ...cellsFor(event.a, state), ...cellsFor(event.b, state) } };
    case "compare":
      return {
        step,
        event,
        cells: {},
        condition: `${event.text} → ${event.result ? "True" : "False"}`,
      };
    case "loop": {
      const cells: Record<Id, string> = {};
      if (event.var !== undefined && event.value) cells[event.var] = str(event.value, state.heap);
      return { step, event, cells };
    }
    default:
      return undefined;
  }
}

/** Columns in first-assignment order: the same array when nothing is new, else a copy with the row's new names. */
export function withColumns(columns: Id[], row: TraceRow): Id[] {
  const added = Object.keys(row.cells).filter((name) => !columns.includes(name));
  return added.length === 0 ? columns : [...columns, ...added];
}
