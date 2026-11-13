// The rows a value line offers: the functions of the program a call can name.
import { describe, expect, it } from "vitest";
import { ast } from "@/blocks/testing";
import { callableFunctions, createCall } from "./choices";

const { program } = ast;

describe("the functions offered", () => {
  it("are the program's functions a call can name, with their parameters", () => {
    const createFunction = (id: string, name: string, params = ["x"]) => ({
      id,
      name,
      params,
      body: [],
    });
    const p = program([], {
      functions: [
        createFunction("fn0000000001", "twice"),
        createFunction("fn0000000002", "for"),
        createFunction("fn0000000003", "abs"),
        createFunction("fn0000000004", "twice"),
        // A parameter's fault is no fault of the function's name.
        createFunction("fn0000000005", "f", ["f", "f"]),
      ],
    });
    expect(callableFunctions(p)).toEqual([
      { name: "twice", params: ["x"] },
      { name: "f", params: ["f", "f"] },
    ]);
  });
});

describe("a call of a function", () => {
  it("holds an empty slot for each parameter", () => {
    expect(createCall({ name: "twice", params: ["a", "b"] })).toMatchObject({
      type: "call",
      fn: "twice",
      args: [
        { type: "draft", text: "" },
        { type: "draft", text: "" },
      ],
    });
  });

  it("throws for a name that writes no call, such as a class name", () => {
    expect(() => createCall({ name: "Point", params: [] })).toThrow(/"Point" names no call/);
  });
});
