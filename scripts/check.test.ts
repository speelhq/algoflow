// C-01, C-03: the schema checker; R-20: the CPython script shape (no python run here).
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { checkChallengeSchema } from "./lib/challenge";
import { buildScript, randomShims } from "./lib/cpython";
import { execute } from "./lib/interp";

const { assign, num, bin, v, print } = ast;

function valid() {
  const solution = program([assign("total", bin("+", v("n"), num(1)))], {
    inputs: [{ name: "n", value: 1 }],
  });
  return {
    id: "demo",
    track: "day1",
    order: 9,
    title: { en: "Demo" },
    description: { en: "Add one." },
    inputs: [{ name: "n", value: 1 }],
    tests: [
      { name: { en: "one" }, inputs: { n: 1 }, expect: { variables: { total: 2 } } },
      { name: { en: "edge: zero" }, inputs: { n: 0 }, expect: { variables: { total: 1 } } },
      { name: { en: "ten" }, inputs: { n: 10 }, expect: { variables: { total: 11 } } },
    ],
    hints: [{ en: "a" }, { en: "b" }, { en: "c" }],
    solution: { ...solution, challengeId: "demo" },
  };
}

describe("checkChallengeSchema (C-01, C-03)", () => {
  it("accepts a complete challenge", () => {
    expect(checkChallengeSchema(valid(), "demo").problems).toEqual([]);
  });

  it("reports each structural problem", () => {
    const c = valid();
    c.id = "other";
    c.hints = c.hints.slice(0, 2);
    c.tests[1]!.name.en = "zero";
    delete (c.tests[2]!.inputs as Record<string, unknown>).n;
    c.solution.inputs = [{ name: "n", value: 2 }];
    const { problems } = checkChallengeSchema(c, "demo");
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("does not match the file name"),
        expect.stringContaining("edge:"),
        expect.stringContaining("hints must be exactly 3"),
        expect.stringContaining('tests[2].inputs is missing "n"'),
        expect.stringContaining("solution.inputs must equal inputs"),
      ]),
    );
  });

  it("requires at least three tests and a non-empty expect", () => {
    const c = valid() as unknown as { tests: unknown[] };
    const [first, second] = valid().tests;
    c.tests = [first, { ...second, expect: {} }];
    const { problems } = checkChallengeSchema(c, "demo");
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("at least 3"),
        expect.stringContaining("tests[1].expect"),
      ]),
    );
  });

  it("runs validate() on the solution and reports diagnostics", () => {
    const c = valid();
    c.solution = {
      ...program([print(v("ghost"))], { inputs: [{ name: "n", value: 1 }] }),
      challengeId: "demo",
    };
    expect(checkChallengeSchema(c, "demo").problems).toEqual([
      expect.stringMatching(/^solution: E_UNDEFINED/),
    ]);
  });

  it("requires ja texts only when asked (M-06)", () => {
    expect(checkChallengeSchema(valid(), "demo", { requireJa: true }).problems).toEqual(
      expect.arrayContaining([expect.stringContaining("title must be { en, ja? }")]),
    );
  });
});

describe("execute (C-10 view of a run)", () => {
  it("reports final main variables as Data, stdout, and draws", () => {
    const outcome = execute(
      program([assign("x", bin("*", v("n"), num(2))), print(v("x"))], {
        inputs: [{ name: "n", value: 4 }],
      }),
      { n: 4 },
      1,
    );
    expect(outcome).toMatchObject({
      done: { type: "done" },
      stdout: ["8"],
      vars: { n: 4, x: 8 },
      draws: [],
    });
  });
});

describe("buildScript (R-20)", () => {
  it("wraps the code with the random shim, stdout capture, and the JSON epilogue", () => {
    const script = buildScript("x = random.randint(1, 6)\nprint(x)\n", [4], ["x"]);
    expect(script).toContain("_draws = iter([4])");
    expect(script).toContain('for _name in ["randint"]:');
    expect(script).toContain("builtins.print = _print");
    expect(script).toContain(
      'exec(compile("x = random.randint(1, 6)\\nprint(x)\\n", "solution.py", "exec"), _ns)',
    );
    expect(script).toContain('for name in ["x"] if name in _ns');
    expect(script).toContain('json.dumps({"stdout": _lines, "vars": _vars})');
  });

  it("derives the random shims from the registry (N-05)", () => {
    expect(randomShims()).toEqual(["randint"]);
  });
});
