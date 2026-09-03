// T-01: import validates and migrates by version (L-53).
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { MigrateError, migrate } from "./migrate";

const { assign, print, num, bin, v, for_ } = ast;

function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("migrate (L-53)", () => {
  it("accepts a version 1 program unchanged", () => {
    const p = program(
      [assign("x", num(1)), for_("i", num(0), num(3), [print(bin("+", v("x"), v("i")))])],
      {
        inputs: [{ name: "n", value: [1, 2] }],
        functions: [{ id: "f0000000000f", name: "f", params: ["a"], body: [print(v("a"))] }],
      },
    );
    expect(migrate(json(p))).toEqual(p);
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

  it("rejects unknown statement and expression kinds and nodes without ids", () => {
    const bad = json(program([assign("x", num(1))])) as { main: Array<Record<string, unknown>> };
    bad.main[0]!.kind = "lambda";
    expect(() => migrate(bad)).toThrow(/^main\[0\]\.kind: unknown kind "lambda"/);
    const badExpr = json(program([assign("x", bin("+", num(1), num(2)))])) as {
      main: Array<{ value: { right: Record<string, unknown> } }>;
    };
    badExpr.main[0]!.value.right.kind = "await";
    expect(() => migrate(badExpr)).toThrow(/^main\[0\]\.value\.right\.kind/);
    const noId = json(program([print(num(1))])) as {
      main: Array<{ args: Array<Record<string, unknown>> }>;
    };
    delete noId.main[0]!.args[0]!.id;
    expect(() => migrate(noId)).toThrow(/^main\[0\]\.args\[0\]\.id/);
  });
});
