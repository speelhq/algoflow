// What a visible step shows (`interpreter.md`, Steps and batches): an event, or two writes that
// exchange their places, shown as one `swap`.
import type { NodeId } from "@/lang/types";
import type { Event, Ref } from "@/runtime/types";

/** Two writes of a `swap` that exchange their places. */
export type Exchange = { type: "swap"; nodeId: NodeId; a: Ref; b: Ref };
/** What one visible step shows. */
export type StepEvent = Event | Exchange;
