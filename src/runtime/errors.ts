// R-09: runtime errors are thrown by node runners and caught by the Runner.
import type { NodeId } from "@/lang/types";
import type { RuntimeCode, RuntimeError } from "./types";

export class RuntimeFailure extends Error {
  readonly error: RuntimeError;

  constructor(nodeId: NodeId, code: RuntimeCode, params: Record<string, string | number> = {}) {
    super(`${code} at ${nodeId}`);
    this.name = "RuntimeFailure";
    this.error = { nodeId, code, params };
  }
}
