// U-01: the hash routes of the six pages; U-07: anything else shows the Problems page.
import { describe, expect, it } from "vitest";
import { parseRoute, resolveRoute, routeHash, type Route } from "./route";

describe("routes (U-01)", () => {
  it.each<[string, Route]>([
    ["", { page: "problems" }],
    ["#/", { page: "problems" }],
    ["#/p/fizzbuzz", { page: "problem", id: "fizzbuzz" }],
    ["#/play", { page: "playground" }],
    ["#/play/", { page: "playground" }],
    ["#/play/abc", { page: "program", id: "abc" }],
    ["#/modules", { page: "modules" }],
    ["#/m/heap", { page: "module", name: "heap" }],
    ["#/m/my%20heap", { page: "module", name: "my heap" }],
  ])("parses %j", (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it("writes the hash each route parses back from", () => {
    const routes: Route[] = [
      { page: "problems" },
      { page: "problem", id: "fizzbuzz" },
      { page: "playground" },
      { page: "program", id: "a b" },
      { page: "modules" },
      { page: "module", name: "heap" },
    ];
    for (const route of routes) expect(parseRoute(routeHash(route))).toEqual(route);
  });
});

describe("unknown routes (U-07)", () => {
  it.each(["#/nope", "#/p", "#/p/", "#/m", "#/modules/x", "#/p/a/b", "#/p/%E0%A4%A"])(
    "shows Problems for %j",
    (hash) => {
      expect(parseRoute(hash)).toEqual({ page: "problems" });
    },
  );

  it("shows Problems for a problem id with no challenge", () => {
    expect(resolveRoute("#/p/nope")).toEqual({ page: "problems" });
    expect(resolveRoute("#/p/fizzbuzz")).toEqual({ page: "problem", id: "fizzbuzz" });
  });
});
