// Import validates and migrates by version; it refuses a field its block would not make,
// a class, and an object input.
import { describe, expect, it } from "vitest";
import { ast } from "@/blocks/testing";
import { MigrateError, migrate } from "./migrate";

const { assign, print, num, float, str, bool, not, bin, v, for_, ret, program } = ast;

function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

/** A value as stored JSON, its fields open to a test's own. */
function asStored(value: unknown): Record<string, unknown> {
  return json(value) as Record<string, unknown>;
}

/** A program that assigns `value` to `x`, as stored JSON. */
function assignmentJson(value: unknown): unknown {
  return json(program([assign("x", value as never)]));
}

describe("migrate", () => {
  it("accepts a version 1 program unchanged", () => {
    const p = program(
      [assign("x", num(1)), for_("i", num(0), num(3), [print(bin("+", v("x"), v("i")))])],
      {
        inputs: [{ name: "n", kind: "list" }],
        functions: [{ id: "f0000000000f", name: "f", params: ["a"], body: [print(v("a"))] }],
      },
    );
    expect(migrate(json(p))).toEqual(p);
  });

  it("rejects an input that is not a name with a known kind", () => {
    const valued = { ...program([]), inputs: [{ name: "n", value: [1, 2] }] };
    expect(() => migrate(valued)).toThrow(/^inputs\[0\]: expected \{ name, kind \}/);
    const unknown = { ...program([]), inputs: [{ name: "n", kind: "word" }] };
    expect(() => migrate(unknown)).toThrow(
      "inputs[0]: expected { name, kind }, a kind of number, text, truefalse, none, list, dict",
    );
    expect(() => migrate({ ...program([]), inputs: [{ kind: "list" }] })).toThrow(
      /^inputs\[0\]: expected \{ name, kind \}/,
    );
  });

  it("refuses an expression of a type no registered block definition has, at its path", () => {
    const keyed = asStored(program([assign("x", num(1))]));
    const stmt = (keyed.main as Array<Record<string, unknown>>)[0]!;
    stmt.value = { id: "k0000000000k", type: "key", dict: v("d"), key: str("a") };
    expect(() => migrate(keyed)).toThrow(/^main\[0\]\.value\.type: unknown type "key"/);
  });

  it("refuses an expression that is no target in a target slot, which no edit makes", () => {
    const sum = asStored(program([ast.assignTo(bin("+", v("a"), num(1)), num(2))]));
    expect(() => migrate(sum)).toThrow(/^main\[0\]\.target: expected a target/);
    expect(migrate(asStored(program([ast.assignTo(ast.empty(), num(2))])))).toBeTruthy();
  });

  it("reads a stored draft, and keeps one whose text is no value of its slot", () => {
    const typed = asStored(
      program([assign("x", ast.draft("1 +")), ast.assignTo(ast.draft("1"), num(2))]),
    );
    expect(migrate(json(typed))).toEqual(typed);
    expect(migrate(asStored(program([assign("x", ast.empty())])))).toBeTruthy();
  });

  it("reads a draft whose text is a value of its slot as that value", () => {
    const stored = asStored(
      program([
        assign("x", ast.draft("abs(n) + 1")),
        ast.assignTo(ast.draft("nums[0]"), num(2)),
        print(ast.draft("1, x")),
      ]),
    );
    const read = migrate(stored);
    const [value, target, shown] = read.main as Array<Record<string, unknown>>;
    expect(value?.value).toMatchObject({
      type: "binop",
      op: "+",
      left: { type: "call", fn: "abs" },
    });
    expect(target?.target).toMatchObject({ type: "index", list: { name: "nums" } });
    expect(shown?.args).toMatchObject([
      { type: "num", value: 1 },
      { type: "var", name: "x" },
    ]);
  });

  it("rejects a draft that an expression holds, or one beside other items", () => {
    const inside = asStored(program([assign("x", bin("+", num(1), ast.draft("2 *")))]));
    expect(() => migrate(inside)).toThrow(
      /^main\[0\]\.value\.right: expected a draft only as a statement's slot/,
    );
    const empty = asStored(program([assign("x", bin("+", num(1), ast.empty()))]));
    expect(() => migrate(empty)).toThrow(
      /^main\[0\]\.value\.right: expected a draft only as a statement's slot/,
    );
    const argument = asStored(program([print(ast.call("abs", ast.empty()))]));
    expect(() => migrate(argument)).toThrow(
      /^main\[0\]\.args\[0\]\.args\[0\]: expected a draft only as a statement's slot/,
    );
    const beside = asStored(program([print(num(1), ast.draft("x y"))]));
    expect(() => migrate(beside)).toThrow(
      /^main\[0\]\.args\[1\]: expected a draft only as a statement's slot/,
    );
    const emptyBeside = asStored(program([print(num(1), ast.empty())]));
    expect(() => migrate(emptyBeside)).toThrow(
      /^main\[0\]\.args\[1\]: expected a draft only as a statement's slot/,
    );
  });

  it("reads a list of values whose only item is a draft with no text as no item", () => {
    const stored = asStored(program([print(ast.empty())]));
    expect((migrate(stored).main[0] as Record<string, unknown>).args).toEqual([]);
    // A draft whose text is no values separated by commas stays the list's only item.
    const typed = asStored(program([print(ast.draft("x y"))]));
    expect(migrate(json(typed))).toEqual(typed);
  });

  it("rejects a draft whose text isn't one line, at its path", () => {
    const broken = asStored(program([assign("x", ast.draft("1 +\n2"))]));
    expect(() => migrate(broken)).toThrow(/^main\[0\]\.value\.text: expected one line of text/);
  });

  it("rejects a stored empty expression as a block of an unknown type", () => {
    const stored = asStored(program([assign("x", num(1))]));
    const stmt = (stored.main as Array<Record<string, unknown>>)[0]!;
    stmt.value = { id: "e0000000000e", type: "empty" };
    expect(() => migrate(stored)).toThrow(/^main\[0\]\.value\.type: unknown type "empty"/);
  });

  it("rejects an unsupported version with the path", () => {
    expect(() => migrate({ ...program([]), version: 2 })).toThrow(MigrateError);
    expect(() => migrate({ ...program([]), version: 2 })).toThrow(
      /^version: unsupported version 2/,
    );
    expect(() => migrate("nope")).toThrow(/expected a program object/);
  });

  it("rejects missing or malformed fields with their path", () => {
    const { main: _omit, ...noMain } = program([]);
    expect(() => migrate(noMain)).toThrow(/^main: expected an array/);
    expect(() => migrate({ ...program([]), inputs: [{ name: 1 }] })).toThrow(/^inputs\[0\]/);
    expect(() => migrate({ ...program([]), functions: [{ id: "f", name: "f" }] })).toThrow(
      /^functions\[0\]/,
    );
  });

  it("rejects unknown statement and expression types and nodes without ids", () => {
    const bad = json(program([assign("x", num(1))])) as { main: Array<Record<string, unknown>> };
    bad.main[0]!.type = "lambda";
    expect(() => migrate(bad)).toThrow(/^main\[0\]\.type: unknown type "lambda"/);
    const badExpr = json(program([assign("x", bin("+", num(1), num(2)))])) as {
      main: Array<{ value: { right: Record<string, unknown> } }>;
    };
    badExpr.main[0]!.value.right.type = "await";
    expect(() => migrate(badExpr)).toThrow(/^main\[0\]\.value\.right\.type/);
    const noId = json(program([print(num(1))])) as {
      main: Array<{ args: Array<Record<string, unknown>> }>;
    };
    delete noId.main[0]!.args[0]!.id;
    expect(() => migrate(noId)).toThrow(/^main\[0\]\.args\[0\]\.id/);
  });

  it("rejects a missing value that isn't optional, a name that is no text, and a region that is no list", () => {
    type Stored = { main: Array<Record<string, unknown>> };
    const noValue = json(program([assign("x", num(1))])) as Stored;
    delete noValue.main[0]!.value;
    expect(() => migrate(noValue)).toThrow(/^main\[0\]\.value: expected an expression/);
    const badName = json(program([assign("x", v("n"))])) as Stored;
    (badName.main[0]!.value as Record<string, unknown>).name = 3;
    expect(() => migrate(badName)).toThrow(/^main\[0\]\.value\.name: expected a name/);
    const badRegion = json(program([for_("i", num(0), num(3), [])])) as Stored;
    badRegion.main[0]!.body = "nothing";
    expect(() => migrate(badRegion)).toThrow(/^main\[0\]\.body: expected an array/);
    // An optional value may be absent.
    const fn = { id: "f0000000000f", name: "f", params: [], body: [ret()] };
    const bare = program([], { functions: [fn] });
    expect(migrate(json(bare))).toEqual(bare);
  });

  it("rejects a statement of a type no block reads, at any depth", () => {
    const p = program([for_("i", num(0), num(3), [print(v("i"))])]);
    const stored = json(p) as { main: Array<Record<string, unknown>> };
    (stored.main[0]!.body as unknown[]).unshift({ id: "c0000000000c", type: "comment" });
    expect(() => migrate(stored)).toThrow(/^main\[0\]\.body\[0\]\.type: unknown type "comment"/);
  });

  it("stores a statement's caption as an edit does and rejects one that is not one line of text", () => {
    const captioned = { ...assign("x", num(1)), caption: "Start at one" };
    expect(migrate(json(program([captioned])))).toEqual(program([captioned]));
    const broken = json(program([{ ...captioned, caption: "two\nlines" }]));
    expect(() => migrate(broken)).toThrow(/^main\[0\]\.caption: expected one line of text/);
    const loose = migrate(
      json(
        program([
          { ...captioned, caption: "  Start  " },
          { ...captioned, caption: " " },
          { ...captioned, caption: "Start \t at  one" },
        ]),
      ),
    );
    expect(loose.main.map((stmt) => stmt.caption)).toEqual(["Start", undefined, "Start at one"]);
    expect(loose.main[1]).not.toHaveProperty("caption");
    expect(() => migrate(json(program([{ ...captioned, caption: 3 } as never])))).toThrow(
      /^main\[0\]\.caption/,
    );
  });

  it("checks id shape, field and parameter elements, and target shape", () => {
    const shortId = json(program([assign("x", num(1))])) as {
      main: Array<Record<string, unknown>>;
    };
    shortId.main[0]!.id = "x";
    expect(() => migrate(shortId)).toThrow(/^main\[0\]\.id: expected a 12-character node id/);
    const p = program([]);
    expect(() =>
      migrate({ ...p, functions: [{ id: "f0000000000f", name: "f", params: [null], body: [] }] }),
    ).toThrow(/^functions\[0\]\.params\[0\]/);
    const badTarget = json(program([assign("x", num(1))])) as {
      main: Array<Record<string, unknown>>;
    };
    badTarget.main[0]!.target = "x";
    expect(() => migrate(badTarget)).toThrow(/^main\[0\]\.target: expected an expression/);
    delete badTarget.main[0]!.target;
    expect(() => migrate(badTarget)).toThrow(/^main\[0\]\.target: expected an expression/);
    badTarget.main[0]!.target = { id: "t0000000000t", type: "var", name: 3 };
    expect(() => migrate(badTarget)).toThrow(/^main\[0\]\.target\.name: expected a name/);
    badTarget.main[0]!.target = { id: "t0000000000t", type: "index", list: v("xs") };
    expect(() => migrate(badTarget)).toThrow(/^main\[0\]\.target\.index: expected an expression/);
  });

  it("refuses an expression whose name holds nothing, at its path", () => {
    expect(() => migrate(assignmentJson(v("")))).toThrow(
      /^main\[0\]\.value\.name: expected the slot filled/,
    );
    // A call with too few arguments is a fault validate() reports (E_ARITY).
    expect(() => migrate(assignmentJson(ast.call("abs")))).not.toThrow();
    expect(() => migrate(assignmentJson(bin("+", num(1), ast.call("f"))))).not.toThrow();
  });

  it("reads a loop's variable as a target, an empty slot until it is filled", () => {
    const loop = (target: unknown) =>
      json(program([ast.forTo(target as never, num(0), num(3), [])]));
    expect(() => migrate(loop(ast.empty()))).not.toThrow();
    expect(() => migrate(loop(ast.item(v("nums"), num(0))))).not.toThrow();
    expect(() => migrate(loop("i"))).toThrow(/^main\[0\]\.var: expected an expression/);
    expect(() => migrate(loop(num(1)))).toThrow(/^main\[0\]\.var: expected a target/);
  });

  it("refuses a field its block would not make, at its path", () => {
    const migration = (fields: Record<string, unknown>, of: unknown) => {
      const p = assignmentJson(of) as { main: Array<{ value: Record<string, unknown> }> };
      Object.assign(p.main[0]!.value, fields);
      return () => migrate(p);
    };
    expect(() => migrate(assignmentJson(num(7)))).not.toThrow();
    expect(() => migrate(assignmentJson(float(2, "2.0")))).not.toThrow();
    expect(() => migrate(assignmentJson(num(2 ** 53 - 1)))).not.toThrow();
    expect(migration({ raw: "007", value: 7 }, num(7))).toThrow(
      /^main\[0\]\.value\.raw: expected a number literal/,
    );
    expect(migration({ raw: "9007199254740992", value: 2 ** 53 }, num(1))).toThrow(
      /value\.raw: expected a number/,
    );
    expect(migration({ raw: "-3", value: -3 }, num(1))).toThrow(/value\.raw: expected a number/);
    expect(migration({ value: 8 }, num(7))).toThrow(
      /^main\[0\]\.value\.value: expected the number raw writes/,
    );
    expect(migration({ float: true }, num(7))).toThrow(/value\.float: expected whether raw/);
    expect(migration({ float: false }, float(2, "2.0"))).toThrow(
      /value\.float: expected whether raw/,
    );
    expect(migration({ op: "^" }, bin("+", num(1), num(2)))).toThrow(
      /value\.op: expected a known operator/,
    );
    expect(migration({ op: "neg!" }, not(v("a")))).toThrow(/value\.op: expected a known operator/);
    expect(migration({ value: 3 }, str("a"))).toThrow(/value\.value: expected a text/);
    expect(migration({ value: "yes" }, bool(true))).toThrow(/value\.value: expected true or false/);
  });

  it("refuses a class and an input of the kind object, while no block constructs one", () => {
    const cls = { id: "c0000000000c", name: "C", fields: [] };
    expect(() => migrate({ ...program([]), classes: [cls] })).toThrow(
      "classes[0]: expected no class: no block constructs an object",
    );
    const object = { ...program([]), inputs: [{ name: "p", kind: "object" }] };
    expect(() => migrate(object)).toThrow(/^inputs\[0\]: expected \{ name, kind \}/);
  });
});
