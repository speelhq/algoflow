// 02-language "Validation": every code, run after every edit and before every run.
// Scope rules L-40..L-42; names L-01..L-05; slots L-09; defaults L-30.
import { getNode, hasNode, keyOf } from "@/nodes";
import type { NodeDef, Slot } from "@/nodes/types";
import {
  CLASS_NAME_PATTERN,
  NAME_PATTERN,
  RESERVED,
  type Data,
  type Diagnostic,
  type Expr,
  type FunctionDef,
  type Id,
  type NodeId,
  type Program,
  type Stmt,
} from "./types";
import { allExprs, childSlots, regionsOf } from "./walk";

type Bag = Record<string, unknown>;

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name) && !RESERVED.has(name);
}

export function isValidClassName(name: string): boolean {
  return CLASS_NAME_PATTERN.test(name) && !RESERVED.has(name);
}

/** L-30 */
export function isValidDefault(data: Data): boolean {
  if (data === null || typeof data !== "object") return true;
  if (Array.isArray(data)) return data.length === 0;
  return Object.keys(data).length === 0;
}

class Collector {
  readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly program: Program) {}

  report(
    nodeId: NodeId,
    code: Diagnostic["code"],
    params: Diagnostic["params"] = {},
    fix?: Diagnostic["fix"],
  ) {
    this.diagnostics.push(fix ? { nodeId, code, params, fix } : { nodeId, code, params });
  }

  // ------------------------------------------------------------ declarations

  declarations(): void {
    const seen = new Map<Id, NodeId>();
    for (const input of this.program.inputs) seen.set(input.name, "");
    for (const fn of this.program.functions) {
      if (!isValidName(fn.name)) this.report(fn.id, "E_BAD_NAME", { name: fn.name });
      for (const param of fn.params) {
        if (!isValidName(param)) this.report(fn.id, "E_BAD_NAME", { name: param });
      }
      if (seen.has(fn.name)) this.report(fn.id, "E_DUPLICATE_NAME", { name: fn.name });
      seen.set(fn.name, fn.id);
    }
    for (const cls of this.program.classes) {
      if (!isValidClassName(cls.name)) this.report(cls.id, "E_BAD_NAME", { name: cls.name });
      if (seen.has(cls.name)) this.report(cls.id, "E_DUPLICATE_NAME", { name: cls.name });
      seen.set(cls.name, cls.id);
      const fields = new Set<string>();
      for (const field of cls.fields) {
        if (!isValidName(field.name)) this.report(cls.id, "E_BAD_NAME", { name: field.name });
        if (fields.has(field.name)) this.report(cls.id, "E_DUPLICATE_NAME", { name: field.name });
        fields.add(field.name);
        if (!isValidDefault(field.default)) this.report(cls.id, "E_DEFAULT", { field: field.name });
      }
    }
  }

  // ------------------------------------------------------------ ids (L-04)

  ids(): void {
    const seen = new Set<NodeId>();
    const check = (id: NodeId) => {
      if (seen.has(id)) this.report(id, "E_DUPLICATE_ID");
      seen.add(id);
    };
    for (const cls of this.program.classes) check(cls.id);
    for (const fn of this.program.functions) {
      check(fn.id);
      this.idsIn(fn.body, check);
    }
    this.idsIn(this.program.main, check);
  }

  private idsIn(stmts: Stmt[], check: (id: NodeId) => void): void {
    for (const stmt of stmts) {
      check(stmt.id);
      for (const { expr } of childSlots(stmt)) for (const e of allExprs(expr)) check(e.id);
      for (const region of regionsOf(stmt)) this.idsIn(region.stmts, check);
    }
  }

  // ------------------------------------------------------------ regions

  scopes(): void {
    for (const fn of this.program.functions) {
      this.region(fn.body, new Set(fn.params), new Map(), { loop: 0, fn });
    }
    const visible = new Set(this.program.inputs.map((input) => input.name));
    this.region(this.program.main, visible, new Map(), { loop: 0, fn: null });
  }

  /**
   * Walks one region. `visible` is mutated with names assigned here; `inner`
   * maps names first assigned inside an earlier nested region of this region
   * to that frame's id (L-41). Returns the names this region declared.
   */
  private region(
    stmts: Stmt[],
    visible: Set<Id>,
    inner: Map<Id, NodeId>,
    ctx: { loop: number; fn: FunctionDef | null },
  ): Set<Id> {
    const declared = new Set<Id>();
    for (const stmt of stmts) {
      const def = getNode(keyOf(stmt));
      this.slots(stmt, def);
      this.calls(stmt);
      this.reads(stmt, visible, inner);
      this.control(stmt, def, ctx);

      for (const name of this.declaredBy(stmt, def)) {
        if (!isValidName(name)) this.report(stmt.id, "E_BAD_NAME", { name });
        if (!visible.has(name)) declared.add(name);
        visible.add(name);
      }

      const regions = regionsOf(stmt);
      const bodyCtx = def.loop ? { ...ctx, loop: ctx.loop + 1 } : ctx;
      for (const region of regions) {
        const nested = new Set(visible);
        const nestedDeclared = this.region(region.stmts, nested, new Map(inner), bodyCtx);
        for (const name of nestedDeclared) {
          if (!visible.has(name) && !inner.has(name)) inner.set(name, stmt.id);
        }
      }
    }
    return declared;
  }

  /** Names a statement assigns in its own region: var targets and loop variables (id slots). */
  private declaredBy(stmt: Stmt, def: NodeDef): Id[] {
    const bag = stmt as unknown as Bag;
    const names: Id[] = [];
    for (const slot of def.slots) {
      const value = bag[slot.name];
      if (slot.role === "id" && typeof value === "string" && value !== "") names.push(value);
      if (slot.role === "target" && value && typeof value === "object") {
        const target = value as { kind: string; name?: string };
        if (target.kind === "var" && target.name) names.push(target.name);
      }
    }
    return names;
  }

  private reads(stmt: Stmt, visible: Set<Id>, inner: Map<Id, NodeId>): void {
    for (const { expr: root } of childSlots(stmt)) {
      for (const expr of allExprs(root)) {
        if (expr.kind !== "var" || expr.name === "" || visible.has(expr.name)) continue;
        const frame = inner.get(expr.name);
        if (frame !== undefined) {
          this.report(stmt.id, "E_DECLARE_FIRST", { name: expr.name, frame }, "hoistAssign");
        } else {
          this.report(stmt.id, "E_UNDEFINED", { name: expr.name });
        }
      }
    }
  }

  private control(stmt: Stmt, def: NodeDef, ctx: { loop: number; fn: FunctionDef | null }): void {
    if (def.requires === "loop" && ctx.loop === 0) this.report(stmt.id, "E_BREAK_OUTSIDE");
    if (def.requires === "function" && ctx.fn === null) this.report(stmt.id, "E_RETURN_OUTSIDE");
  }

  // ------------------------------------------------------------ slots (L-09)

  private slots(stmt: Stmt, def: NodeDef): void {
    this.requiredSlots(stmt, def, stmt.id);
    const visit = (node: Stmt | Expr) => {
      for (const { slot, expr } of childSlots(node)) {
        if (expr.kind === "empty") {
          this.report(stmt.id, "E_EMPTY_SLOT", { slot });
          continue;
        }
        this.requiredSlots(expr, getNode(keyOf(expr)), stmt.id);
        visit(expr);
      }
    };
    visit(stmt);
  }

  private requiredSlots(node: Stmt | Expr, def: NodeDef, stmtId: NodeId): void {
    const bag = node as unknown as Bag;
    for (const slot of def.slots) {
      if (!slot.required) continue;
      if (isEmptySlot(slot, bag[slot.name]))
        this.report(stmtId, "E_EMPTY_SLOT", { slot: slot.name });
    }
  }

  // ------------------------------------------------------------ calls (E_ARITY, E_UNKNOWN_CALL)

  private calls(stmt: Stmt): void {
    for (const { expr: root } of childSlots(stmt)) {
      for (const expr of allExprs(root)) {
        if (expr.kind === "call") this.checkCall(stmt.id, expr.fn, expr.args.length);
        else if (expr.kind === "new") this.checkNew(stmt.id, expr.cls, expr.args.length);
        else if (expr.kind === "method") this.checkMethod(stmt.id, expr.name, expr.args.length);
      }
    }
  }

  private checkCall(stmtId: NodeId, name: Id, got: number): void {
    const builtin = hasNode(`call:${name}`) ? getNode(`call:${name}`) : undefined;
    if (builtin) return this.arity(stmtId, name, builtin.params ?? [], got);
    const fn = this.program.functions.find((f) => f.name === name);
    if (!fn) return this.report(stmtId, "E_UNKNOWN_CALL", { name });
    if (fn.params.length !== got) {
      this.report(stmtId, "E_ARITY", { name, expected: fn.params.length, got });
    }
  }

  private checkNew(stmtId: NodeId, name: Id, got: number): void {
    const cls = this.program.classes.find((c) => c.name === name);
    if (!cls) return this.report(stmtId, "E_UNKNOWN_CALL", { name });
    if (got > cls.fields.length) {
      this.report(stmtId, "E_ARITY", { name, expected: cls.fields.length, got });
    }
  }

  private checkMethod(stmtId: NodeId, name: Id, got: number): void {
    if (!hasNode(`method:${name}`)) return this.report(stmtId, "E_UNKNOWN_CALL", { name });
    this.arity(stmtId, name, getNode(`method:${name}`).params ?? [], got);
  }

  /** Optional parameters end with `?`. */
  private arity(stmtId: NodeId, name: Id, params: string[], got: number): void {
    const required = params.filter((p) => !p.endsWith("?")).length;
    if (got < required || got > params.length) {
      this.report(stmtId, "E_ARITY", { name, expected: required, got });
    }
  }
}

function isEmptySlot(slot: Slot, value: unknown): boolean {
  switch (slot.role) {
    case "expr":
      return value === undefined || value === null;
    case "id":
      return typeof value !== "string" || value === "";
    case "text":
      return value === undefined || value === "";
    case "target":
      return (
        !value ||
        ((value as { kind?: string; name?: string }).kind === "var" &&
          !(value as { name?: string }).name)
      );
    case "exprs":
      return !Array.isArray(value) || value.length === 0;
    default:
      return false;
  }
}

export function validate(program: Program): Diagnostic[] {
  const collector = new Collector(program);
  collector.ids();
  collector.declarations();
  collector.scopes();
  return collector.diagnostics;
}
