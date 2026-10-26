// Program → Python text plus the NodeId → line map. No third-party imports.
import type { Data, Expr, FunctionDef, Name, NodeId, Program, Stmt } from "@/lang/types";
import { dataKey, floatOf, inputValue, isFloatData } from "@/lang/data";
import { programExprs } from "@/lang/walk";
import { getBlockDef, keyOf } from "@/blocks/registry";
import type { EmitContext, PyLine, Side } from "@/blocks/types";
import { floatRepr } from "@/runtime/values";
import { PRECEDENCE, needsParens } from "./precedence";
import { pyString } from "./strings";

export type LineMap = Record<NodeId, { start: number; end: number }>;
export type Emitted = { code: string; map: LineMap };

const INDENT = "    ";

/** A Data value as a Python literal. */
export function dataToPython(data: Data): string {
  if (typeof data === "number") return Number.isInteger(data) ? String(data) : floatRepr(data);
  if (typeof data === "string") return pyString(data);
  if (typeof data === "boolean") return data ? "True" : "False";
  if (data === null) return "None";
  if (Array.isArray(data)) return `[${data.map(dataToPython).join(", ")}]`;
  if (isFloatData(data)) return floatRepr(floatOf(data));
  const entries = Object.entries(data).map(([key, value]) => {
    const stands = dataKey(key);
    return `${typeof stands === "number" ? String(stands) : pyString(stands)}: ${dataToPython(value)}`;
  });
  return `{${entries.join(", ")}}`;
}

// ---------------------------------------------------------------- expression context

/** `text`, the text of `child`, in parentheses where the operator table needs them under `parent`. */
function parenthesize(child: Expr, text: string, parent: number, side: Side): string {
  const own = getBlockDef(keyOf(child)).precedence?.(child) ?? PRECEDENCE.atom;
  return needsParens(own, parent, side) ? `(${text})` : text;
}

const ctx: EmitContext = {
  expr(expr: Expr) {
    return getBlockDef(keyOf(expr)).python(expr, ctx) as string;
  },
  operand(expr: Expr, parent: number, side) {
    return parenthesize(expr, ctx.expr(expr), parent, side);
  },
  slot(node, name) {
    const expr = (node as unknown as Record<string, Expr>)[name];
    if (!expr) throw new Error(`no expression in slot ${name}`);
    const atom = getBlockDef(keyOf(node)).slots.find((slot) => slot.name === name)?.atom;
    return atom ? ctx.operand(expr, PRECEDENCE.atom, "left") : ctx.expr(expr);
  },
  region(stmts: Stmt[]): PyLine {
    return { region: stmts };
  },
};

/** The emitter's expression function. */
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
    const pyLines = getBlockDef(keyOf(stmt)).python(stmt, ctx) as PyLine[];
    // A named statement's lines start at the comment holding its name.
    const named = stmt.name === undefined ? undefined : this.lines.length + 1;
    if (stmt.name !== undefined) this.line(`# ${stmt.name}`, indent);
    let first = true;
    for (const pyLine of pyLines) {
      if (typeof pyLine === "string") {
        if (first) {
          this.mark(stmt.id); // A compound statement maps to its header; `else:` is unmapped
          if (named !== undefined) this.map[stmt.id] = { start: named, end: named + 1 };
          first = false;
        }
        this.line(pyLine, indent);
      } else {
        this.region(pyLine.region, indent + 1);
      }
    }
  }

  region(stmts: Stmt[], indent: number): void {
    if (stmts.length === 0) {
      this.line("pass", indent);
      return;
    }
    for (const stmt of stmts) this.stmt(stmt, indent);
  }

  functionDef(fn: FunctionDef): void {
    this.mark(fn.id);
    this.line(`def ${fn.name}(${fn.params.join(", ")}):`, 0);
    this.region(fn.body, 1);
  }
}

/** Modules required by the blocks a program uses. */
function importsOf(program: Program): string[] {
  const modules = new Set<string>();
  for (const expr of programExprs(program)) {
    const module = getBlockDef(keyOf(expr)).imports;
    if (module) modules.add(module);
  }
  return [...modules].toSorted();
}

type Section = { kind: "imports" | "function" | "main"; write: (w: Writer) => void };

/** One blank line between sections, two around functions; `inputs` values the inputs. */
export function emit(program: Program, inputs: Readonly<Record<Name, Data>>): Emitted {
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
  for (const fn of program.functions) {
    sections.push({ kind: "function", write: (w) => w.functionDef(fn) });
  }
  if (program.inputs.length > 0 || program.main.length > 0) {
    sections.push({
      kind: "main",
      write: (w) => {
        for (const input of program.inputs) {
          w.line(`${input.name} = ${dataToPython(inputValue(inputs, input.name))}`, 0);
        }
        for (const stmt of program.main) w.stmt(stmt, 0);
      },
    });
  }

  sections.forEach((section, i) => {
    const previous = sections[i - 1];
    if (previous) {
      const around = previous.kind === "function" || section.kind === "function";
      writer.blank(around ? 2 : 1);
    }
    section.write(writer);
  });

  return { code: `${writer.lines.join("\n")}\n`, map: writer.map };
}
