// Import validates and migrates by `version`: a version-1 program has its targets turned into
// expressions, then every version is checked as version 2. It refuses what no edit could make: a
// wrong shape, an unknown kind, a bad id, a literal field its block would not write, a class,
// which no registered block constructs. What editing reaches is validate()'s job.
import { getBlock, hasBlock, keyOf } from "@/blocks/registry";
import { stmtName } from "./edit";
import { isNodeId, newId } from "./id";
import { KINDS, type Expr, type InputDecl, type Program } from "./types";
import { isRecord } from "./record";
import { isEmptyExpr, isTarget } from "./walk";

export class MigrateError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "MigrateError";
  }
}

/** The version `migrate()` returns, which a program file of this build is written in. */
export const CURRENT_VERSION = 2;

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new MigrateError(path, "expected an array");
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string") throw new MigrateError(path, "expected a string");
  return value;
}

function expectName(value: unknown, path: string): void {
  if (typeof value !== "string") throw new MigrateError(path, "expected a name");
}

/** Whether a JSON value declares an input: a name with a known kind. */
export function isInputDecl(value: unknown): value is InputDecl {
  return (
    isRecord(value) && typeof value.name === "string" && KINDS.some((kind) => kind === value.kind)
  );
}

function expectNodeId(value: unknown, path: string): void {
  if (!isNodeId(value)) throw new MigrateError(path, "expected a 12-character node id");
}

/** A node's literal fields, as its block would write them. */
function checkFields(node: Record<string, unknown>, path: string): void {
  const fault = getBlock(keyOf(node as unknown as Expr)).fieldsError?.(node);
  if (fault) throw new MigrateError(`${path}.${fault.field}`, fault.message);
}

/**
 * The raw expression values of a node, by the registry's slot roles (no `isExpr` filtering);
 * a required expression absent and a name that is no string are rejected here.
 */
function rawChildren(
  node: Record<string, unknown>,
  path: string,
): Array<{ value: unknown; path: string }> {
  const out: Array<{ value: unknown; path: string }> = [];
  for (const slot of getBlock(keyOf(node as unknown as Expr)).slots) {
    const value = node[slot.name];
    if (slot.role === "expr" || slot.role === "target") {
      if (value !== undefined || slot.required) out.push({ value, path: `${path}.${slot.name}` });
    } else if (slot.role === "id") {
      expectName(value, `${path}.${slot.name}`);
    } else if (slot.role === "exprs") {
      expectArray(value, `${path}.${slot.name}`).forEach((item, i) =>
        out.push({ value: item, path: `${path}.${slot.name}[${i}]` }),
      );
    }
  }
  return out;
}

function checkExpr(value: unknown, path: string): void {
  if (!isRecord(value)) throw new MigrateError(path, "expected an expression");
  expectNodeId(value.id, `${path}.id`);
  const kind = expectString(value.kind, `${path}.kind`);
  if (!hasBlock(keyOf(value as unknown as Expr))) {
    throw new MigrateError(`${path}.kind`, `unknown kind "${kind}"`);
  }
  checkFields(value, path);
  for (const child of rawChildren(value, path)) checkExpr(child.value, child.path);
}

function checkStmts(value: unknown, path: string): void {
  const stmts = expectArray(value, path);
  stmts.forEach((stmt, i) => {
    const at = `${path}[${i}]`;
    if (!isRecord(stmt)) throw new MigrateError(at, "expected a statement");
    expectNodeId(stmt.id, `${at}.id`);
    const kind = expectString(stmt.kind, `${at}.kind`);
    if ("name" in stmt) {
      if (typeof stmt.name !== "string" || /[\n\r]/.test(stmt.name)) {
        throw new MigrateError(`${at}.name`, "expected one line of text");
      }
      // A name is stored as an edit stores it (one line, its spaces collapsed), absent when empty.
      const name = stmtName(stmt.name);
      if (name === "") delete stmt.name;
      else stmt.name = name;
    }
    if (!hasBlock(kind) || getBlock(kind).shape !== "stmt") {
      throw new MigrateError(`${at}.kind`, `unknown kind "${kind}"`);
    }
    checkFields(stmt, at);
    for (const child of rawChildren(stmt, at)) checkExpr(child.value, child.path);
    // A target slot holds a target, or an input to fill: no edit makes any other value there.
    for (const slot of getBlock(kind).slots) {
      const held = stmt[slot.name] as Expr;
      if (slot.role === "target" && !isEmptyExpr(held) && !isTarget(held)) {
        throw new MigrateError(`${at}.${slot.name}`, "expected a target");
      }
    }
    // Every region by the block's slots: `regionsOf` passes over one that is no array.
    for (const slot of getBlock(kind).slots) {
      if (slot.role === "body") checkStmts(stmt[slot.name], `${at}.${slot.name}`);
    }
  });
}

function checkProgram(json: Record<string, unknown>): Program {
  expectString(json.title, "title");
  expectArray(json.inputs, "inputs").forEach((input, i) => {
    if (!isInputDecl(input)) {
      throw new MigrateError(
        `inputs[${i}]`,
        `expected { name, kind }, a kind of ${KINDS.join(", ")}`,
      );
    }
  });
  if (expectArray(json.classes, "classes").length > 0) {
    throw new MigrateError("classes[0]", "expected no class: no block constructs an object");
  }
  expectArray(json.functions, "functions").forEach((fn, i) => {
    if (!isRecord(fn) || typeof fn.name !== "string" || !Array.isArray(fn.params)) {
      throw new MigrateError(`functions[${i}]`, "expected { id, name, params, body }");
    }
    expectNodeId(fn.id, `functions[${i}].id`);
    fn.params.forEach((param, j) => expectString(param, `functions[${i}].params[${j}]`));
    checkStmts(fn.body, `functions[${i}].body`);
  });
  checkStmts(json.main, "main");
  return json as unknown as Program;
}

/** Every string under an `id` key of a JSON value: the ids a migrated node must not take. */
function heldIds(value: unknown, ids: Set<string>): Set<string> {
  if (Array.isArray(value)) for (const item of value) heldIds(item, ids);
  else if (isRecord(value)) {
    if (typeof value.id === "string") ids.add(value.id);
    for (const item of Object.values(value)) heldIds(item, ids);
  }
  return ids;
}

/**
 * A version-1 program as version 2 (`language.md`, Storage), in place: each target
 * `{ kind, ...parts }` the expression of that kind with a fresh id, and a variable target with no
 * name `empty`. A value that is no target is left for the check to refuse.
 */
function fromV1(json: Record<string, unknown>): void {
  const taken = heldIds(json, new Set());
  const freshId = (): string => {
    let id = newId();
    while (taken.has(id)) id = newId();
    taken.add(id);
    return id;
  };
  const upgrade = (stmts: unknown): void => {
    if (!Array.isArray(stmts)) return;
    for (const stmt of stmts) {
      if (!isRecord(stmt) || typeof stmt.kind !== "string" || !hasBlock(stmt.kind)) continue;
      for (const slot of getBlock(stmt.kind).slots) {
        const value = stmt[slot.name];
        if (slot.role === "body") upgrade(value);
        if (slot.role !== "target" || !isRecord(value) || typeof value.kind !== "string") continue;
        stmt[slot.name] =
          value.kind === "var" && value.name === ""
            ? { id: freshId(), kind: "empty" }
            : { ...value, id: freshId() };
      }
    }
  };
  upgrade(json.main);
  if (Array.isArray(json.functions)) {
    for (const fn of json.functions) if (isRecord(fn)) upgrade(fn.body);
  }
  json.version = CURRENT_VERSION;
}

export function migrate(json: unknown): Program {
  if (!isRecord(json)) throw new MigrateError("", "expected a program object");
  const version = json.version;
  if (version === 1) fromV1(json);
  else if (version !== CURRENT_VERSION) {
    throw new MigrateError("version", `unsupported version ${String(version)}`);
  }
  return checkProgram(json);
}
