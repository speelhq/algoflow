import { describe, expect, it } from "vitest";
import type { Expr } from "@/lang/types";
import { BLOCK_DEFS, keyOf } from "@/blocks/registry";
import { mulberry32 } from "@/runtime/random";
import { unparse } from "./emit";
import {
  endsInText,
  isParseError,
  parse,
  parseArgs,
  parseClosed,
  readBefore,
  type ParseError,
} from "./parse";
import { BINOPS } from "./precedence";

function ok(text: string): Expr {
  const result = parse(text);
  if (isParseError(result))
    throw new Error(`unexpected error ${JSON.stringify(result)} for ${text}`);
  return result;
}

function err(text: string): ParseError {
  const result = parse(text);
  if (!isParseError(result))
    throw new Error(`expected an error for ${text}, got ${unparse(result)}`);
  return result;
}

describe("parse", () => {
  it("parses literals with raw number text and decoded strings", () => {
    expect(ok("1e3")).toMatchObject({ type: "num", value: 1000, float: true, raw: "1e3" });
    expect(ok("42")).toMatchObject({ type: "num", value: 42, float: false, raw: "42" });
    expect(ok(".5")).toMatchObject({ type: "num", value: 0.5, float: true });
    expect(ok("'a\\nb'")).toMatchObject({ type: "str", value: "a\nb" });
    expect(ok('"say \\"hi\\""')).toMatchObject({ type: "str", value: 'say "hi"' });
    expect(ok("True")).toMatchObject({ type: "bool", value: true });
    expect(ok("None")).toMatchObject({ type: "none" });
    expect(ok("total")).toMatchObject({ type: "var", name: "total" });
  });

  it("builds the grammar's precedence levels", () => {
    expect(ok("a or b and not c == d + e * -f ** 2")).toMatchObject({
      type: "binop",
      op: "or",
      right: {
        op: "and",
        right: {
          type: "unop",
          op: "not",
          operand: {
            op: "==",
            right: {
              op: "+",
              right: { op: "*", right: { type: "unop", op: "neg", operand: { op: "**" } } },
            },
          },
        },
      },
    });
    expect(ok("a ** b ** c")).toMatchObject({ op: "**", right: { op: "**" } });
    expect(ok("a - b - c")).toMatchObject({ op: "-", left: { op: "-" } });
    expect(ok("(a + b) * c")).toMatchObject({ op: "*", left: { op: "+" } });
  });

  it("reports grammar forms whose block is not registered yet as E_PARSE_SYNTAX at their token", () => {
    // field and dict have no registered block definition, so the registry says no.
    expect(err("p.x")).toEqual({ code: "E_PARSE_SYNTAX", position: 2 });
    expect(err("1 + {}")).toEqual({ code: "E_PARSE_SYNTAX", position: 4 });
  });

  it("rejects number text CPython rejects and decodes \\x escapes", () => {
    expect(err("0777")).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
    expect(err("1 + 007")).toEqual({ code: "E_PARSE_SYNTAX", position: 4 });
    expect(ok("00")).toMatchObject({ type: "num", value: 0, raw: "00" });
    expect(ok("0.5")).toMatchObject({ type: "num", value: 0.5 });
    expect(ok('"a\\x41\\x01"')).toMatchObject({ type: "str", value: "aA" });
  });

  it("an int literal outside the int range is a syntax error at its token", () => {
    expect(ok("9007199254740991")).toMatchObject({ type: "num", value: 2 ** 53 - 1, float: false });
    expect(err("1 + 9007199254740992")).toEqual({ code: "E_PARSE_SYNTAX", position: 4 });
    expect(err("-9007199254740992")).toEqual({ code: "E_PARSE_SYNTAX", position: 1 });
    expect(ok("9007199254740993.0")).toMatchObject({ type: "num", float: true });
  });

  it("gives every block an id and no mark of how it was made", () => {
    const expr = ok("a + b");
    expect(expr.id).toHaveLength(12);
    expect(Object.keys(expr).toSorted()).toEqual(["id", "left", "op", "right", "type"]);
  });
});

describe("call resolution", () => {
  it("reads a name that names a builtin as the builtin's call", () => {
    expect(ok("abs(x)")).toMatchObject({ type: "call", fn: "abs" });
    expect(keyOf(ok("abs(x)"))).toBe("call:abs");
  });

  it("reads any other name as a call of the program's function, whatever the program defines", () => {
    expect(ok("fib(n)")).toMatchObject({ type: "call", fn: "fib", args: [{ name: "n" }] });
    expect(keyOf(ok("nope(1)"))).toBe("call");
    expect(ok("1 + nope (1)")).toMatchObject({ right: { type: "call", fn: "nope" } });
  });

  it("reads a class name as a new, which gives E_PARSE_SYNTAX at the name while none is registered", () => {
    expect(err("Node(1)")).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
    // The name's token, whatever stands between it and the parenthesis.
    expect(err("1 + Node (1)")).toEqual({ code: "E_PARSE_SYNTAX", position: 4 });
    expect(err("A()")).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
  });

  it("accepts the Python aliases of builtins", () => {
    expect(ok("random.randint(1, 6)")).toMatchObject({ type: "call", fn: "randint" });
    expect(unparse(ok("random.randint(1, 6)"))).toBe("random.randint(1, 6)");
  });

  it("an unknown method → E_UNKNOWN_CALL at the method name", () => {
    expect(err("xs.frobnicate(1)")).toEqual({
      code: "E_UNKNOWN_CALL",
      position: 3,
      params: { name: "frobnicate" },
    });
  });

  it("calling a non-name is a syntax error", () => {
    expect(err("(a + b)(1)")).toMatchObject({ code: "E_PARSE_SYNTAX", position: 7 });
  });
});

describe("parseArgs (parser.md, Grammar)", () => {
  it("reads an exprs slot's text as its values separated by commas, none for no text", () => {
    expect(parseArgs("")).toEqual([]);
    expect(parseArgs("1, x + 2")).toMatchObject([
      { type: "num", value: 1 },
      { type: "binop", op: "+" },
    ]);
    expect(parseArgs("f(a, b)")).toMatchObject([{ type: "call", args: [{}, {}] }]);
  });

  it("gives the parser's error where it stops", () => {
    expect(parseArgs("1,")).toEqual({ code: "E_PARSE_SYNTAX", position: 2 });
    expect(parseArgs("1 2")).toEqual({ code: "E_PARSE_SYNTAX", position: 2 });
    expect(parseArgs("a < b < c")).toEqual({ code: "E_PARSE_CHAIN", position: 6 });
  });
});

describe("errors carry a position", () => {
  it("chained comparison → E_PARSE_CHAIN at the second operator", () => {
    expect(err("a < b < c")).toEqual({ code: "E_PARSE_CHAIN", position: 6 });
    expect(err("1 == 2 == 3")).toEqual({ code: "E_PARSE_CHAIN", position: 7 });
    expect(err("x in xs in ys")).toEqual({ code: "E_PARSE_CHAIN", position: 8 });
  });

  it("other syntax errors → E_PARSE_SYNTAX", () => {
    expect(err("a +")).toEqual({ code: "E_PARSE_SYNTAX", position: 3 });
    expect(err("(a")).toEqual({ code: "E_PARSE_SYNTAX", position: 2 });
    expect(err('"open')).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
    expect(err("a b")).toEqual({ code: "E_PARSE_SYNTAX", position: 2 });
    expect(err("1 +* 2")).toEqual({ code: "E_PARSE_SYNTAX", position: 3 });
    expect(err("@")).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
    expect(err("")).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
    expect(err("not")).toEqual({ code: "E_PARSE_SYNTAX", position: 3 });
    expect(err("xs[")).toEqual({ code: "E_PARSE_SYNTAX", position: 3 });
    expect(err("{1: }")).toEqual({ code: "E_PARSE_SYNTAX", position: 4 });
  });
});

// ---------------------------------------------------------------- property test

const BUILTINS = [...BLOCK_DEFS.values()].filter((def) => def.key.startsWith("call:"));
const NAMES = ["a", "b", "c", "n", "total", "xs"];
const RAWS = ["0", "1", "2", "42", "1.5", "2.0", "1e3", "0.25"];
const STRINGS = ["", "a", "a b", 'say "hi"', "line\n", "tab\t", "back\\slash", "it's"];

function generator(seed: number) {
  const rand = mulberry32(seed);
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(rand() * items.length)];
    if (item === undefined) throw new Error("empty");
    return item;
  };
  let n = 0;
  const id = () => `g${String((n += 1)).padStart(11, "0")}`;
  const gen = (depth: number): Expr => {
    const leaf = depth <= 0 || rand() < 0.3;
    const choice = Math.floor(rand() * (leaf ? 5 : 10));
    switch (choice) {
      case 0: {
        const raw = pick(RAWS);
        return { id: id(), type: "num", value: Number(raw), float: /[.eE]/.test(raw), raw };
      }
      case 1:
        return { id: id(), type: "str", value: pick(STRINGS) };
      case 2:
        return { id: id(), type: "bool", value: rand() < 0.5 };
      case 3:
        return { id: id(), type: "none" };
      case 4:
        return { id: id(), type: "var", name: pick(NAMES) };
      case 5:
        return {
          id: id(),
          type: "binop",
          op: pick(BINOPS),
          left: gen(depth - 1),
          right: gen(depth - 1),
        };
      case 6:
        return {
          id: id(),
          type: "unop",
          op: rand() < 0.5 ? "neg" : "not",
          operand: gen(depth - 1),
        };
      case 7:
        return {
          id: id(),
          type: "list",
          items: Array.from({ length: Math.floor(rand() * 3) }, () => gen(depth - 1)),
        };
      case 8:
        return { id: id(), type: "index", list: gen(depth - 1), index: gen(depth - 1) };
      default: {
        const def = pick(BUILTINS);
        return {
          id: id(),
          type: "call",
          fn: def.key.slice(5),
          args: (def.params ?? []).map(() => gen(depth - 1)),
        };
      }
    }
  };
  return () => gen(4);
}

/** An expression with every block id removed, for comparing structure alone. */
function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "id")
      .map(([key, field]) => [key, withoutIds(field)]),
  );
}

describe("parse(unparse(e)) is e apart from ids", () => {
  it("holds for 1,000 generated expressions, so the text is a fixed point", () => {
    const next = generator(20260903);
    for (let i = 0; i < 1000; i += 1) {
      const expr = next();
      const text = unparse(expr);
      const parsed = parse(text);
      if (isParseError(parsed)) throw new Error(`case ${i}: ${text} → ${JSON.stringify(parsed)}`);
      expect(withoutIds(parsed), `case ${i}: ${text}`).toEqual(withoutIds(expr));
      expect(unparse(parsed), `case ${i}`).toBe(text);
    }
  });
});

describe("readBefore (parser.md, Reading before a caret)", () => {
  type Written = { text: string; start: number };
  type Read = {
    place: string;
    before?: Written;
    atom?: Written;
    operation?: { operation: string; value: string };
  };

  /** The reading with each expression written back as text, so a case reads as typed. */
  function read(text: string): Read {
    const reading = readBefore(text);
    if (reading.place === "text" || reading.place === "none") return reading;
    const written = (spanned: { expr: Expr; start: number }) => ({
      text: unparse(spanned.expr),
      start: spanned.start,
    });
    const operation = reading.operation && {
      operation: unparse(reading.operation.operation),
      value: unparse(reading.operation.value),
    };
    return reading.place === "expected"
      ? { place: reading.place, operation }
      : {
          place: reading.place,
          before: written(reading.before),
          atom: written(reading.atom),
          operation,
        };
  }

  it("reads whether the caret is inside a text", () => {
    expect(read('print("ab')).toEqual({ place: "text" });
    expect(read("x + 'a")).toEqual({ place: "text" });
    expect(read('"a" + "b"').place).toBe("after");
  });

  it("expects a value where the text is empty or ends with an operator or `,`", () => {
    expect(read("").place).toBe("expected");
    expect(read("total + ").place).toBe("expected");
    expect(read("a and ").place).toBe("expected");
    expect(read("not ").place).toBe("expected");
    expect(read("max(a, ").place).toBe("expected");
    expect(read("len(").place).toBe("expected");
    expect(read("nums").place).toBe("after");
    expect(read("x.").place).toBe("none");
  });

  it("reads the operation with an empty slot at the caret where a value is expected", () => {
    // The empty slot is the operation's value, written as Python's `...`.
    expect(read("dp[").operation).toEqual({ operation: "dp[...]", value: "..." });
    expect(read("total + ").operation).toEqual({ operation: "total + ...", value: "..." });
    expect(read("max(a, ").operation).toEqual({ operation: "max(a, ...)", value: "..." });
    expect(read("").operation).toBeUndefined();
  });

  it("reads the largest expression that ends at the caret within the innermost parenthesis or bracket", () => {
    expect(read("i < n")).toMatchObject({ before: { text: "i < n", start: 0 } });
    expect(read("nums  ")).toMatchObject({ before: { text: "nums", start: 0 } });
    expect(read("len(a + b")).toMatchObject({ before: { text: "a + b", start: 4 } });
    expect(read("f(a, b")).toMatchObject({ before: { text: "b", start: 5 } });
    // Inside a parenthesis still open, its value ends at the caret without it.
    expect(read("(a + b")).toMatchObject({ before: { text: "a + b", start: 1 } });
    expect(read("x * (a + b")).toMatchObject({
      before: { text: "a + b", start: 5 },
      atom: { text: "b", start: 9 },
    });
  });

  it("reads the largest expression the text ends with, not the whole text", () => {
    expect(read("a b + c")).toMatchObject({ before: { text: "b + c", start: 2 } });
    expect(read("a = 1")).toMatchObject({ before: { text: "1", start: 4 } });
  });

  it("reads the value just before the caret as the largest that binds as an atom", () => {
    expect(read("i + nums")).toMatchObject({ atom: { text: "nums", start: 4 } });
    expect(read("-x")).toMatchObject({ before: { text: "-x" }, atom: { text: "x", start: 1 } });
    expect(read("a + (b - c)")).toMatchObject({ atom: { text: "b - c", start: 4 } });
    expect(read("2 * nums[0]")).toMatchObject({ atom: { text: "nums[0]", start: 4 } });
    expect(read("1 + len(a)")).toMatchObject({ atom: { text: "len(a)", start: 4 } });
  });

  it("reads the operation whose slot holds the value that ends at the caret", () => {
    expect(read("a + b").operation).toEqual({ operation: "a + b", value: "b" });
    expect(read("len(nums").operation).toEqual({ operation: "len(nums)", value: "nums" });
    expect(read("nums").operation).toBeUndefined();
  });

  it("reads no expression where the text ends with none and expects no value", () => {
    expect(read("a.")).toEqual({ place: "none" });
    expect(read("a =")).toEqual({ place: "none" });
  });
});

describe("the text before a caret, closed and checked for a text", () => {
  it("parses a text with each parenthesis and bracket still open closed", () => {
    const closed = parseClosed("max(nums[i");
    expect(isParseError(closed) ? closed : unparse(closed)).toBe("max(nums[i])");
    expect(parseClosed("a +")).toMatchObject({ code: "E_PARSE_SYNTAX" });
  });

  it("tells whether a text ends inside a text", () => {
    expect(endsInText('x + "ab')).toBe(true);
    expect(endsInText('x + "ab"')).toBe(false);
  });
});
