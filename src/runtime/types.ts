// No third-party imports.
import type { Heap, HeapId, Name, NodeId, Value } from "@/lang/types";

export type Runner = {
  next(): Event | Done;
  state(): State; // call only when paused
  stdout(): string[];
  draws(): number[]; // every random result in order
};

export type Done =
  | { type: "done"; events: number; loops: number }
  | { type: "error"; error: RuntimeError; events: number };

export type State = { frames: Frame[]; heap: Heap };
export type Frame = { fn: Name | "main"; callNodeId?: NodeId; vars: Map<Name, Value> };

export const RUNTIME_CODES = [
  "E_UNDEFINED",
  "E_INDEX",
  "E_KEY",
  "E_TYPE",
  "E_VALUE",
  "E_NUMBER_TEXT",
  "E_EMPTY_RANGE",
  "E_DIV_ZERO",
  "E_POP_EMPTY",
  "E_RECURSION",
  "E_EVENT_LIMIT",
] as const;
export type RuntimeCode = (typeof RUNTIME_CODES)[number];

export type RuntimeError = {
  nodeId: NodeId;
  code: RuntimeCode;
  params: Record<string, string | number>;
};

export type Event =
  | { type: "enter"; nodeId: NodeId }
  | { type: "read"; nodeId: NodeId; refs: Ref[] }
  /** `from`: where a `swap` read the value it writes (`interpreter.md`, Events). */
  | { type: "write"; nodeId: NodeId; ref: Ref; value: Value; from?: Ref }
  | { type: "compare"; nodeId: NodeId; result: boolean }
  | { type: "loop"; nodeId: NodeId; var?: Name; value?: Value }
  | { type: "call"; nodeId: NodeId; fn: Name; args: Value[] }
  | { type: "return"; nodeId: NodeId; fn: Name; value: Value }
  | { type: "print"; nodeId: NodeId; text: string };

export type Ref = { var: Name } | { heap: HeapId; index: number } | { heap: HeapId; key: string };
