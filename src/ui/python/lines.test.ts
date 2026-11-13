// Hovering or clicking a line acts on its innermost statement; a node lights its lines.
import { describe, expect, it } from "vitest";
import { lineOwners, nodeLines } from "./lines";

const map = { loop: { start: 2, end: 2 }, call: { start: 4, end: 6 }, inner: { start: 5, end: 5 } };

describe("lineOwners", () => {
  it("gives each line its innermost statement", () => {
    const owners = lineOwners(map);
    expect(owners.get(2)).toBe("loop");
    expect(owners.get(4)).toBe("call");
    expect(owners.get(5)).toBe("inner");
    expect(owners.get(6)).toBe("call");
    expect(owners.has(1)).toBe(false);
  });
});

describe("nodeLines", () => {
  it("lists every line of a statement's range, none for an unknown id or null", () => {
    expect([...nodeLines(map, "call")]).toEqual([4, 5, 6]);
    expect(nodeLines(map, "nope").size).toBe(0);
    expect(nodeLines(map, null).size).toBe(0);
  });
});
