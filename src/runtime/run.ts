// R-01..R-10: the interpreter. Blocks own their semantics (N-01); this file
// owns frames, dispatch, counting, limits, and the Runner contract.
import { toValue } from "@/lang/data";
import type { Data, Expr, Heap, Id, NodeId, Program, Stmt, Value } from "@/lang/types";
import { getNode, keyOf } from "@/nodes";
import type { ExprRunner, RunContext, Signal, StmtRunner } from "@/nodes/types";
import { RuntimeFailure } from "./errors";
import { createRandom } from "./random";
import type { Done, Event, Frame, Runner, RuntimeCode } from "./types";

export const STEP_LIMIT = 1_000_000; // L-31
export const CALL_DEPTH_LIMIT = 200; // L-28

export function run(program: Program, inputs: Record<Id, Data>, seed: number): Runner {
  const heap: Heap = new Map();
  const frames: Frame[] = [{ fn: "main", vars: new Map() }];
  const random = createRandom(seed);
  const stdout: string[] = [];
  const functions = new Map(program.functions.map((fn) => [fn.name, fn]));

  const top = (): Frame => {
    const frame = frames[frames.length - 1];
    if (!frame) throw new Error("no frame");
    return frame;
  };

  const ctx: RunContext = {
    program,
    heap,
    *eval(expr: Expr) {
      const def = getNode(keyOf(expr));
      return yield* (def.run as ExprRunner)(expr, ctx);
    },
    *exec(body: Stmt[]) {
      for (const stmt of body) {
        yield { type: "enter", nodeId: stmt.id }; // R-03
        const def = getNode(keyOf(stmt));
        const signal: Signal = yield* (def.run as StmtRunner)(stmt, ctx);
        if (signal) return signal;
      }
      return undefined;
    },
    get(name, nodeId) {
      const value = top().vars.get(name);
      if (value === undefined) throw new Error(`unbound variable ${name} at ${nodeId}`);
      return value;
    },
    set(name, value) {
      top().vars.set(name, value);
    },
    *call(fn, args, nodeId) {
      const def = functions.get(fn);
      if (!def) throw new Error(`unknown function ${fn}`);
      if (def.params.length !== args.length) {
        ctx.fail(nodeId, "E_ARITY", { name: fn, expected: def.params.length, got: args.length });
      }
      if (frames.length > CALL_DEPTH_LIMIT) ctx.fail(nodeId, "E_RECURSION");
      const vars = new Map<Id, Value>();
      def.params.forEach((param, i) => vars.set(param, args[i] ?? { t: "none" }));
      frames.push({ fn, callNodeId: nodeId, vars });
      yield { type: "call", nodeId, fn, args };
      const signal = yield* ctx.exec(def.body);
      const value: Value = signal?.kind === "return" ? signal.value : { t: "none" };
      yield { type: "return", nodeId, fn, value };
      frames.pop();
      return value;
    },
    fail(nodeId: NodeId, code: RuntimeCode, params = {}) {
      throw new RuntimeFailure(nodeId, code, params);
    },
    random: {
      int: (a, b) => random.int(a, b),
      float: (a, b) => random.float(a, b),
    },
    print(line) {
      stdout.push(line);
    },
  };

  // E-03 / R-01: inputs are the first main-level variables, in declaration order.
  for (const input of program.inputs) {
    const data = Object.hasOwn(inputs, input.name) ? (inputs[input.name] ?? null) : input.value;
    top().vars.set(input.name, toValue(data, heap));
  }

  const main = ctx.exec(program.main);
  let steps = 0;
  let loops = 0;
  let lastNodeId: NodeId = program.main[0]?.id ?? "";
  let finished: Done | undefined;

  return {
    next() {
      if (finished) return finished;
      if (steps >= STEP_LIMIT) {
        finished = {
          type: "error",
          error: { nodeId: lastNodeId, code: "E_STEP_LIMIT", params: {} },
          steps,
        };
        return finished;
      }
      try {
        const result = main.next();
        if (result.done) {
          finished = { type: "done", steps, loops };
          return finished;
        }
        const event: Event = result.value;
        steps += 1;
        if (event.type === "loop") loops += 1;
        lastNodeId = event.nodeId;
        return event;
      } catch (error) {
        if (error instanceof RuntimeFailure) {
          finished = { type: "error", error: error.error, steps };
          return finished;
        }
        throw error;
      }
    },
    state: () => ({ frames, heap }),
    stdout: () => [...stdout],
    draws: () => random.draws(),
  };
}
