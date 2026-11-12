// Every validation code has a failing and a passing case; scope.
import { describe, expect, it } from "vitest";
import { ast, program, runAll } from "@/blocks/testing";
import { isParseError, parse } from "@/python/parse";
import type { Diagnostic, Program, Stmt } from "./types";
import { validate } from "./validate";

const {
  draft,
  assign,
  print,
  num,
  bin,
  v,
  if_,
  for_,
  while_,
  brk,
  cont,
  ret,
  call,
  exprStmt,
  empty,
  bool,
} = ast;

const codes = (p: Program) => validate(p).map((d) => d.code);
const withInput = (main: Stmt[]) => program(main, { inputs: [{ name: "c", kind: "number" }] });

describe("validate (language.md, Validation)", () => {
  it("returns no diagnostics for a well-formed program", () => {
    expect(validate(program([assign("x", num(1)), print(bin("+", v("x"), num(1)))]))).toEqual([]);
  });

  it("E_UNDEFINED: a name that is not visible", () => {
    const stmt = print(v("x"));
    expect(validate(program([stmt]))).toEqual([
      { nodeId: stmt.id, code: "E_UNDEFINED", params: { name: "x" } },
    ]);
    expect(codes(program([assign("x", num(1)), print(v("x"))]))).toEqual([]);
    expect(codes(program([assign("x", bin("+", v("x"), num(1)))]))).toEqual(["E_UNDEFINED"]);
  });

  it("E_DECLARE_FIRST: first assigned inside a compound statement and read after it, with the hoist fix", () => {
    const branch = if_(v("c"), [assign("x", num(1))]);
    const use = print(v("x"));
    expect(validate(withInput([branch, use]))).toEqual([
      {
        nodeId: use.id,
        code: "E_DECLARE_FIRST",
        params: { name: "x", compound: branch.id },
        fix: "hoistAssign",
      },
    ]);
    expect(codes(withInput([assign("x", num(0)), branch, use]))).toEqual([]);
    const loop = for_("i", num(0), num(3), [assign("y", v("i"))]);
    expect(codes(program([loop, print(v("y"))]))).toEqual(["E_DECLARE_FIRST"]);
  });

  it("E_DECLARE_FIRST: a name assigned two compound statements deep points at the outermost one", () => {
    const outer = if_(v("c"), [if_(v("c"), [assign("x", num(1))])]);
    const use = print(v("x"));
    expect(validate(withInput([outer, use]))).toEqual([
      {
        nodeId: use.id,
        code: "E_DECLARE_FIRST",
        params: { name: "x", compound: outer.id },
        fix: "hoistAssign",
      },
    ]);
    const nested = for_("i", num(0), num(2), [if_(v("c"), [assign("z", num(1))]), print(v("z"))]);
    expect(codes(withInput([nested]))).toEqual(["E_DECLARE_FIRST"]);
  });

  it("E_DUPLICATE_NAME: a variable may not shadow a function or a builtin; params are unique", () => {
    const fn = { id: "f0000000000f", name: "count", params: ["a", "a"], body: [] };
    expect(validate(program([assign("count", num(0))], { functions: [fn] }))).toEqual([
      { nodeId: fn.id, code: "E_DUPLICATE_NAME", params: { name: "a" } },
      { nodeId: expect.any(String), code: "E_DUPLICATE_NAME", params: { name: "count" } },
    ]);
    const shadow = { id: "f0000000000g", name: "randint", params: [], body: [] };
    expect(codes(program([], { functions: [shadow] }))).toEqual(["E_DUPLICATE_NAME"]);
    expect(codes(program([for_("randint", num(0), num(1), [])]))).toEqual(["E_DUPLICATE_NAME"]);
  });

  it("a for variable stays visible after its loop; a while body cannot define its condition", () => {
    expect(codes(program([for_("i", num(0), num(3), []), print(v("i"))]))).toEqual([]);
    expect(codes(program([while_(v("k"), [assign("k", num(0))])]))).toEqual(["E_UNDEFINED"]);
  });

  it("functions see only their parameters and body", () => {
    const fn = {
      id: "f0000000000f",
      name: "twice",
      params: ["x"],
      body: [ret(bin("*", v("x"), num(2)))],
    };
    expect(codes(program([assign("g", num(1))], { functions: [fn] }))).toEqual([]);
    const leaky = { ...fn, id: "f0000000000g", name: "leak", body: [ret(v("g"))] };
    expect(codes(program([assign("g", num(1))], { functions: [leaky] }))).toEqual(["E_UNDEFINED"]);
  });

  it("E_BAD_NAME: the name pattern, the reserved words", () => {
    for (const bad of ["Foo", "2x", "for", "len", "my-var"]) {
      expect(codes(program([assign(bad, num(1))])), bad).toContain("E_BAD_NAME");
      expect(codes(program([for_(bad, num(0), num(1), [])])), bad).toContain("E_BAD_NAME");
    }
    expect(codes(program([assign("total_2", num(1))]))).toEqual([]);
    const fn = { id: "f0000000000f", name: "Twice", params: [], body: [] };
    const p = program([], { functions: [fn] });
    expect(validate(p)).toEqual([{ nodeId: fn.id, code: "E_BAD_NAME", params: { name: "Twice" } }]);
    // Validation is memoized per Program object (edits are pure): validate a new object.
    expect(validate({ ...p, functions: [{ ...fn, name: "twice" }] })).toEqual([]);
  });

  it("E_DUPLICATE_NAME: functions and inputs share one namespace", () => {
    const a = { id: "f0000000000a", name: "f", params: [], body: [] };
    const b = { id: "f0000000000b", name: "f", params: [], body: [] };
    expect(validate(program([], { functions: [a, b] }))).toEqual([
      { nodeId: b.id, code: "E_DUPLICATE_NAME", params: { name: "f" } },
    ]);
    expect(
      codes(
        program([], { functions: [{ ...a, name: "n" }], inputs: [{ name: "n", kind: "number" }] }),
      ),
    ).toEqual(["E_DUPLICATE_NAME"]);
    expect(codes(program([], { functions: [a, { ...b, name: "g" }] }))).toEqual([]);
  });

  it("E_BREAK_OUTSIDE: break or continue outside a loop", () => {
    const stray = brk();
    expect(validate(program([stray]))).toEqual([
      { nodeId: stray.id, code: "E_BREAK_OUTSIDE", params: {} },
    ]);
    expect(codes(withInput([if_(v("c"), [cont()])]))).toEqual(["E_BREAK_OUTSIDE"]);
    expect(codes(withInput([for_("i", num(0), num(3), [if_(v("c"), [brk()]), cont()])]))).toEqual(
      [],
    );
  });

  it("E_RETURN_OUTSIDE: return in main", () => {
    const stray = ret(num(1));
    expect(validate(program([stray]))).toEqual([
      { nodeId: stray.id, code: "E_RETURN_OUTSIDE", params: {} },
    ]);
    expect(
      codes(
        program([], { functions: [{ id: "f0000000000f", name: "f", params: [], body: [ret()] }] }),
      ),
    ).toEqual([]);
  });

  it("E_ARITY: builtins and user functions", () => {
    const stmt = assign("m", call("min", num(1)));
    expect(validate(program([stmt]))).toEqual([
      { nodeId: stmt.id, code: "E_ARITY", params: { name: "min", expected: 2, got: 1 } },
    ]);
    const fn = { id: "f0000000000f", name: "f", params: ["a", "b"], body: [] };
    expect(codes(program([exprStmt(call("f", num(1)))], { functions: [fn] }))).toEqual(["E_ARITY"]);
    expect(codes(program([exprStmt(call("f", num(1), num(2)))], { functions: [fn] }))).toEqual([]);
    // A builtin with no argument fails once, by its parameters, as one with too few does.
    expect(codes(program([exprStmt(call("abs"))]))).toEqual(["E_ARITY"]);
  });

  it("E_UNKNOWN_CALL: unknown function", () => {
    const stmt = exprStmt(call("nope", num(1)));
    expect(validate(program([stmt]))).toEqual([
      { nodeId: stmt.id, code: "E_UNKNOWN_CALL", params: { name: "nope" } },
    ]);
    expect(codes(program([exprStmt(call("abs", num(1)))]))).toEqual([]);
    const fn = { id: "f0000000000f", name: "f", params: [], body: [] };
    expect(codes(program([exprStmt(call("f"))], { functions: [fn] }))).toEqual([]);
  });

  it("E_UNKNOWN_CALL: a parsed call of a name the program doesn't define", () => {
    const parsed = parse("nope(1)");
    if (isParseError(parsed)) throw new Error("nope(1) parses");
    expect(codes(program([exprStmt(parsed)]))).toEqual(["E_UNKNOWN_CALL"]);
  });

  it("E_EMPTY_SLOT: a draft with no text, at the draft, naming the slot", () => {
    const hole = empty();
    expect(validate(program([assign("x", hole)]))).toEqual([
      { nodeId: hole.id, code: "E_EMPTY_SLOT", params: { slot: "value" } },
    ]);
    expect(validate(program([if_(empty(), [])]))[0]).toMatchObject({
      code: "E_EMPTY_SLOT",
      params: { slot: "cond" },
    });
    expect(validate(program([ast.forTo(empty(), num(0), num(1), [])]))[0]).toMatchObject({
      code: "E_EMPTY_SLOT",
      params: { slot: "var" },
    });
    const unset = empty();
    expect(validate(program([ast.assignTo(unset, num(1))]))).toEqual([
      { nodeId: unset.id, code: "E_EMPTY_SLOT", params: { slot: "target" } },
    ]);
    expect(validate(program([print(num(1), empty())]))).toEqual([
      expect.objectContaining({ code: "E_EMPTY_SLOT", params: { slot: "args" } }),
    ]);
    expect(codes(program([assign("x", bin("+", num(1), num(2))), print()]))).toEqual([]);
  });

  it("a draft whose text doesn't parse: the parser's error at the draft, with its position", () => {
    const typed = draft("1 +");
    expect(validate(program([assign("x", typed)]))).toEqual([
      { nodeId: typed.id, code: "E_PARSE_SYNTAX", params: { position: 3 } },
    ]);
    const chained = draft("a < b < c");
    expect(validate(program([if_(chained, [])]))).toEqual([
      { nodeId: chained.id, code: "E_PARSE_CHAIN", params: { position: 6 } },
    ]);
    const method = draft("xs.frobnicate()");
    expect(validate(program([exprStmt(method)]))).toEqual([
      {
        nodeId: method.id,
        code: "E_UNKNOWN_CALL",
        params: { name: "frobnicate", position: 3 },
      },
    ]);
    // An `exprs` slot's text is its values separated by commas.
    const values = draft("1, (");
    expect(validate(program([print(values)]))).toEqual([
      { nodeId: values.id, code: "E_PARSE_SYNTAX", params: { position: 4 } },
    ]);
  });

  it("E_NOT_TARGET: a draft in a target slot whose text parses", () => {
    const sum = draft("a + 1");
    expect(validate(program([ast.assignTo(sum, num(2))]))).toEqual([
      { nodeId: sum.id, code: "E_NOT_TARGET", params: {} },
    ]);
  });

  it("a bound variable is declared, not read; an item's list and position are read", () => {
    expect(codes(program([assign("x", num(1))]))).toEqual([]);
    const item = ast.assignTo(ast.item(v("xs"), v("i")), num(1));
    expect(validate(program([item]))).toEqual([
      { nodeId: item.id, code: "E_UNDEFINED", params: { name: "xs" } },
      { nodeId: item.id, code: "E_UNDEFINED", params: { name: "i" } },
    ]);
  });

  it("a target of a slot that does not bind reads its variable (swap)", () => {
    const stmt = ast.swap(v("x"), v("y"));
    expect(validate(program([assign("y", num(1)), stmt]))).toEqual([
      { nodeId: stmt.id, code: "E_UNDEFINED", params: { name: "x" } },
    ]);
  });

  it("E_DUPLICATE_ID: the second occurrence of an id is reported", () => {
    const a = assign("x", num(1));
    const b = { ...assign("y", num(2)), id: a.id };
    expect(validate(program([a, b]))).toEqual([
      { nodeId: a.id, code: "E_DUPLICATE_ID", params: {} },
    ]);
  });

  it("reports several problems in traversal order", () => {
    const p = program([print(v("x")), brk(), assign("2bad", bool(true))]);
    const result: Diagnostic[] = validate(p);
    expect(result.map((d) => d.code)).toEqual(["E_UNDEFINED", "E_BREAK_OUTSIDE", "E_BAD_NAME"]);
  });

  it("a statement's caption changes neither validation nor execution", () => {
    const steps = [assign("x", num(1)), print(v("x")), print(v("y"))];
    const captioned = steps.map((stmt) => ({ ...stmt, caption: "a step" }));
    expect(validate(program(captioned))).toEqual(validate(program(steps)));
    expect(validate(program(steps))).not.toEqual([]);
    const runs = (stmts: Stmt[]) => runAll(program(stmts.slice(0, 2)));
    expect(runs(captioned).events).toEqual(runs(steps).events);
    expect(runs(captioned).stdout).toEqual(["1"]);
  });
});
