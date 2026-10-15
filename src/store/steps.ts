// A run read one visible step at a time (`interpreter.md`, Steps and batches): an event, or two
// writes that exchange their places, shown as one `swap`. The pre-run, Step, Seek, and Skip all
// read through it, so every count of steps agrees.
import type { HeapEntry, NodeId } from "@/lang/types";
import { isDone } from "@/runtime/outcome";
import { sameRef } from "@/runtime/refs";
import type { Done, Event, Ref, Runner, State } from "@/runtime/types";

/** Two writes of a `swap` that exchange their places. */
export type Exchange = { type: "swap"; nodeId: NodeId; a: Ref; b: Ref };
/** What one visible step shows. */
export type StepEvent = Event | Exchange;

/**
 * One visible step; `state` is the state to show when the reader has read past the step's end
 * (a write that was no exchange), else undefined and the runner's own state is the step's.
 */
export type Step = { event: StepEvent; state: State | undefined };

/** `keep`: the step is to be shown, so a state copied before reading past its end is kept. */
export type Steps = { next(keep: boolean): Step | Done };

/** A published state is a copy; values are immutable records, so one level suffices. */
export function copyState({ frames, heap }: State): State {
  const entry = (each: HeapEntry): HeapEntry =>
    each.kind === "list"
      ? { kind: "list", items: [...each.items] }
      : { kind: "dict", entries: new Map(each.entries) };
  return {
    frames: frames.map((frame) => ({ ...frame, vars: new Map(frame.vars) })),
    heap: new Map([...heap].map(([id, each]) => [id, entry(each)])),
  };
}

function exchanges(
  first: Event,
  second: Event | Done,
): second is Extract<Event, { type: "write" }> {
  return (
    first.type === "write" &&
    second.type === "write" &&
    first.from !== undefined &&
    second.from !== undefined &&
    sameRef(first.from, second.ref) &&
    sameRef(second.from, first.ref)
  );
}

/**
 * Reads `runner` a visible step at a time. Before reading past a write that may begin an
 * exchange it copies the runner's state when the step is to be shown, the state the step shows
 * when the write is alone.
 */
export function stepsOf(runner: Runner): Steps {
  let ahead: Event | Done | undefined;
  return {
    next(keep) {
      const first = ahead ?? runner.next();
      ahead = undefined;
      if (isDone(first)) return first;
      if (first.type !== "write" || first.from === undefined) {
        return { event: first, state: undefined };
      }
      const before = keep ? copyState(runner.state()) : undefined;
      const second = runner.next();
      if (exchanges(first, second)) {
        const event: Exchange = { type: "swap", nodeId: first.nodeId, a: first.ref, b: second.ref };
        return { event, state: undefined };
      }
      ahead = second;
      // The end of the run changes no state the step shows; an event read past it does.
      return { event: first, state: isDone(second) ? undefined : before };
    },
  };
}
