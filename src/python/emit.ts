// E-01..E-06: Program → Python text plus the NodeId → line map. No third-party imports (P-01).
import type { Data, Expr, FunctionDef, NodeId, Program, Stmt, Target } from "@/lang/types";
import { programExprs } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes";
import type { EmitContext, PyLine, Side } from "@/nodes/types";
import { floatRepr } from "@/runtime/values";
import { PRECEDENCE, binopAssociativity, needsParens } from "./precedence";

export type LineMap = Record<NodeId, { start: number; end: number }>;
export type Emitted = { code: string; map: LineMap };

const INDENT = "    "; // E-04

/** E-06: double quotes with `\\ \" \n \t` escaped. */
export function pyString(text: string): string {
  let out = '"';
  for (const ch of text) {
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return out + '"';
}

/** E-03: a `Data` literal in Python. Objects do not occur in inputs. */
export function dataToPython(data: Data): string {
  if (typeof data === "number") return Number.isInteger(data) ? String(data) : floatRepr(data);
  if (typeof data === "string") return pyString(data);
  if (typeof data === "boolean") return data ? "True" : "False";
  if (data === null) return "None";
  if (Array.isArray(data)) return `[${data.map(dataToPython).join(", ")}]`;
  if ("$float" in data && typeof data.$float === "number") return floatRepr(data.$float);
  if ("$cls" in data) throw new Error("objects cannot be emitted as input data");
  const parts = Object.entries(data).map(([key, value]) => {
    const k = key.startsWith("$int:") ? key.slice(5) : pyString(key);
    return `${k}: ${dataToPython(value)}`;
  });
  return `{${parts.join(", ")}}`;
}

function precedenceOf(expr: Expr): number {
  return getNode(keyOf(expr)).precedence?.(expr) ?? PRECEDENCE.atom;
}

const ctx: EmitContext = {
  expr(expr) {
    return getNode(keyOf(expr)).python(expr, ctx) as string;
  },
  operand(expr, precedence, side: Side) {
    const text = ctx.expr(expr);
    const parent = precedence;
    const child = precedenceOf(expr);
    // The associativity that matters is the parent's; callers pass their own precedence,
    // and binop is the only node with associativity, so derive it from the level.
    const associativity =
      parent === PRECEDENCE.power
        ? binopAssociativity("**")
        : parent === PRECEDENCE.compare
          ? "none"
          : "left";
    return needsParens(child, parent, side, associativity) ? `(${text})` : text;
  },
  target(target: Target) {
    switch (target.kind) {
      case "var":
        return target.name;
      case "index":
        return `${ctx.operand(target.list, PRECEDENCE.atom, "left")}[${ctx.expr(target.index)}]`;
      case "key":
        return `${ctx.operand(target.dict, PRECEDENCE.atom, "left")}[${ctx.expr(target.key)}]`;
      case "field":
        return `${ctx.operand(target.obj, PRECEDENCE.atom, "left")}.${target.field}`;
    }
  },
  block(stmts) {
    return { block: stmts };
  },
};

/** G-05: the emitter's expression function. */
export function unparse(expr: Expr): string {
  return ctx.expr(expr);
}

type Sink = { lines: string[]; map: LineMap };

function emitStmt(stmt: Stmt, indent: number, sink: Sink): void {
  const def = getNode(keyOf(stmt));
  const lines = def.python(stmt, ctx) as PyLine[];
  const start = sink.lines.length + 1;
  sink.map[stmt.id] = { start, end: start }; // E-01: a frame maps to its header line
  for (const line of lines) {
    if (typeof line === "string") sink.lines.push(INDENT.repeat(indent) + line);
    else emitBlock(line.block, indent + 1, sink);
  }
}

function emitBlock(stmts: Stmt[], indent: number, sink: Sink): void {
  if (stmts.length === 0) {
    sink.lines.push(`${INDENT.repeat(indent)}pass`);
    return;
  }
  for (const stmt of stmts) emitStmt(stmt, indent, sink);
}

function emitFunction(fn: FunctionDef, sink: Sink): void {
  const start = sink.lines.length + 1;
  sink.map[fn.id] = { start, end: start };
  sink.lines.push(`def ${fn.name}(${fn.params.join(", ")}):`);
  emitBlock(fn.body, 1, sink);
}

/** N-07 */
function emitClass(cls: Program["classes"][number], sink: Sink): void {
  const start = sink.lines.length + 1;
  sink.map[cls.id] = { start, end: start };
  const isContainer = (d: Data) =>
    (Array.isArray(d) && d.length === 0) ||
    (d !== null && typeof d === "object" && !Array.isArray(d) && Object.keys(d).length === 0);
  const params = cls.fields.map(
    (f) => `${f.name}=${isContainer(f.default) ? "None" : dataToPython(f.default)}`,
  );
  sink.lines.push(`class ${cls.name}:`);
  sink.lines.push(`${INDENT}def __init__(self${params.length ? ", " : ""}${params.join(", ")}):`);
  if (cls.fields.length === 0) sink.lines.push(`${INDENT}${INDENT}pass`);
  for (const f of cls.fields) {
    const value = isContainer(f.default)
      ? `${dataToPython(f.default)} if ${f.name} is None else ${f.name}`
      : f.name;
    sink.lines.push(`${INDENT}${INDENT}self.${f.name} = ${value}`);
  }
  sink.lines.push("");
  sink.lines.push(`${INDENT}def __repr__(self):`);
  const fields = cls.fields.map((f) => `${f.name}={self.${f.name}!r}`).join(", ");
  sink.lines.push(`${INDENT}${INDENT}return f"${cls.name}(${fields})"`);
}

export function emit(program: Program): Emitted {
  const imports = new Set<string>();
  for (const expr of programExprs(program)) {
    const needed = getNode(keyOf(expr)).imports;
    if (needed) imports.add(needed);
  }

  type Section = { kind: "plain" | "def"; render(sink: Sink): void };
  const sections: Section[] = [];
  if (imports.size > 0) {
    const names = [...imports].sort();
    sections.push({
      kind: "plain",
      render: (s) => names.forEach((n) => s.lines.push(`import ${n}`)),
    });
  }
  for (const cls of program.classes)
    sections.push({ kind: "def", render: (s) => emitClass(cls, s) });
  for (const fn of program.functions)
    sections.push({ kind: "def", render: (s) => emitFunction(fn, s) });
  if (program.inputs.length > 0 || program.main.length > 0) {
    sections.push({
      kind: "plain",
      render: (s) => {
        for (const input of program.inputs)
          s.lines.push(`${input.name} = ${dataToPython(input.value)}`);
        for (const stmt of program.main) emitStmt(stmt, 0, s);
      },
    });
  }

  const sink: Sink = { lines: [], map: {} };
  sections.forEach((section, i) => {
    if (i > 0) {
      const previous = sections[i - 1];
      const gap = section.kind === "def" || previous?.kind === "def" ? 2 : 1; // E-02
      for (let k = 0; k < gap; k += 1) sink.lines.push("");
    }
    section.render(sink);
  });
  return { code: sink.lines.map((l) => l.trimEnd()).join("\n") + "\n", map: sink.map }; // E-04
}
