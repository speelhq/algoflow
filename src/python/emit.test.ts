import { describe, expect, it } from "vitest";
import { ast, createProgramWithInputs } from "@/blocks/testing";
import { dataToPython, emit, unparse } from "./emit";
import { EXPRESSION_FIXTURE } from "./fixtures/expressions";
import { isParseError, parse } from "./parse";
import { pyString } from "./strings";

const { assign, print, if_, for_, while_, num, str, bin, v, call, program } = ast;

const CR = String.fromCharCode(13);
const SOH = String.fromCharCode(1);
const DEL = String.fromCharCode(127);

describe("emit (emitter.md)", () => {
  it("writes one else-if as elif", () => {
    const second = if_(v("condition2"), [print(str("B"))]);
    const first = if_(v("condition1"), [print(str("A"))], [second]);
    const { code, map } = emit(program([first]), {});
    expect(code).toBe('if condition1:\n    print("A")\nelif condition2:\n    print("B")\n');
    expect(map[first.id]).toEqual({ start: 1, end: 1 });
    expect(map[second.id]).toEqual({ start: 3, end: 3 });
  });

  it("writes consecutive else-if statements as an elif chain", () => {
    const third = if_(v("condition3"), [print(str("C"))], [print(str("D"))]);
    const second = if_(v("condition2"), [print(str("B"))], [third]);
    const first = if_(v("condition1"), [print(str("A"))], [second]);
    const after = print(str("Done"));
    const { code, map } = emit(program([first, after]), {});
    expect(code).toBe(
      'if condition1:\n    print("A")\nelif condition2:\n    print("B")\nelif condition3:\n    print("C")\nelse:\n    print("D")\nprint("Done")\n',
    );
    expect(map[first.id]).toEqual({ start: 1, end: 1 });
    expect(map[second.id]).toEqual({ start: 3, end: 3 });
    expect(map[third.id]).toEqual({ start: 5, end: 5 });
    expect(map[after.id]).toEqual({ start: 9, end: 9 });
    expect(Object.values(map).some((entry) => entry.start === 7)).toBe(false);
  });

  it("keeps an else region with an if and another statement nested", () => {
    const nested = if_(v("condition2"), [print(str("B"))]);
    const first = if_(v("condition1"), [print(str("A"))], [nested, print(str("C"))]);
    const { code, map } = emit(program([first]), {});
    expect(code).toBe(
      'if condition1:\n    print("A")\nelse:\n    if condition2:\n        print("B")\n    print("C")\n',
    );
    expect(map[nested.id]).toEqual({ start: 4, end: 4 });
  });

  it("places and maps a caption on an elif at the chain's indentation", () => {
    const second = { ...if_(v("condition2"), [print(str("B"))]), caption: "Alternative" };
    const chain = if_(v("condition1"), [print(str("A"))], [second]);
    const outer = if_(v("outer"), [chain]);
    const { code, map } = emit(program([outer]), {});
    expect(code).toBe(
      'if outer:\n    if condition1:\n        print("A")\n    # Alternative\n    elif condition2:\n        print("B")\n',
    );
    expect(map[second.id]).toEqual({ start: 4, end: 5 });
  });

  it("1-based inclusive lines; a compound statement maps to its header; else: is unmapped", () => {
    const inner = assign("x", num(1));
    const branch = if_(bin("<", v("a"), v("b")), [inner], [assign("x", num(2))]);
    const after = print(v("x"));
    const { code, map } = emit(program([branch, after]), {});
    expect(code).toBe("if a < b:\n    x = 1\nelse:\n    x = 2\nprint(x)\n");
    expect(map[branch.id]).toEqual({ start: 1, end: 1 });
    expect(map[inner.id]).toEqual({ start: 2, end: 2 });
    expect(map[after.id]).toEqual({ start: 5, end: 5 });
    expect(Object.values(map).some((m) => m.start === 3)).toBe(false);
  });

  it("sections separated by one blank line, two around functions", () => {
    const prog = program([assign("d", call("randint", num(1), num(6)))], {
      inputs: [{ name: "n", kind: "number" }],
      functions: [
        {
          id: "f0000000000f",
          name: "twice",
          params: ["x"],
          body: [print(bin("*", v("x"), num(2)))],
        },
      ],
    });
    const { code, map } = emit(prog, { n: 3 });
    expect(code).toBe(
      [
        "import random",
        "",
        "",
        "def twice(x):",
        "    print(x * 2)",
        "",
        "",
        "n = 3",
        "d = random.randint(1, 6)",
        "",
      ].join("\n"),
    );
    expect(map["f0000000000f"]).toEqual({ start: 4, end: 4 });
  });

  it("a statement with a caption is preceded by it as a comment, where its map entry starts", () => {
    const inner = { ...print(v("i")), caption: "Show it" };
    const loop = { ...for_("i", num(0), num(3), [inner]), caption: "Count to three" };
    const { code, map } = emit(program([loop]), {});
    expect(code).toBe("# Count to three\nfor i in range(3):\n    # Show it\n    print(i)\n");
    expect(map[loop.id]).toEqual({ start: 1, end: 2 });
    expect(map[inner.id]).toEqual({ start: 3, end: 4 });
  });

  it("inputs are emitted as assignments of their values, in declaration order", () => {
    const made = createProgramWithInputs(
      {
        nums: [5, 3, 1],
        name: "Claude",
        x: { $float: 2 },
        d: { a: 1, "$int:2": [true, null] },
      },
      [],
    );
    const { code } = emit(made.program, made.inputs);
    expect(() => emit(made.program, { nums: [1] })).toThrow(/no value for input name/);
    expect(code).toBe(
      'nums = [5, 3, 1]\nname = "Claude"\nx = 2.0\nd = {"a": 1, 2: [True, None]}\n',
    );
    expect(dataToPython(1.5)).toBe("1.5");
    expect(dataToPython(1e-7)).toBe("1e-07");
  });

  it("an int input is its digits, a float input its repr", () => {
    expect(dataToPython(2 ** 53 - 1)).toBe("9007199254740991");
    expect(dataToPython(12)).toBe("12");
    expect(dataToPython({ $float: 2 })).toBe("2.0");
    expect(dataToPython({ "$int:-3": "a" })).toBe('{-3: "a"}');
  });

  it("4-space indentation, no trailing whitespace, one trailing newline", () => {
    const { code } = emit(
      program([for_("i", num(0), num(3), [while_(v("ok"), [print(v("i"))])])]),
      {},
    );
    expect(code).toBe("for i in range(3):\n    while ok:\n        print(i)\n");
    expect(code.endsWith("\n\n")).toBe(false);
    expect(code.split("\n").some((line) => /\s$/.test(line))).toBe(false);
  });

  it("string escapes, including control characters CPython would reject raw", () => {
    expect(pyString('a"b\\c\nd\te')).toBe('"a\\"b\\\\c\\nd\\te"');
    expect(pyString(`a${CR}b${SOH}c${DEL}`)).toBe('"a\\rb\\x01c\\x7f"');
    expect(unparse(str("plain"))).toBe('"plain"');
    const roundTrip = parse(unparse(str(`a${CR}b${SOH}`)));
    expect(!isParseError(roundTrip) && unparse(roundTrip)).toBe('"a\\rb\\x01"');
  });

  it("emits an empty program as an empty file and an empty main region under inputs", () => {
    expect(emit(program([]), {}).code).toBe("\n");
    const made = createProgramWithInputs({ n: 1 }, []);
    expect(emit(made.program, made.inputs).code).toBe("n = 1\n");
  });
});

describe("200-expression fixture", () => {
  it("has at least 200 cases", () => {
    expect(EXPRESSION_FIXTURE.length).toBeGreaterThanOrEqual(200);
  });

  for (const entry of EXPRESSION_FIXTURE) {
    const [input, expected] = typeof entry === "string" ? [entry, entry] : entry;
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      const expr = parse(input);
      if (isParseError(expr)) throw new Error(`parse failed: ${JSON.stringify(expr)}`);
      expect(unparse(expr)).toBe(expected);
    });
  }
});
