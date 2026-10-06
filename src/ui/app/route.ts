// The six pages and their hash routes; a hash that names nothing, a problem id with no
// challenge, or a Playground id the Playground does not list, shows the Problems page.
import { useMemo, useSyncExternalStore } from "react";
import { getChallenge } from "@/challenges";
import { isListed } from "@/store/playground";

export type Route =
  | { page: "problems" }
  | { page: "problem"; id: string }
  | { page: "playground" }
  | { page: "program"; id: string }
  | { page: "modules" }
  | { page: "module"; name: string };

const PROBLEMS: Route = { page: "problems" };

function decode(segment: string): string | undefined {
  try {
    const text = decodeURIComponent(segment);
    return text === "" ? undefined : text;
  } catch {
    return undefined;
  }
}

/** The route a hash names by its shape alone; anything else is the Problems page. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/\/+$/, "");
  const [first, second, ...rest] = path.split("/").slice(1);
  if (rest.length > 0) return PROBLEMS;
  const param = second === undefined ? undefined : decode(second);
  if (first === "play") {
    if (second === undefined) return { page: "playground" };
    return param === undefined ? PROBLEMS : { page: "program", id: param };
  }
  if (first === "modules" && second === undefined) return { page: "modules" };
  if (first === "p" && param !== undefined) return { page: "problem", id: param };
  if (first === "m" && param !== undefined) return { page: "module", name: param };
  return PROBLEMS;
}

/** As `parseRoute`, with an id that names no challenge or no Playground program sent to Problems. */
export function resolveRoute(hash: string): Route {
  const route = parseRoute(hash);
  if (route.page === "problem" && !getChallenge(route.id)) return PROBLEMS;
  if (route.page === "program" && !isListed(route.id)) return PROBLEMS;
  return route;
}

export function routeHash(route: Route): string {
  switch (route.page) {
    case "problems":
      return "#/";
    case "problem":
      return `#/p/${encodeURIComponent(route.id)}`;
    case "playground":
      return "#/play";
    case "program":
      return `#/play/${encodeURIComponent(route.id)}`;
    case "modules":
      return "#/modules";
    case "module":
      return `#/m/${encodeURIComponent(route.name)}`;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return useMemo(() => resolveRoute(hash), [hash]);
}

export function navigate(route: Route): void {
  window.location.hash = routeHash(route);
}
