// G-01..G-05: typed expression text → Expr. No third-party imports (P-01).
import { newId } from "@/lang/id";
import type { BinOp, Expr, Id } from "@/lang/types";
import { NODES, hasNode } from "@/nodes";

export type ParseScope = { classes: Id[]; functions: Id[] };
export type ParseError = {
  code: "E_PARSE_SYNTAX" | "E_PARSE_CHAIN" | "E_UNKNOWN_CALL";
  position: number;
  params?: Record<string, string>;
};

export function isParseError(result: Expr | ParseError): result is ParseError {
  return "code" in result;
}

// ---------------------------------------------------------------- tokens

type Token = {
  type: "num" | "str" | "name" | "op" | "end";
  text: string;
  value: string;
  pos: number;
};

const NUMBER = /^(?:\d+\.\d*(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+|\.\d+(?:[eE][+-]?\d+)?|\d+)/;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*/;
const OPS2 = ["**", "//", "==", "!=", "<=", ">="];
const OPS1 = "+-*/%<>()[]{},:.";
const KEYWORDS = new Set(["and", "or", "not", "in", "True", "False", "None"]);
const COMPARISONS = new Set(["==", "!=", "<", "<=", ">", ">=", "in"]);
const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  "\\": "\\",
  '"': '"',
  "'": "'",
};

class Fail {
  constructor(readonly error: ParseError) {}
}

function fail(code: ParseError["code"], position: number, params?: Record<string, string>): never {
  throw new Fail(params ? { code, position, params } : { code, position });
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < text.length) {
    const ch = text[pos] ?? "";
    if (/\s/.test(ch)) {
      pos += 1;
      continue;
    }
    const rest = text.slice(pos);
    const num = NUMBER.exec(rest);
    if (num) {
      tokens.push({ type: "num", text: num[0], value: num[0], pos });
      pos += num[0].length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let value = "";
      let i = pos + 1;
      while (i < text.length && text[i] !== ch) {
        if (text[i] === "\\") {
          const next = text[i + 1] ?? "";
          value += ESCAPES[next] ?? `\\${next}`;
          i += 2;
        } else {
          value += text[i];
          i += 1;
        }
      }
      if (i >= text.length) fail("E_PARSE_SYNTAX", pos);
      tokens.push({ type: "str", text: text.slice(pos, i + 1), value, pos });
      pos = i + 1;
      continue;
    }
    const name = NAME.exec(rest);
    if (name) {
      tokens.push({ type: "name", text: name[0], value: name[0], pos });
      pos += name[0].length;
      continue;
    }
    const op2 = OPS2.find((op) => rest.startsWith(op));
    if (op2) {
      tokens.push({ type: "op", text: op2, value: op2, pos });
      pos += 2;
      continue;
    }
    if (OPS1.includes(ch)) {
      tokens.push({ type: "op", text: ch, value: ch, pos });
      pos += 1;
      continue;
    }
    fail("E_PARSE_SYNTAX", pos);
  }
  tokens.push({ type: "end", text: "", value: "", pos: text.length });
  return tokens;
}

// ---------------------------------------------------------------- aliases (G-02)

function aliasTable(): Map<string, string> {
  const table = new Map<string, string>();
  for (const def of NODES.values()) {
    if (!def.key.startsWith("call:")) continue;
    for (const alias of def.aliases ?? []) table.set(alias, def.key.slice("call:".length));
  }
  return table;
}

// ---------------------------------------------------------------- parser

class Parser {
  private i = 0;
  private readonly aliases = aliasTable();

  constructor(
    private readonly tokens: Token[],
    private readonly scope: ParseScope,
  ) {}

  private peek(): Token {
    return this.tokens[this.i] ?? { type: "end", text: "", value: "", pos: 0 };
  }

  private take(): Token {
    const token = this.peek();
    this.i += 1;
    return token;
  }

  private isOp(text: string): boolean {
    const token = this.peek();
    return token.type === "op" && token.text === text;
  }

  private isWord(text: string): boolean {
    const token = this.peek();
    return token.type === "name" && token.text === text;
  }

  private expectOp(text: string): void {
    if (!this.isOp(text)) fail("E_PARSE_SYNTAX", this.peek().pos);
    this.i += 1;
  }

  parseAll(): Expr {
    const expr = this.or();
    if (this.peek().type !== "end") fail("E_PARSE_SYNTAX", this.peek().pos);
    return { ...expr, source: "text" };
  }

  private binary(next: () => Expr, ops: string[]): Expr {
    let left = next();
    while (ops.some((op) => this.isOp(op) || (KEYWORDS.has(op) && this.isWord(op)))) {
      const op = this.take().text as BinOp;
      const right = next();
      left = { id: newId(), kind: "binop", op, left, right };
    }
    return left;
  }

  private or(): Expr {
    return this.binary(() => this.and(), ["or"]);
  }

  private and(): Expr {
    return this.binary(() => this.not(), ["and"]);
  }

  private not(): Expr {
    if (this.isWord("not")) {
      this.take();
      return { id: newId(), kind: "unop", op: "not", operand: this.not() };
    }
    return this.cmp();
  }

  private isComparison(): boolean {
    const token = this.peek();
    return (token.type === "op" || token.type === "name") && COMPARISONS.has(token.text);
  }

  private cmp(): Expr {
    const left = this.arith();
    if (!this.isComparison()) return left;
    const op = this.take().text as BinOp;
    const right = this.arith();
    if (this.isComparison()) fail("E_PARSE_CHAIN", this.peek().pos); // G-04
    return { id: newId(), kind: "binop", op, left, right };
  }

  private arith(): Expr {
    return this.binary(() => this.term(), ["+", "-"]);
  }

  private term(): Expr {
    return this.binary(() => this.factor(), ["*", "/", "//", "%"]);
  }

  private factor(): Expr {
    if (this.isOp("-")) {
      this.take();
      return { id: newId(), kind: "unop", op: "neg", operand: this.factor() };
    }
    return this.power();
  }

  private power(): Expr {
    const base = this.postfix();
    if (this.isOp("**")) {
      this.take();
      return { id: newId(), kind: "binop", op: "**", left: base, right: this.factor() };
    }
    return base;
  }

  private args(close: string): Expr[] {
    const items: Expr[] = [];
    if (this.isOp(close)) {
      this.take();
      return items;
    }
    for (;;) {
      items.push(this.or());
      if (this.isOp(",")) {
        this.take();
        continue;
      }
      this.expectOp(close);
      return items;
    }
  }

  private postfix(): Expr {
    let expr = this.atom();
    for (;;) {
      if (this.isOp("[")) {
        this.take();
        const index = this.or();
        this.expectOp("]");
        expr = { id: newId(), kind: "index", list: expr, index };
      } else if (this.isOp(".")) {
        this.take();
        const name = this.take();
        if (name.type !== "name") fail("E_PARSE_SYNTAX", name.pos);
        if (this.isOp("(")) {
          this.take();
          const args = this.args(")");
          expr = this.resolveMethod(expr, name, args);
        } else {
          expr = { id: newId(), kind: "field", obj: expr, field: name.text };
        }
      } else if (this.isOp("(")) {
        const open = this.take();
        if (expr.kind !== "var") fail("E_PARSE_SYNTAX", open.pos);
        const args = this.args(")");
        expr = this.resolveCall(expr.name, open.pos - expr.name.length, args);
      } else {
        return expr;
      }
    }
  }

  /** G-02 */
  private resolveCall(name: string, position: number, args: Expr[]): Expr {
    if (this.scope.classes.includes(name)) return { id: newId(), kind: "new", cls: name, args };
    if (hasNode(`call:${name}`)) return { id: newId(), kind: "call", fn: name, args };
    if (this.scope.functions.includes(name)) return { id: newId(), kind: "call", fn: name, args };
    return fail("E_UNKNOWN_CALL", position, { name });
  }

  /** G-02 aliases and G-03 */
  private resolveMethod(obj: Expr, name: Token, args: Expr[]): Expr {
    if (obj.kind === "var") {
      const fn = this.aliases.get(`${obj.name}.${name.text}`);
      if (fn) return { id: newId(), kind: "call", fn, args };
    }
    if (hasNode(`method:${name.text}`))
      return { id: newId(), kind: "method", obj, name: name.text, args };
    return fail("E_UNKNOWN_CALL", name.pos, { name: name.text });
  }

  private atom(): Expr {
    const token = this.take();
    switch (token.type) {
      case "num":
        return {
          id: newId(),
          kind: "num",
          value: Number(token.text),
          float: /[.eE]/.test(token.text),
          raw: token.text,
        };
      case "str":
        return { id: newId(), kind: "str", value: token.value };
      case "name":
        if (token.text === "True" || token.text === "False") {
          return { id: newId(), kind: "bool", value: token.text === "True" };
        }
        if (token.text === "None") return { id: newId(), kind: "none" };
        if (KEYWORDS.has(token.text)) return fail("E_PARSE_SYNTAX", token.pos);
        return { id: newId(), kind: "var", name: token.text };
      case "op":
        if (token.text === "(") {
          const inner = this.or();
          this.expectOp(")");
          return inner;
        }
        if (token.text === "[") return { id: newId(), kind: "list", items: this.args("]") };
        if (token.text === "{") return this.dict();
        return fail("E_PARSE_SYNTAX", token.pos);
      case "end":
        return fail("E_PARSE_SYNTAX", token.pos);
    }
  }

  private dict(): Expr {
    const entries: Array<{ key: Expr; value: Expr }> = [];
    if (this.isOp("}")) {
      this.take();
      return { id: newId(), kind: "dict", entries };
    }
    for (;;) {
      const key = this.or();
      this.expectOp(":");
      const value = this.or();
      entries.push({ key, value });
      if (this.isOp(",")) {
        this.take();
        continue;
      }
      this.expectOp("}");
      return { id: newId(), kind: "dict", entries };
    }
  }
}

export function parse(
  text: string,
  scope: ParseScope = { classes: [], functions: [] },
): Expr | ParseError {
  try {
    return new Parser(tokenize(text), scope).parseAll();
  } catch (error) {
    if (error instanceof Fail) return error.error;
    throw error;
  }
}
