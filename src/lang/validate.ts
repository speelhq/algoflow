// Every validation code, run after every edit and before every run: node ids, names, scope rules,
// jumps and returns, drafts, and calls.
// Dispatch is registry-driven: slots, `requires`, `params`, `callee`; where a statement sits and
// what it may read come from `statementScopes`.
import { builtinKey, getBlockDef, hasBlockDef, registryKey } from "@/blocks/registry";
import { expectedArgs } from "@/blocks/types";
import {
  NAME_PATTERN,
  RESERVED,
  type Diagnostic,
  type Name,
  type NodeId,
  type Program,
  type Routine,
  type Stmt,
} from "./types";
import { parseSlotText } from "./drafts";
import { declaredBy, isLoop, isVisible, statementScopes, type StatementScope } from "./scope";
import { draftSlots, programIds, stmtExprs, findVariableName } from "./walk";

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name) && !RESERVED.has(name);
}

/** A builtin call key (`abs`, `randint`, …) may not be redefined. */
function isBuiltinName(name: string): boolean {
  return hasBlockDef(builtinKey(name));
}

class Collector {
  readonly diagnostics: Diagnostic[] = [];
  /** Functions whose own name a diagnostic refuses: no call can name them. */
  readonly refusedDefinitions = new Set<NodeId>();
  /** Functions: names a variable may not shadow (they would call a different thing in CPython). */
  private readonly callables = new Set<Name>();

  /** The names of each routine's loop variables, which no other variable of it may take. */
  private readonly loopNames = new Map<Routine, Set<Name>>();

  constructor(private readonly program: Program) {
    for (const { stmt, routine } of statementScopes(program)) {
      if (!isLoop(stmt)) continue;
      const held = this.loopNames.get(routine) ?? new Set<Name>();
      for (const declared of declaredBy(stmt)) held.add(declared.name);
      this.loopNames.set(routine, held);
    }
  }

  /** Whether a loop of `routine` has a variable named `name`. */
  private hasLoopName(routine: Routine, name: Name): boolean {
    return this.loopNames.get(routine)?.has(name) === true;
  }

  report(
    nodeId: NodeId,
    code: Diagnostic["code"],
    params: Diagnostic["params"] = {},
    fix?: Diagnostic["fix"],
  ): void {
    this.diagnostics.push(fix ? { nodeId, code, params, fix } : { nodeId, code, params });
  }

  // ------------------------------------------------------------ ids

  ids(): void {
    const seen = new Set<NodeId>();
    for (const id of programIds(this.program)) {
      if (seen.has(id)) this.report(id, "E_DUPLICATE_ID");
      seen.add(id);
    }
  }

  // ------------------------------------------------------------ declarations

  /** Reports the name of a function; the definition is then one no call can name. */
  private refuseName(nodeId: NodeId, code: "E_BAD_NAME" | "E_DUPLICATE_NAME", name: Name): void {
    this.report(nodeId, code, { name });
    this.refusedDefinitions.add(nodeId);
  }

  declarations(): void {
    const taken = new Set<Name>(this.program.inputs.map((input) => input.name));
    const claim = (name: Name, nodeId: NodeId) => {
      if (taken.has(name) || isBuiltinName(name)) this.refuseName(nodeId, "E_DUPLICATE_NAME", name);
      taken.add(name);
      this.callables.add(name);
    };
    for (const fn of this.program.functions) {
      if (!isValidName(fn.name)) this.refuseName(fn.id, "E_BAD_NAME", fn.name);
      const params = new Set<Name>();
      for (const param of fn.params) {
        if (!isValidName(param)) this.report(fn.id, "E_BAD_NAME", { name: param });
        if (params.has(param) || this.hasLoopName(fn.id, param)) {
          this.report(fn.id, "E_DUPLICATE_NAME", { name: param });
        }
        params.add(param);
      }
      claim(fn.name, fn.id);
    }
  }

  // ------------------------------------------------------------ statements

  /** Checks every statement in program order, each where it sits (`statementScopes`). */
  statements(): void {
    for (const scope of statementScopes(this.program)) {
      const { stmt } = scope;
      this.drafts(stmt);
      this.calls(stmt);
      this.reads(scope);
      this.control(scope);
      for (const { name } of declaredBy(stmt)) {
        // A loop's variable and any other variable keep apart (`language.md`, Scope, Names a
        // definition can't take).
        const shared = isLoop(stmt)
          ? this.isLoopNameTaken(scope, name)
          : this.takesLoopName(scope, name);
        if (!isValidName(name)) this.report(stmt.id, "E_BAD_NAME", { name });
        else if (this.callables.has(name) || isBuiltinName(name) || shared) {
          this.report(stmt.id, "E_DUPLICATE_NAME", { name });
        }
      }
    }
  }

  /** Whether a statement declares `name` as a new variable that a loop of its routine has. */
  private takesLoopName({ routine, visible }: StatementScope, name: Name): boolean {
    return !isVisible(visible, name) && this.hasLoopName(routine, name);
  }

  /** Whether a loop's variable `name` is one that an input or a loop around it has. */
  private isLoopNameTaken({ routine, loops }: StatementScope, name: Name): boolean {
    const input = routine === "main" && this.program.inputs.some((each) => each.name === name);
    return input || loops.some((loop) => declaredBy(loop).some((d) => d.name === name));
  }

  private reads({ stmt, visible, declaredInside }: StatementScope): void {
    const bound = new Set(declaredBy(stmt).map((declared) => declared.target));
    for (const expr of stmtExprs(stmt)) {
      if (bound.has(expr)) continue;
      const name = findVariableName(expr);
      if (name === undefined || isVisible(visible, name)) continue;
      const compound = declaredInside.get(name);
      if (compound === undefined) this.report(stmt.id, "E_UNDEFINED", { name });
      else this.report(stmt.id, "E_DECLARE_FIRST", { name, compound }, "hoistAssign");
    }
  }

  private control({ stmt, routine, loops }: StatementScope): void {
    const { requires } = getBlockDef(registryKey(stmt));
    if (requires === "loop" && loops.length === 0) this.report(stmt.id, "E_BREAK_OUTSIDE");
    if (requires === "function" && routine === "main") this.report(stmt.id, "E_RETURN_OUTSIDE");
  }

  // ------------------------------------------------------------ drafts

  /**
   * Every draft of a statement, at the draft's own node (`language.md`, Expressions, Drafts): one
   * with no text as an empty slot, one whose text doesn't parse as its slot's values by the
   * parser's error, and one in a target slot whose text parses as no target.
   */
  private drafts(stmt: Stmt): void {
    for (const { slot, role, expr: draft, text } of draftSlots(stmt)) {
      if (text === "") {
        this.report(draft.id, "E_EMPTY_SLOT", { slot });
        continue;
      }
      const read = parseSlotText(role, text);
      if (!("error" in read)) continue;
      const { error } = read;
      if (error === "E_NOT_TARGET") this.report(draft.id, error);
      else this.report(draft.id, error.code, { ...error.params, position: error.position });
    }
  }

  // ------------------------------------------------------------ calls (E_ARITY, E_UNKNOWN_CALL)

  private calls(stmt: Stmt): void {
    for (const expr of stmtExprs(stmt)) {
      const def = getBlockDef(registryKey(expr));
      const callee = def.callee?.(expr);
      if (!callee) continue;
      switch (callee.family) {
        case "builtin":
        case "method": {
          const expected = expectedArgs(def.params ?? [], callee.argc);
          if (expected !== undefined) {
            this.report(stmt.id, "E_ARITY", { name: callee.name, expected, got: callee.argc });
          }
          break;
        }
        case "function": {
          const fn = this.program.functions.find((f) => f.name === callee.name);
          if (!fn) this.report(stmt.id, "E_UNKNOWN_CALL", { name: callee.name });
          else if (fn.params.length !== callee.argc) {
            this.report(stmt.id, "E_ARITY", {
              name: callee.name,
              expected: fn.params.length,
              got: callee.argc,
            });
          }
          break;
        }
      }
    }
  }
}

type Analysis = {
  diagnostics: Diagnostic[];
  refusedDefinitions: Set<NodeId>;
};

// One Collector pass per Program object: the driver, the canvas, and the panels all ask.
// Edits are pure, so a mutated Program is never re-validated; build a new object.
const analyses = new WeakMap<Program, Analysis>();

function analyze(program: Program): Analysis {
  let analysis = analyses.get(program);
  if (!analysis) {
    const collector = new Collector(program);
    collector.ids();
    collector.declarations();
    collector.statements();
    analysis = {
      diagnostics: collector.diagnostics,
      refusedDefinitions: collector.refusedDefinitions,
    };
    analyses.set(program, analysis);
  }
  return analysis;
}

export function validate(program: Program): Diagnostic[] {
  return analyze(program).diagnostics;
}

/** A program runs only when it has no diagnostic. */
export function canRun(program: Program): boolean {
  return validate(program).length === 0;
}

/** Ids of the functions whose own name a diagnostic refuses: no call can name them. */
export function refusedDefinitions(program: Program): ReadonlySet<NodeId> {
  return analyze(program).refusedDefinitions;
}
