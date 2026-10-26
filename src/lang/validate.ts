// Every validation code, run after every edit and before every run: scope rules,
// names, empty slots, and field defaults.
// Dispatch is registry-driven: slots, `requires`, `loop`, `params`, `callee`.
import { builtinKey, getBlockDef, hasBlockDef, keyOf } from "@/blocks/registry";
import { expectedArgs, type BlockDef, type Slot } from "@/blocks/types";
import {
  NAME_PATTERN,
  RESERVED,
  type Diagnostic,
  type Expr,
  type Name,
  type NodeId,
  type Program,
  type Stmt,
} from "./types";
import { boundVariables, declaredBy } from "./scope";
import { childSlots, isEmptyExpr, programIds, regionsOf, stmtExprs, variableOf } from "./walk";

type Bag = Record<string, unknown>;

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name) && !RESERVED.has(name);
}

/** A builtin call key (`abs`, `randint`, …) may not be redefined. */
function isBuiltinName(name: string): boolean {
  return hasBlockDef(builtinKey(name));
}

type Scope = { loop: number; inFunction: boolean };

class Collector {
  readonly diagnostics: Diagnostic[] = [];
  /** Functions whose own name a diagnostic refuses: no call can name them. */
  readonly refusedDefinitions = new Set<NodeId>();
  /** Functions: names a variable may not shadow (they would call a different thing in CPython). */
  private readonly callables = new Set<Name>();

  constructor(private readonly program: Program) {}

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
        if (params.has(param)) this.report(fn.id, "E_DUPLICATE_NAME", { name: param });
        params.add(param);
      }
      claim(fn.name, fn.id);
    }
  }

  // ------------------------------------------------------------ regions

  scopes(): void {
    for (const fn of this.program.functions) {
      this.region(fn.body, new Set(fn.params), new Map(), { loop: 0, inFunction: true });
    }
    const visible = new Set(this.program.inputs.map((input) => input.name));
    this.region(this.program.main, visible, new Map(), { loop: 0, inFunction: false });
  }

  /**
   * Walks one region. `visible` gains the names assigned directly in it; `inner`
   * maps names first assigned inside an earlier compound statement of this region
   * to that statement's id. Returns every name first assigned anywhere inside
   * the region, so an enclosing region can attribute it to its compound statement.
   */
  private region(
    stmts: Stmt[],
    visible: Set<Name>,
    inner: Map<Name, NodeId>,
    scope: Scope,
  ): Set<Name> {
    const declared = new Set<Name>();
    for (const stmt of stmts) {
      const def = getBlockDef(keyOf(stmt));
      this.slots(stmt, def);
      this.calls(stmt);
      this.reads(stmt, visible, inner);
      this.control(stmt, def, scope);

      for (const { name } of declaredBy(stmt)) {
        if (!isValidName(name)) this.report(stmt.id, "E_BAD_NAME", { name });
        else if (this.callables.has(name) || isBuiltinName(name)) {
          this.report(stmt.id, "E_DUPLICATE_NAME", { name });
        }
        if (!visible.has(name)) declared.add(name);
        visible.add(name);
      }

      const bodyScope = def.loop ? { ...scope, loop: scope.loop + 1 } : scope;
      for (const region of regionsOf(stmt)) {
        const nestedDeclared = this.region(
          region.stmts,
          new Set(visible),
          new Map(inner),
          bodyScope,
        );
        for (const name of nestedDeclared) {
          if (visible.has(name)) continue;
          declared.add(name);
          if (!inner.has(name)) inner.set(name, stmt.id);
        }
      }
    }
    return declared;
  }

  private reads(stmt: Stmt, visible: Set<Name>, inner: Map<Name, NodeId>): void {
    const bound = new Set(boundVariables(stmt));
    for (const expr of stmtExprs(stmt)) {
      if (bound.has(expr)) continue;
      const name = variableOf(expr);
      if (name === undefined || name === "" || visible.has(name)) continue;
      const compound = inner.get(name);
      if (compound === undefined) this.report(stmt.id, "E_UNDEFINED", { name });
      else this.report(stmt.id, "E_DECLARE_FIRST", { name, compound }, "hoistAssign");
    }
  }

  private control(stmt: Stmt, def: BlockDef, scope: Scope): void {
    if (def.requires === "loop" && scope.loop === 0) this.report(stmt.id, "E_BREAK_OUTSIDE");
    if (def.requires === "function" && !scope.inFunction) this.report(stmt.id, "E_RETURN_OUTSIDE");
  }

  // ------------------------------------------------------------ slots

  private slots(stmt: Stmt, def: BlockDef): void {
    this.requiredSlots(stmt, def, stmt.id);
    const visit = (node: Stmt | Expr) => {
      for (const { slot, expr } of childSlots(node)) {
        if (isEmptyExpr(expr)) {
          this.report(stmt.id, "E_EMPTY_SLOT", { slot });
          continue;
        }
        this.requiredSlots(expr, getBlockDef(keyOf(expr)), stmt.id);
        visit(expr);
      }
    };
    visit(stmt);
  }

  private requiredSlots(node: Stmt | Expr, def: BlockDef, stmtId: NodeId): void {
    const bag = node as unknown as Bag;
    for (const slot of def.slots) {
      if (slot.required && isEmptySlot(slot, bag[slot.name])) {
        this.report(stmtId, "E_EMPTY_SLOT", { slot: slot.name });
      }
    }
  }

  // ------------------------------------------------------------ calls (E_ARITY, E_UNKNOWN_CALL)

  private calls(stmt: Stmt): void {
    for (const expr of stmtExprs(stmt)) {
      const def = getBlockDef(keyOf(expr));
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

function isEmptySlot(slot: Slot, value: unknown): boolean {
  switch (slot.role) {
    case "expr":
    case "target":
      return value === undefined || value === null;
    case "name":
      return typeof value !== "string" || value === "";
    case "text":
      return value === undefined || value === "";
    case "exprs":
      return !Array.isArray(value) || value.length === 0;
    default:
      return false;
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
    collector.scopes();
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
