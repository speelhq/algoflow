// U-63: one sentence per event, as a message key with its params (`run.narrate.*`). Values
// are written the way blocks write them (`true`, `none`, `"text"`), never in Python notation.
import { keyValue } from "@/lang/data";
import { t, type MessageKey, type Params } from "@/i18n/t";
import type { Expr, Heap, Program, Value } from "@/lang/types";
import { childExprs, nodesById } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes";
import type { Done, Event, Frame, Ref, State } from "@/runtime/types";
import {
  capitalise,
  conditionOf,
  exprText,
  sentence,
  slotSentence,
  valueText,
} from "@/ui/chart/text";
import { matchTemplates, variableName } from "@/ui/expression/templates";

export type Narration = { key: MessageKey; params: Params };

export type NarrateContext = {
  program: Program;
  /** The state after the event (R-12 `state`). */
  state: State;
  /** R-12 `frame`: the frame whose variables name the values. */
  frame: number;
  /** R-12 `pass`, for a `loop` event. */
  pass: number | null;
};

/** The name a heap entry goes by: the first variable of the frame that holds it. */
function nameOf(ref: number, frame: Frame | undefined, heap: Heap): string {
  for (const [name, value] of frame?.vars ?? []) {
    if ("ref" in value && value.ref === ref) return name;
  }
  const kind = heap.get(ref)?.kind;
  if (kind === "dict") return t("run.narrate.ref.dict");
  return t(kind === "obj" ? "run.narrate.ref.object" : "run.narrate.ref.list");
}

function refText(ref: Ref, frame: Frame | undefined, heap: Heap): string {
  if ("var" in ref) return ref.var;
  const name = nameOf(ref.heap, frame, heap);
  if ("index" in ref) return t("run.narrate.ref.index", { index: ref.index, name });
  if ("key" in ref) {
    return t("run.narrate.ref.key", { name, key: valueText(keyValue(ref.key), heap) });
  }
  return t("run.narrate.ref.field", { name, field: ref.field });
}

function valueAt(ref: Ref, frame: Frame | undefined, heap: Heap): Value | undefined {
  if ("var" in ref) return frame?.vars.get(ref.var);
  const entry = heap.get(ref.heap);
  if ("index" in ref) return entry?.kind === "list" ? entry.items[ref.index] : undefined;
  if ("key" in ref) return entry?.kind === "dict" ? entry.entries.get(ref.key) : undefined;
  return entry?.kind === "obj" ? entry.fields.get(ref.field) : undefined;
}

/** A template blank that is a variable or a literal (U-63): its value now, or as written. */
function blankText(blank: Expr, frame: Frame | undefined, heap: Heap): string | undefined {
  if (childExprs(blank).length > 0) return undefined;
  const name = variableName(blank);
  if (name === undefined) return exprText(blank);
  const value = frame?.vars.get(name);
  return value ? valueText(value, heap) : name;
}

/**
 * U-63: the condition as its template sentence with the values of the moment. A template
 * over the compared operands takes them from the event; one whose blanks sit deeper
 * (`a % b == 0`) applies only when both blanks are variables or literals.
 */
function comparedText(
  event: Extract<Event, { type: "compare" }>,
  frame: Frame | undefined,
  ctx: NarrateContext,
): string {
  const node = nodesById(ctx.program).get(event.nodeId);
  const { heap } = ctx.state;
  if (!node || getNode(keyOf(node)).shape !== "expr") return "";
  const expr = node as Expr;
  const [left, right] = childExprs(expr);
  for (const { template, a, b } of matchTemplates(expr)) {
    if (a === left && b === right) {
      return t(template.key, { a: valueText(event.left, heap), b: valueText(event.right, heap) });
    }
    const blanks = [blankText(a, frame, heap), blankText(b, frame, heap)];
    if (blanks[0] !== undefined && blanks[1] !== undefined) {
      return t(template.key, { a: blanks[0], b: blanks[1] });
    }
  }
  return exprText(expr);
}

const decided = new WeakMap<Program, Set<string>>();

/** The expressions that are a diamond's whole condition: their compare decides Yes or No. */
function decisions(program: Program): Set<string> {
  let ids = decided.get(program);
  if (!ids) {
    ids = new Set();
    for (const node of nodesById(program).values()) {
      const chart = getNode(keyOf(node)).chart;
      const condition = chart && !("counted" in chart) ? conditionOf(node) : undefined;
      if (condition) ids.add(condition.id);
    }
    decided.set(program, ids);
  }
  return ids;
}

export function narrate(event: Event, ctx: NarrateContext): Narration {
  const { heap } = ctx.state;
  const frame = ctx.state.frames[ctx.frame];
  const node = nodesById(ctx.program).get(event.nodeId);
  switch (event.type) {
    case "enter": {
      if (!node) return { key: "run.narrate.enter", params: { sentence: "" } };
      const chart = getNode(keyOf(node)).chart;
      const condition = chart && !("counted" in chart) ? conditionOf(node) : undefined;
      return condition
        ? { key: "run.narrate.check", params: { condition: slotSentence(condition) } }
        : {
            key: "run.narrate.enter",
            params: { sentence: capitalise(sentence(node, ctx.program)) },
          };
    }
    case "read": {
      const [first] = event.refs;
      if (event.refs.length !== 1 || !first) {
        const heapRef = first && "heap" in first ? first.heap : -1;
        return {
          key: "run.narrate.readMany",
          params: { count: event.refs.length, name: nameOf(heapRef, frame, heap) },
        };
      }
      const value = valueAt(first, frame, heap);
      return {
        key: "run.narrate.read",
        params: {
          what: refText(first, frame, heap),
          value: value ? valueText(value, heap) : "",
        },
      };
    }
    case "compare": {
      const key = decisions(ctx.program).has(event.nodeId)
        ? event.result
          ? "run.narrate.compareYes"
          : "run.narrate.compareNo"
        : event.result
          ? "run.narrate.compareTrue"
          : "run.narrate.compareFalse";
      return { key, params: { condition: comparedText(event, frame, ctx) } };
    }
    case "write":
      return {
        key: "run.narrate.write",
        params: { what: refText(event.ref, frame, heap), value: valueText(event.value, heap) },
      };
    case "swap": {
      const name = "heap" in event.a ? nameOf(event.a.heap, frame, heap) : "";
      return {
        key: "run.narrate.swap",
        params: {
          i: "index" in event.a ? event.a.index : "",
          j: "index" in event.b ? event.b.index : "",
          name,
        },
      };
    }
    case "loop":
      return event.var !== undefined && event.value
        ? {
            key: "run.narrate.loop",
            params: { pass: ctx.pass ?? 1, var: event.var, value: valueText(event.value, heap) },
          }
        : { key: "run.narrate.loopPlain", params: { pass: ctx.pass ?? 1 } };
    case "print":
      return { key: "run.narrate.print", params: { text: event.text } };
    case "call":
      return {
        key: "run.narrate.call",
        params: { fn: event.fn, args: event.args.map((arg) => valueText(arg, heap)).join(", ") },
      };
    case "return":
      return {
        key: "run.narrate.return",
        params: { fn: event.fn, value: valueText(event.value, heap) },
      };
  }
}

/** U-63: the end of the run: `Finished in N steps`, or the error's message (U-70). */
export function narrateEnd(outcome: Done, total: number): Narration {
  return outcome.type === "error"
    ? { key: `error.${outcome.error.code}`, params: outcome.error.params }
    : { key: "run.narrate.done", params: { steps: total } };
}

/** U-81: what happened at the step `Watch this case` opened at. */
export function narrateDifference(difference: { line?: number }): Narration {
  return difference.line === undefined
    ? { key: "run.narrate.difference.end", params: {} }
    : { key: "run.narrate.difference.line", params: { line: difference.line } };
}
