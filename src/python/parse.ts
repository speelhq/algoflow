// Typed expression text → Expr. No third-party imports.
import { newId } from "@/lang/id";
import { CLASS_NAME_PATTERN, type BinOp, type Data, type Expr, type NodeId } from "@/lang/types";
import { allExprs, childSlots, isEmptyExpr } from "@/lang/walk";
import {
  builtinKey,
  builtinOf,
  methodKey,
  BLOCK_DEFS,
  getBlockDef,
  hasBlockDef,
  keyOf,
} from "@/blocks/registry";
import { dataToPython } from "./emit";
import { NUMBER, numberLiteral } from "./number";
import { BINOPS, PRECEDENCE, binopsAt, isBinOp } from "./precedence";

export const PARSE_CODES = ["E_PARSE_SYNTAX", "E_PARSE_CHAIN", "E_UNKNOWN_CALL"] as const;
export type ParseError = {
  code: (typeof PARSE_CODES)[number];
  position: number;
  params?: Record<string, string>;
};

export function isParseError(result: Expr | Expr[] | ParseError): result is ParseError {
  return "code" in result;
}

// ---------------------------------------------------------------- tokens

/**
 * A token of the text. `other` is a character no token starts with, which `parse` rejects and the
 * reading before a caret keeps, so it reads the text after it; `hole` is the empty slot that the
 * reading puts at the caret.
 */
type Token = {
  type: "num" | "str" | "name" | "op" | "other" | "hole" | "end";
  text: string;
  value: string;
  pos: number;
};

const NAME = /^[A-Za-z_][A-Za-z0-9_]*/;
const SYMBOL_OPS = BINOPS.filter((op) => !/^[a-z]/.test(op));
const OPS2 = SYMBOL_OPS.filter((op) => op.length === 2);
const OPS1 = `${SYMBOL_OPS.filter((op) => op.length === 1).join("")}()[]{},:.`;
const WORD_OPS = new Set(BINOPS.filter((op) => /^[a-z]/.test(op)));
const KEYWORDS = new Set([...WORD_OPS, "not", "True", "False", "None"]);
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

/** The text's tokens, and where a `"` or `'` that no matching quote closes opens, if one does. */
function scan(text: string): { tokens: Token[]; unclosed?: number } {
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
      const [raw] = num;
      tokens.push({ type: "num", text: raw, value: raw, pos });
      pos += raw.length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let value = "";
      let i = pos + 1;
      while (i < text.length && text[i] !== ch) {
        if (text[i] === "\\") {
          const next = text[i + 1] ?? "";
          if (next === "x" && /^[0-9a-fA-F]{2}$/.test(text.slice(i + 2, i + 4))) {
            value += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 4), 16));
            i += 4;
            continue;
          }
          value += ESCAPES[next] ?? `\\${next}`;
          i += 2;
        } else {
          value += text[i];
          i += 1;
        }
      }
      if (i >= text.length) return { tokens, unclosed: pos };
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
    tokens.push({ type: "other", text: ch, value: ch, pos });
    pos += 1;
  }
  return { tokens };
}

function tokenize(text: string): Token[] {
  const { tokens, unclosed } = scan(text);
  // The scan stops at an unclosed quote, so a character no token starts with comes before it.
  const other = tokens.find((token) => token.type === "other");
  if (other) fail("E_PARSE_SYNTAX", other.pos);
  if (unclosed !== undefined) fail("E_PARSE_SYNTAX", unclosed);
  return [...tokens, endAt(text.length)];
}

const endAt = (pos: number): Token => ({ type: "end", text: "", value: "", pos });

// ---------------------------------------------------------------- aliases

function aliasTable(): Map<string, string> {
  const table = new Map<string, string>();
  for (const def of BLOCK_DEFS.values()) {
    const name = builtinOf(def.key);
    if (name === undefined) continue;
    for (const alias of def.aliases ?? []) table.set(alias, name);
  }
  return table;
}

// ---------------------------------------------------------------- parser

/** Where an expression's text starts and ends. */
export type Span = { start: number; end: number };

class Parser {
  private i = 0;
  private lastEnd = 0;
  private readonly aliases = aliasTable();
  /** The span of each expression parsed, by its id, without parentheses of its own. */
  readonly spans = new Map<NodeId, Span>();
  /** The span of each expression written in parentheses of its own, the parentheses included. */
  readonly parenthesized = new Map<NodeId, Span>();

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.i] ?? endAt(0);
  }

  private take(): Token {
    const token = this.peek();
    this.i += 1;
    this.lastEnd = token.pos + token.text.length;
    return token;
  }

  /** `expr`, its span recorded from `start` to the end of the last token taken. */
  private mark<T extends Expr>(start: number, expr: T): T {
    this.spans.set(expr.id, { start, end: this.lastEnd });
    return expr;
  }

  private startOf(expr: Expr): number {
    return (this.parenthesized.get(expr.id) ?? this.spans.get(expr.id))?.start ?? 0;
  }

  private isOp(text: string): boolean {
    const token = this.peek();
    return token.type === "op" && token.text === text;
  }

  private isWord(text: string): boolean {
    const token = this.peek();
    return token.type === "name" && token.text === text;
  }

  /** The next token as a binary operator of the given level, if it is one. */
  private binopAt(level: number): BinOp | undefined {
    const token = this.peek();
    if (token.type !== "op" && token.type !== "name") return undefined;
    if (!isBinOp(token.text)) return undefined;
    return binopsAt(level).includes(token.text) ? token.text : undefined;
  }

  private expectOp(text: string): void {
    if (!this.isOp(text)) fail("E_PARSE_SYNTAX", this.peek().pos);
    this.take();
  }

  /** Every block must have a registered block definition; the registry is the arbiter of the language. */
  private block(pos: number, expr: Expr): Expr {
    if (!hasBlockDef(keyOf(expr))) fail("E_PARSE_SYNTAX", pos);
    return expr;
  }

  parseAll(): Expr {
    const expr = this.or();
    if (this.peek().type !== "end") fail("E_PARSE_SYNTAX", this.peek().pos);
    return expr;
  }

  /** The text of an `exprs` slot: its values separated by commas, none for no text. */
  parseArgsAll(): Expr[] {
    const items: Expr[] = [];
    if (this.peek().type === "end") return items;
    for (;;) {
      items.push(this.or());
      if (this.peek().type === "end") return items;
      this.expectOp(",");
    }
  }

  private binary(next: () => Expr, level: number): Expr {
    let left = next();
    for (let op = this.binopAt(level); op !== undefined; op = this.binopAt(level)) {
      const pos = this.take().pos;
      const right = next();
      left = this.block(
        pos,
        this.mark(this.startOf(left), { id: newId(), type: "binop", op, left, right }),
      );
    }
    return left;
  }

  private or(): Expr {
    return this.binary(() => this.and(), PRECEDENCE.or);
  }

  private and(): Expr {
    return this.binary(() => this.not(), PRECEDENCE.and);
  }

  private not(): Expr {
    if (this.isWord("not")) {
      const pos = this.take().pos;
      const operand = this.not();
      return this.block(pos, this.mark(pos, { id: newId(), type: "unop", op: "not", operand }));
    }
    return this.cmp();
  }

  private cmp(): Expr {
    const left = this.arith();
    const op = this.binopAt(PRECEDENCE.compare);
    if (op === undefined) return left;
    const pos = this.take().pos;
    const right = this.arith();
    if (this.binopAt(PRECEDENCE.compare) !== undefined) fail("E_PARSE_CHAIN", this.peek().pos);
    return this.block(
      pos,
      this.mark(this.startOf(left), { id: newId(), type: "binop", op, left, right }),
    );
  }

  private arith(): Expr {
    return this.binary(() => this.term(), PRECEDENCE.additive);
  }

  private term(): Expr {
    return this.binary(() => this.factor(), PRECEDENCE.multiplicative);
  }

  private factor(): Expr {
    if (this.isOp("-")) {
      const pos = this.take().pos;
      const operand = this.factor();
      return this.block(pos, this.mark(pos, { id: newId(), type: "unop", op: "neg", operand }));
    }
    return this.power();
  }

  private power(): Expr {
    const base = this.postfix();
    const op = this.binopAt(PRECEDENCE.power);
    if (op !== undefined) {
      const pos = this.take().pos;
      const right = this.factor();
      return this.block(
        pos,
        this.mark(this.startOf(base), { id: newId(), type: "binop", op, left: base, right }),
      );
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
    // A call is placed at its callee, which starts where the atom does.
    const start = this.peek().pos;
    let expr = this.atom();
    for (;;) {
      if (this.isOp("[")) {
        const pos = this.take().pos;
        const index = this.or();
        this.expectOp("]");
        expr = this.block(pos, this.mark(start, { id: newId(), type: "index", list: expr, index }));
      } else if (this.isOp(".")) {
        this.take();
        const name = this.take();
        if (name.type !== "name") fail("E_PARSE_SYNTAX", name.pos);
        // A field read has no block definition: none constructs an object.
        if (!this.isOp("(")) fail("E_PARSE_SYNTAX", name.pos);
        this.take();
        const args = this.args(")");
        expr = this.mark(start, this.resolveMethod(expr, name, args));
      } else if (this.isOp("(")) {
        const open = this.take();
        if (expr.type !== "var") fail("E_PARSE_SYNTAX", open.pos);
        const args = this.args(")");
        expr = this.mark(start, this.resolveCall(expr.name, start, args));
      } else {
        return expr;
      }
    }
  }

  /**
   * `NAME(...)` by the form of `NAME` alone, whatever the program defines (`parser.md`, Calls), so
   * an edit elsewhere never turns a draft into a value; `validate()` resolves the call.
   */
  private resolveCall(name: string, position: number, args: Expr[]): Expr {
    // A class name is a `new`, which no registered block definition constructs yet, so `Expr`
    // has no `new` to make.
    if (CLASS_NAME_PATTERN.test(name)) return fail("E_PARSE_SYNTAX", position);
    if (hasBlockDef(builtinKey(name))) return { id: newId(), type: "call", fn: name, args };
    return this.block(position, { id: newId(), type: "call", fn: name, args });
  }

  /** Builtin aliases and method calls. */
  private resolveMethod(obj: Expr, name: Token, args: Expr[]): Expr {
    if (obj.type === "var") {
      const fn = this.aliases.get(`${obj.name}.${name.text}`);
      if (fn) return { id: newId(), type: "call", fn, args };
    }
    if (hasBlockDef(methodKey(name.text))) {
      return { id: newId(), type: "method", obj, name: name.text, args };
    }
    return fail("E_UNKNOWN_CALL", name.pos, { name: name.text });
  }

  private atom(): Expr {
    const token = this.peek();
    const made = this.atomAt();
    // A literal and a name are marked here; an operation where it is made.
    if (!this.spans.has(made.id)) this.mark(token.pos, made);
    return made;
  }

  private atomAt(): Expr {
    const token = this.take();
    switch (token.type) {
      case "num": {
        const literal = numberLiteral(token.text);
        if (!literal) return fail("E_PARSE_SYNTAX", token.pos);
        return { id: newId(), type: "num", ...literal, raw: token.text };
      }
      case "str":
        return { id: newId(), type: "str", value: token.value };
      case "name":
        if (token.text === "True" || token.text === "False") {
          return { id: newId(), type: "bool", value: token.text === "True" };
        }
        if (token.text === "None") return { id: newId(), type: "none" };
        if (KEYWORDS.has(token.text)) return fail("E_PARSE_SYNTAX", token.pos);
        return { id: newId(), type: "var", name: token.text };
      case "op":
        if (token.text === "(") {
          const inner = this.or();
          this.expectOp(")");
          this.parenthesized.set(inner.id, { start: token.pos, end: this.lastEnd });
          return inner;
        }
        if (token.text === "[") {
          return this.block(token.pos, { id: newId(), type: "list", items: this.args("]") });
        }
        if (token.text === "{") return this.dict(token.pos);
        return fail("E_PARSE_SYNTAX", token.pos);
      case "hole":
        return { id: newId(), type: "draft", text: "" };
      case "other":
      case "end":
        return fail("E_PARSE_SYNTAX", token.pos);
    }
  }

  private dict(pos: number): Expr {
    const entries: Array<{ key: Expr; value: Expr }> = [];
    if (this.isOp("}")) {
      this.take();
      return this.block(pos, { id: newId(), type: "dict", entries });
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
      return this.block(pos, { id: newId(), type: "dict", entries });
    }
  }
}

function attempt<T>(read: () => T): T | ParseError {
  try {
    return read();
  } catch (error) {
    if (error instanceof Fail) return error.error;
    throw error;
  }
}

export function parse(text: string): Expr | ParseError {
  return attempt(() => new Parser(tokenize(text)).parseAll());
}

/** The text of an `exprs` slot as its values separated by commas (`parser.md`, Grammar). */
export function parseArgs(text: string): Expr[] | ParseError {
  return attempt(() => new Parser(tokenize(text)).parseArgsAll());
}

/** A value as the blocks write it: its Python text parsed, or the error where no block writes it. */
export function parseData(data: Data): Expr | ParseError {
  return parse(dataToPython(data));
}

// ---------------------------------------------------------------- reading before a caret

const CLOSERS: Readonly<Record<string, string>> = { "(": ")", "[": "]", "{": "}" };

/** An expression read before a caret, with its span. */
export type Spanned = Span & { expr: Expr };

/**
 * The operation one of whose slots holds the caret, and that slot's value: the empty slot at the
 * caret where a value is expected, else the value that ends there.
 */
export type CaretOperation = { operation: Expr; value: Expr };

/**
 * What the parser reads in a text that ends at the caret (`parser.md`, Reading before a caret):
 * inside a text, a value expected, after a value, or no expression that ends at the caret. Where
 * an expression ends there, so does a value that binds as an atom, the last part of it.
 */
export type CaretReading =
  | { place: "text" }
  | { place: "expected"; operation?: CaretOperation }
  | { place: "after"; before: Spanned; atom: Spanned; operation?: CaretOperation }
  | { place: "none" };

/** Whether a token leaves a value expected after it: an operator or `,`. */
function expectsValue(token: Token): boolean {
  if (token.type === "op") return isBinOp(token.text) || token.text === ",";
  return token.type === "name" && (isBinOp(token.text) || token.text === "not");
}

/** The parentheses and brackets that `tokens` opens and leaves open, innermost last. */
function stillOpen(tokens: readonly Token[]): Token[] {
  const open: Token[] = [];
  for (const token of tokens) {
    if (token.type !== "op") continue;
    if (CLOSERS[token.text]) open.push(token);
    else if (open.length > 0 && CLOSERS[open.at(-1)?.text ?? ""] === token.text) open.pop();
  }
  return open;
}

/** The closers of the parentheses and brackets that `tokens` leaves open, innermost first. */
function closersOf(tokens: readonly Token[], pos: number): Token[] {
  return stillOpen(tokens)
    .toReversed()
    .map((opener): Token => {
      const text = CLOSERS[opener.text] ?? "";
      return { type: "op", text, value: text, pos };
    });
}

/** Whether a text ends inside a text: after a `"` or `'` that no matching quote closes. */
export function endsInText(text: string): boolean {
  return scan(text).unclosed !== undefined;
}

/** A text parsed with each parenthesis and bracket still open closed. */
export function parseClosed(text: string): Expr | ParseError {
  const { tokens, unclosed } = scan(text);
  if (unclosed !== undefined) return { code: "E_PARSE_SYNTAX", position: unclosed };
  const closers = closersOf(tokens, text.length);
  return attempt(() => new Parser([...tokens, ...closers, endAt(text.length)]).parseAll());
}

/**
 * The largest expression that the tokens end with, with an empty slot at the caret where a value
 * is expected and each parenthesis and bracket still open closed.
 */
function largestRead(
  tokens: readonly Token[],
  caret: number,
  expected: boolean,
): { root: Expr; parser: Parser } | undefined {
  for (let i = 0; i <= tokens.length; i += 1) {
    const suffix = tokens.slice(i);
    if (suffix.length === 0 && !expected) return undefined;
    const hole: Token[] = expected ? [{ type: "hole", text: "", value: "", pos: caret }] : [];
    // A closer the text lacks stands just past the caret, so no expression it ends ends there.
    const closers = closersOf(suffix, caret);
    const parser = new Parser([...suffix, ...hole, ...closers, endAt(caret + 1)]);
    const root = attempt(() => parser.parseAll());
    if (!isParseError(root)) return { root, parser };
  }
  return undefined;
}

/** What the parser reads in a text that ends at the caret (`parser.md`, Reading before a caret). */
export function readBefore(text: string): CaretReading {
  const { tokens, unclosed } = scan(text);
  if (unclosed !== undefined) return { place: "text" };
  // The text of the innermost parenthesis or bracket still open starts after it.
  const innermost = stillOpen(tokens).at(-1);
  const open = innermost ? innermost.pos + 1 : 0;
  const last = tokens.at(-1);
  const expected = last === undefined || last.pos < open || expectsValue(last);
  const read = largestRead(tokens, text.length, expected);
  if (!read) return expected ? { place: "expected" } : { place: "none" };
  const { root, parser } = read;
  const all = [...allExprs(root)];
  const parentOf = (value: Expr): CaretOperation | undefined => {
    const operation = all.find((expr) => childSlots(expr).some((slot) => slot.expr === value));
    return operation && { operation, value };
  };
  if (expected) {
    const hole = all.find(isEmptyExpr);
    const operation = hole && parentOf(hole);
    return operation ? { place: "expected", operation } : { place: "expected" };
  }
  // The expressions that end at the caret, the largest first. One in parentheses of its own ends
  // there with them, and binds as an atom; one inside a parenthesis still open ends there without.
  const end = text.trimEnd().length;
  const ending = all
    .map((expr) => {
      const outer = parser.parenthesized.get(expr.id);
      if (outer?.end === end) return { ...outer, expr, atom: true };
      const span = parser.spans.get(expr.id);
      const atom = getBlockDef(keyOf(expr)).precedence?.(expr) === undefined;
      return span?.end === end ? { ...span, expr, atom } : undefined;
    })
    .filter((spanned) => spanned !== undefined)
    .toSorted((a, b) => a.start - b.start);
  const deepest = ending.at(-1);
  const within = ending.filter((spanned) => spanned.start >= open);
  const spanned = (found: (typeof ending)[number] | undefined): Spanned | undefined =>
    found && { start: found.start, end: found.end, expr: found.expr };
  const before = spanned(within[0]);
  const atom = spanned(within.find((found) => found.atom));
  if (!before || !atom) return { place: "none" };
  const operation = deepest && parentOf(deepest.expr);
  return { place: "after", before, atom, ...(operation ? { operation } : {}) };
}
