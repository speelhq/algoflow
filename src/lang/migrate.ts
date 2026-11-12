// Import validates a program of the current `version`. It refuses what no edit could make: a
// wrong shape, an unknown type, a bad id, a field its block would not write, a class,
// which no registered block definition constructs. What editing reaches is validate()'s job. A
// draft whose text is now a value of its slot is read as that value.
import { getBlockDef, hasBlockDef, keyOf } from "@/blocks/registry";
import { normalizeCaption } from "./edit";
import { isNodeId } from "./id";
import { KINDS, type Expr, type InputDecl, type Program } from "./types";
import { isRecord } from "./record";
import { draftValue } from "./drafts";
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
  const fault = getBlockDef(keyOf(block as unknown as Expr)).fieldsError?.(block);
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
  for (const slot of getBlockDef(keyOf(block as unknown as Expr)).slots) {
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
 * whose text parses as values separated by commas.
 */
function readDrafts(block: Record<string, unknown>): void {
  for (const slot of getBlockDef(keyOf(block as unknown as Expr)).slots) {
    if (slot.role !== "expr" && slot.role !== "target" && slot.role !== "exprs") continue;
    const held = block[slot.name];
    // An `exprs` slot holds a draft with text as its only item (`checkDraftsHeld`).
    const text = draftText(slot.role === "exprs" && Array.isArray(held) ? held[0] : held);
    if (!text) continue;
    const read = draftValue(slot.role, text);
    if ("value" in read) block[slot.name] = read.value;
  }
}

/**
 * Rejects a draft with text that no edit makes (`language.md`, Data, Faults that `migrate()`
 * rejects): one that an expression holds, or one beside other items of an `exprs` slot. A draft
 * with no text passes there, because the value line still makes an empty slot inside a value and
 * beside a print's other values.
 */
function checkDraftsHeld(block: Record<string, unknown>, path: string): void {
  const def = getBlockDef(keyOf(block as unknown as Expr));
  for (const slot of def.slots) {
    if (slot.role !== "expr" && slot.role !== "target" && slot.role !== "exprs") continue;
    const held = block[slot.name];
    const items = slot.role === "exprs" && Array.isArray(held) ? held : [held];
    // A statement's slot holds a draft as its value, or as an `exprs` slot's only item.
    if (def.shape === "stmt" && items.length <= 1) continue;
    items.forEach((item, i) => {
      if (!draftText(item)) return;
      const at = slot.role === "exprs" ? `${path}.${slot.name}[${i}]` : `${path}.${slot.name}`;
      throw new MigrateError(at, "expected a draft only as a statement's slot");
    });
  }
}

function checkExpr(value: unknown, path: string): void {
  if (!isRecord(value)) throw new MigrateError(path, "expected an expression");
  expectNodeId(value.id, `${path}.id`);
  const type = expectString(value.type, `${path}.type`);
  if (!hasBlockDef(keyOf(value as unknown as Expr))) {
    throw new MigrateError(`${path}.type`, `unknown type "${type}"`);
  }
  checkFields(value, path);
  // No edit leaves an expression's name holding nothing, and a value line has no empty slot to
  // fill it at (`language.md`, Data, Faults that `migrate()` rejects).
  const nothing = getBlockDef(keyOf(value as unknown as Expr)).slots.find(
    (slot) => slot.role === "name" && value[slot.name] === "",
  );
  if (nothing) throw new MigrateError(`${path}.${nothing.name}`, "expected the slot filled");
  for (const child of rawChildren(value, path)) checkExpr(child.value, child.path);
  checkDraftsHeld(value, path);
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
      // A caption is stored as an edit stores it (one line, its spaces collapsed), absent when empty.
      const caption = normalizeCaption(stmt.caption);
      if (caption === "") delete stmt.caption;
      else stmt.caption = caption;
    }
    if (!hasBlockDef(type) || getBlockDef(type).shape !== "stmt") {
      throw new MigrateError(`${at}.type`, `unknown type "${type}"`);
    }
    checkFields(stmt, at);
    for (const child of rawChildren(stmt, at)) checkExpr(child.value, child.path);
    checkDraftsHeld(stmt, at);
    readDrafts(stmt);
    // A target slot holds a target, or a draft: no edit makes any other value there.
    for (const slot of getBlockDef(type).slots) {
      const held = stmt[slot.name] as Expr;
      if (slot.role === "target" && draftText(held) === undefined && !isTarget(held)) {
        throw new MigrateError(`${at}.${slot.name}`, "expected a target");
      }
    }
    // Every region by the block's slots: `regionsOf` passes over one that is no array.
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
