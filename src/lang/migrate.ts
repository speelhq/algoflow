// Import validates a program of the current `version`. It refuses what no edit could make: a
// wrong shape, an unknown type, a bad id, a field its block would not write, a class,
// which no registered block definition constructs. What editing reaches is validate()'s job. A
// draft whose text is now a value of its slot is read as that value.
import { getBlockDef, hasBlockDef, registryKey } from "@/blocks/registry";
import { storeCaption } from "./edit";
import { isNodeId } from "./id";
import { KINDS, type Expr, type InputDecl, type Program } from "./types";
import { isRecord } from "./record";
import { parseSlotText } from "./drafts";
import { draftText, isTarget } from "./walk";

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
export const CURRENT_VERSION = 1;

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

/** The fields that `fieldsError` checks, as the block's definition would write them. */
function checkFields(block: Record<string, unknown>, path: string): void {
  const fault = getBlockDef(registryKey(block as unknown as Expr)).fieldsError?.(block);
  if (fault) throw new MigrateError(`${path}.${fault.field}`, fault.message);
}

/**
 * The raw expression values of a block, by the registry's slot roles (no `isExpr` filtering);
 * an absent expression that isn't optional and a name that is no string are rejected here.
 */
function rawChildren(
  block: Record<string, unknown>,
  path: string,
): Array<{ value: unknown; path: string }> {
  const out: Array<{ value: unknown; path: string }> = [];
  for (const slot of getBlockDef(registryKey(block as unknown as Expr)).slots) {
    const value = block[slot.name];
    if (slot.role === "expr" || slot.role === "target") {
      const mayBeAbsent = slot.role === "expr" && slot.optional;
      if (value !== undefined || !mayBeAbsent) out.push({ value, path: `${path}.${slot.name}` });
    } else if (slot.role === "name") {
      expectName(value, `${path}.${slot.name}`);
    } else if (slot.role === "exprs") {
      expectArray(value, `${path}.${slot.name}`).forEach((item, i) =>
        out.push({ value: item, path: `${path}.${slot.name}[${i}]` }),
      );
    }
  }
  return out;
}

/**
 * Each draft of a statement whose text is a value of its slot, read as that value, because a later
 * release can register what the text names (`language.md`, Expressions, Drafts): an `expr` slot's
 * text that parses, a `target` slot's that parses as a target, and an `exprs` slot's only item
 * whose text parses as values separated by commas. An `exprs` slot's only item with no text is no
 * item, as a field with no text holds it.
 */
function readDrafts(block: Record<string, unknown>): void {
  for (const slot of getBlockDef(registryKey(block as unknown as Expr)).slots) {
    if (slot.role !== "expr" && slot.role !== "target" && slot.role !== "exprs") continue;
    const held = block[slot.name];
    // An `exprs` slot holds a draft only as its only item (`checkItemDrafts`).
    const text = draftText(slot.role === "exprs" && Array.isArray(held) ? held[0] : held);
    if (text === undefined) continue;
    const read = parseSlotText(slot.role, text);
    if ("value" in read) block[slot.name] = read.value;
  }
}

/**
 * The fault of a draft outside a statement's slot, which no edit makes (`language.md`,
 * Expressions, Drafts).
 */
const DRAFT_ELSEWHERE = "expected a draft only as a statement's slot";

/** Rejects a draft beside other items of a statement's `exprs` slot, which no edit makes. */
function checkItemDrafts(stmt: Record<string, unknown>, path: string): void {
  for (const slot of getBlockDef(registryKey(stmt as unknown as Expr)).slots) {
    const items = stmt[slot.name];
    if (slot.role !== "exprs" || !Array.isArray(items) || items.length <= 1) continue;
    items.forEach((item, i) => {
      if (draftText(item) !== undefined) {
        throw new MigrateError(`${path}.${slot.name}[${i}]`, DRAFT_ELSEWHERE);
      }
    });
  }
}

function checkExpr(value: unknown, path: string): void {
  if (!isRecord(value)) throw new MigrateError(path, "expected an expression");
  expectNodeId(value.id, `${path}.id`);
  const type = expectString(value.type, `${path}.type`);
  if (!hasBlockDef(registryKey(value as unknown as Expr))) {
    throw new MigrateError(`${path}.type`, `unknown type "${type}"`);
  }
  checkFields(value, path);
  // No edit leaves an expression's name holding nothing, and nothing would show the fault, because
  // a field and a chart node write it as no text (`language.md`, Data, Faults that `migrate()`
  // rejects).
  const nothing = getBlockDef(registryKey(value as unknown as Expr)).slots.find(
    (slot) => slot.role === "name" && value[slot.name] === "",
  );
  if (nothing) throw new MigrateError(`${path}.${nothing.name}`, "expected the slot filled");
  for (const child of rawChildren(value, path)) {
    checkExpr(child.value, child.path);
    // No expression holds a draft, an empty slot included.
    if (draftText(child.value) !== undefined) throw new MigrateError(child.path, DRAFT_ELSEWHERE);
  }
}

function checkStmts(value: unknown, path: string): void {
  const stmts = expectArray(value, path);
  stmts.forEach((stmt, i) => {
    const at = `${path}[${i}]`;
    if (!isRecord(stmt)) throw new MigrateError(at, "expected a statement");
    expectNodeId(stmt.id, `${at}.id`);
    const type = expectString(stmt.type, `${at}.type`);
    if ("caption" in stmt) {
      if (typeof stmt.caption !== "string" || /[\n\r]/.test(stmt.caption)) {
        throw new MigrateError(`${at}.caption`, "expected one line of text");
      }
      storeCaption(stmt, stmt.caption);
    }
    if (!hasBlockDef(type) || getBlockDef(type).shape !== "stmt") {
      throw new MigrateError(`${at}.type`, `unknown type "${type}"`);
    }
    checkFields(stmt, at);
    for (const child of rawChildren(stmt, at)) checkExpr(child.value, child.path);
    checkItemDrafts(stmt, at);
    readDrafts(stmt);
    // A target slot holds a target, or a draft: no edit makes any other value there.
    for (const slot of getBlockDef(type).slots) {
      const held = stmt[slot.name] as Expr;
      if (slot.role === "target" && draftText(held) === undefined && !isTarget(held)) {
        throw new MigrateError(`${at}.${slot.name}`, "expected a target");
      }
    }
    // Every region by the block's slots: `bodyRegions` passes over one that is no array.
    for (const slot of getBlockDef(type).slots) {
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

export function migrate(json: unknown): Program {
  if (!isRecord(json)) throw new MigrateError("", "expected a program object");
  const version = json.version;
  if (version !== CURRENT_VERSION) {
    throw new MigrateError("version", `unsupported version ${String(version)}`);
  }
  return checkProgram(json);
}
