// 04-runtime.md R-01, R-02, R-09. No third-party imports (P-01).
import type { Heap, HeapId, Id, NodeId, Value } from "@/lang/types";

export type Runner = {
  next(): Event | Done;
  state(): State; // call only when paused
  stdout(): string[];
  draws(): number[]; // every random result in order
};

export type Done =
  | { type: "done"; steps: number; loops: number }
  | { type: "error"; error: RuntimeError; steps: number };

export type State = { frames: Frame[]; heap: Heap };
export type Frame = { fn: Id | "main"; callNodeId?: NodeId; vars: Map<Id, Value> };

export type RuntimeCode =
  | "E_INDEX"
  | "E_KEY"
  | "E_FIELD"
  | "E_TYPE"
  | "E_DIV_ZERO"
  | "E_POP_EMPTY"
  | "E_ARITY"
  | "E_RECURSION"
  | "E_STEP_LIMIT";

export type RuntimeError = {
  nodeId: NodeId;
  code: RuntimeCode;
  params: Record<string, string | number>;
};

export type Event =
  | { type: "enter"; nodeId: NodeId }
  | { type: "read"; nodeId: NodeId; refs: Ref[] }
  | { type: "write"; nodeId: NodeId; ref: Ref; value: Value }
  | { type: "swap"; nodeId: NodeId; a: Ref; b: Ref }
  | { type: "compare"; nodeId: NodeId; text: string; result: boolean }
  | { type: "loop"; nodeId: NodeId; var?: Id; value?: Value }
  | { type: "call"; nodeId: NodeId; fn: Id; args: Value[] }
  | { type: "return"; nodeId: NodeId; fn: Id; value: Value }
  | { type: "print"; nodeId: NodeId; text: string };

export type Ref =
  | { var: Id }
  | { heap: HeapId; index: number }
  | { heap: HeapId; key: string }
  | { heap: HeapId; field: Id };
