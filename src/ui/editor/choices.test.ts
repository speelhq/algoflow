// The rows a value line offers: the functions of the program a call can name.
import { describe, expect, it } from "vitest";
import { program } from "@/blocks/testing";
import { callableFunctions } from "./choices";

describe("the functions offered", () => {
  it("are the program's functions a call can name, with their parameters", () => {
    const fn = (id: string, name: string, params = ["x"]) => ({ id, name, params, body: [] });
    const p = program([], {
      functions: [
        fn("fn0000000001", "twice"),
        fn("fn0000000002", "for"),
        fn("fn0000000003", "abs"),
        fn("fn0000000004", "twice"),
        // A parameter's fault is no fault of the function's name.
        fn("fn0000000005", "f", ["f", "f"]),
      ],
    });
    expect(callableFunctions(p)).toEqual([
      { name: "twice", params: ["x"] },
      { name: "f", params: ["f", "f"] },
    ]);
  });
});
