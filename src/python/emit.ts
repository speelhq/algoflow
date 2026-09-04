// E-01..E-08: Program → Python text plus the NodeId → line map. No third-party imports (P-01).
import type {
  ClassDef,
  Data,
  Expr,
  FunctionDef,
  NodeId,
  Program,
  Stmt,
  Target,
} from "@/lang/types";
import { programExprs } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes";
import type { EmitContext, PyLine } from "@/nodes/types";
import { floatRepr } from "@/runtime/values";
import { PRECEDENCE, needsParens } from "./precedence";

export type LineMap = Record<NodeId, { start: number; end: number }>;
export type Emitted = { code: string; map: LineMap };

const INDENT = "    "; // E-04

/** E-06: double quotes; `\\ \" \n \t \r` escaped, other control characters as `\xNN`. */
export function pyString(text: string): string {
  let out = '"';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else if (code < 0x20 || code === 0x7f) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return `${out}"`;
}

/** E-03: a Data value as a Python literal. */
export function dataToPython(data: Data): string {
  if (typeof data === "number") {
    if (!Number.isInteger(data)) return floatRepr(data);
    return Math.abs(data) < 1e21 ? String(data) : BigInt(data).toString();
  }
  if (typeof data === "string") return pyString(data);
  if (typeof data === "boolean") return data ? "True" : "False";
  if (data === null) return "None";
  if (Array.isArray(data)) return `[${data.map(dataToPython).join(", ")}]`;
  if ("$float" in data && typeof data.$float === "number") return floatRepr(data.$float);
  if ("$cls" in data) throw new Error("objects cannot be emitted as input literals");
  const entries = Object.entries(data).map(
    ([key, value]) =>
      `${key.startsWith("$int:") ? key.slice(5) : pyString(key)}: ${dataToPython(value)}`,
  );
  return `{${entries.join(", ")}}`;
}

// ---------------------------------------------------------------- expression context (E-08)

const ctx: EmitContext = {
  expr(expr: Expr) {
    return getNode(keyOf(expr)).python(expr, ctx) as string;
  },
  operand(expr: Expr, parent: number, side) {
    const child = getNode(keyOf(expr)).precedence?.(expr) ?? PRECEDENCE.atom;
    const text = ctx.expr(expr);
    return needsParens(child, parent, side) ? `(${text})` : text;
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
  block(stmts: Stmt[]): PyLine {
    return { block: stmts };
  },
};

/** G-05: the emitter's expression function. */
export function unparse(expr: Expr): string {
  return ctx.expr(expr);
}

// ---------------------------------------------------------------- statements and sections

class Writer {
  readonly lines: string[] = [];
  readonly map: LineMap = {};

  blank(count: number): void {
    for (let i = 0; i < count; i += 1) this.lines.push("");
  }

  line(text: string, indent: number): void {
    this.lines.push(text === "" ? "" : INDENT.repeat(indent) + text);
  }

  mark(id: NodeId): void {
    const line = this.lines.length + 1;
    this.map[id] = { start: line, end: line };
  }

  stmt(stmt: Stmt, indent: number): void {
    const pyLines = getNode(keyOf(stmt)).python(stmt, ctx) as PyLine[];
    let first = true;
    for (const pyLine of pyLines) {
      if (typeof pyLine === "string") {
        if (first) {
          this.mark(stmt.id); // E-01: a frame maps to its header; `else:` is unmapped
          first = false;
        }
        this.line(pyLine, indent);
      } else {
        this.block(pyLine.block, indent + 1);
      }
    }
  }

  block(stmts: Stmt[], indent: number): void {
    if (stmts.length === 0) {
      this.line("pass", indent);
      return;
    }
    for (const stmt of stmts) this.stmt(stmt, indent);
  }

  /** N-07 */
  classDef(cls: ClassDef): void {
    this.mark(cls.id);
    this.line(`class ${cls.name}:`, 0);
    const params = cls.fields.map((field) => {
      const container = isEmptyContainer(field.default);
      return `${field.name}=${container ? "None" : dataToPython(field.default)}`;
    });
    this.line(`def __init__(self${params.map((p) => `, ${p}`).join("")}):`, 1);
    if (cls.fields.length === 0) this.line("pass", 2);
    for (const field of cls.fields) {
      const value = isEmptyContainer(field.default)
        ? `${dataToPython(field.default)} if ${field.name} is None else ${field.name}`
        : field.name;
      this.line(`self.${field.name} = ${value}`, 2);
    }
    this.blank(1);
    this.line("def __repr__(self):", 1);
    const fields = cls.fields.map((field) => `${field.name}={self.${field.name}!r}`).join(", ");
    this.line(`return f"${cls.name}(${fields})"`, 2);
  }

  functionDef(fn: FunctionDef): void {
    this.mark(fn.id);
    this.line(`def ${fn.name}(${fn.params.join(", ")}):`, 0);
    this.block(fn.body, 1);
  }
}

function isEmptyContainer(data: Data): boolean {
  if (Array.isArray(data)) return data.length === 0;
  return typeof data === "object" && data !== null && Object.keys(data).length === 0;
}

/** N-05: modules required by the blocks a program uses. */
function importsOf(program: Program): string[] {
  const modules = new Set<string>();
  for (const expr of programExprs(program)) {
    const module = getNode(keyOf(expr)).imports;
    if (module) modules.add(module);
  }
  return [...modules].toSorted();
}

type Section = { kind: "imports" | "class" | "function" | "main"; write: (w: Writer) => void };

/** E-02: one blank line between sections, two around classes and functions. */
export function emit(program: Program): Emitted {
  const writer = new Writer();
  const sections: Section[] = [];

  const imports = importsOf(program);
  if (imports.length > 0) {
    sections.push({
      kind: "imports",
      write: (w) => {
        for (const module of imports) w.line(`import ${module}`, 0);
      },
    });
  }
  for (const cls of program.classes)
    sections.push({ kind: "class", write: (w) => w.classDef(cls) });
  for (const fn of program.functions) {
    sections.push({ kind: "function", write: (w) => w.functionDef(fn) });
  }
  if (program.inputs.length > 0 || program.main.length > 0) {
    sections.push({
      kind: "main",
      write: (w) => {
        for (const input of program.inputs)
          w.line(`${input.name} = ${dataToPython(input.value)}`, 0);
        for (const stmt of program.main) w.stmt(stmt, 0);
      },
    });
  }

  sections.forEach((section, i) => {
    const previous = sections[i - 1];
    if (previous) {
      const around = (kind: Section["kind"]) => kind === "class" || kind === "function";
      writer.blank(around(previous.kind) || around(section.kind) ? 2 : 1);
    }
    section.write(writer);
  });

  return { code: `${writer.lines.join("\n")}\n`, map: writer.map };
}
