// L-53: import validates and migrates by `version`. Only version 1 exists; the
// check is structural (shape, known kinds, ids); semantics are validate()'s job.
import { getNode, hasNode, keyOf } from "@/nodes";
import type { Expr, Program, Stmt } from "./types";
import { targetExprs } from "./walk";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export class MigrateError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "MigrateError";
  }
}

export const CURRENT_VERSION = 1;

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new MigrateError(path, "expected an array");
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string") throw new MigrateError(path, "expected a string");
  return value;
}

/** Raw slot contents of a node whose kind is known, without trusting their shape. */
function rawChildren(
  node: Record<string, unknown>,
  path: string,
): Array<{ value: unknown; path: string }> {
  const out: Array<{ value: unknown; path: string }> = [];
  for (const slot of getNode(keyOf(node as unknown as Expr)).slots) {
    const value = node[slot.name];
    if (slot.role === "expr") {
      if (value !== undefined) out.push({ value, path: `${path}.${slot.name}` });
    } else if (slot.role === "exprs") {
      expectArray(value, `${path}.${slot.name}`).forEach((item, i) =>
        out.push({ value: item, path: `${path}.${slot.name}[${i}]` }),
      );
    } else if (slot.role === "target") {
      if (!isRecord(value) || typeof value.kind !== "string")
        throw new MigrateError(`${path}.${slot.name}`, "expected a target");
      targetExprs(value as unknown as Parameters<typeof targetExprs>[0]).forEach((expr, i) =>
        out.push({ value: expr, path: `${path}.${slot.name}[${i}]` }),
      );
    }
  }
  return out;
}

function checkNode(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new MigrateError(path, "expected a node");
  expectString(value.id, `${path}.id`);
  const kind = expectString(value.kind, `${path}.kind`);
  if (!hasNode(keyOf(value as unknown as Expr))) {
    throw new MigrateError(`${path}.kind`, `unknown kind "${kind}"`);
  }
  return value;
}

function checkExpr(value: unknown, path: string): void {
  const node = checkNode(value, path);
  for (const child of rawChildren(node, path)) checkExpr(child.value, child.path);
}

function checkStmts(value: unknown, path: string): void {
  expectArray(value, path).forEach((stmt, i) => {
    const at = `${path}[${i}]`;
    const node = checkNode(stmt, at);
    for (const child of rawChildren(node, at)) checkExpr(child.value, child.path);
    for (const slot of getNode(keyOf(node as unknown as Stmt)).slots) {
      if (slot.role === "body") checkStmts(node[slot.name], `${at}.${slot.name}`);
    }
  });
}

function checkV1(json: Record<string, unknown>): Program {
  expectString(json.title, "title");
  expectArray(json.inputs, "inputs").forEach((input, i) => {
    if (!isRecord(input) || typeof input.name !== "string" || !("value" in input)) {
      throw new MigrateError(`inputs[${i}]`, "expected { name, value }");
    }
  });
  expectArray(json.classes, "classes").forEach((cls, i) => {
    if (
      !isRecord(cls) ||
      typeof cls.id !== "string" ||
      typeof cls.name !== "string" ||
      !Array.isArray(cls.fields)
    ) {
      throw new MigrateError(`classes[${i}]`, "expected { id, name, fields }");
    }
  });
  expectArray(json.functions, "functions").forEach((fn, i) => {
    if (
      !isRecord(fn) ||
      typeof fn.id !== "string" ||
      typeof fn.name !== "string" ||
      !Array.isArray(fn.params)
    ) {
      throw new MigrateError(`functions[${i}]`, "expected { id, name, params, body }");
    }
    checkStmts(fn.body, `functions[${i}].body`);
  });
  checkStmts(json.main, "main");
  return json as unknown as Program;
}

export function migrate(json: unknown): Program {
  if (!isRecord(json)) throw new MigrateError("", "expected a program object");
  const version = json.version;
  if (version !== CURRENT_VERSION) {
    throw new MigrateError("version", `unsupported version ${String(version)}`);
  }
  return checkV1(json);
}
