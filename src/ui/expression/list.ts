// The list of a value line as data: where a value is expected, the variables, the
// values, brackets, Not, and the functions; after a value, the entries that apply to its
// kind, grouped by purpose. Built from the blocks' `menu` entries and the program's
// variables and functions; names no block.
import { t, type MessageKey } from "@/i18n/t";
import { variableName } from "@/lang/kinds";
import type { Expr, Id, Kind, Program } from "@/lang/types";
import { isExpr } from "@/lang/walk";
import { NODES } from "@/nodes";
import { MENU_GROUPS, type MenuEntry, type MenuGroup } from "@/nodes/types";
import { isParseError, parse } from "@/python/parse";
import { nodeText } from "@/ui/chart/text";
import { empty, makeEntry, replace } from "./line";

/** A group of the list: the entries' groups, and `variables` and `order` where a value is expected. */
export type GroupId = MenuGroup | "variables" | "order";

export type Row =
  | { type: "variable"; id: string; name: Id; of?: Kind; make: () => Expr }
  | { type: "brackets"; id: string; label: string }
  | {
      type: "entry";
      id: string;
      label: string;
      help: string;
      symbol?: string;
      /** It takes the value before the caret as its first input (its entry's `on`). */
      after: boolean;
      /** The entry's preset slots, when it switches an operator. */
      preset?: Record<string, unknown>;
      keys?: string;
      group: MenuGroup;
      make: () => Expr;
    };

export type Group = { id: GroupId; title: string; rows: Row[] };

/** Every entry of the registered blocks, in group order, then registration order. */
export function entryRows(): Extract<Row, { type: "entry" }>[] {
  const rows: Extract<Row, { type: "entry" }>[] = [];
  for (const def of NODES.values()) {
    for (const entry of def.menu ?? []) rows.push(entryRow(def.key, entry));
  }
  return rows.toSorted((a, b) => MENU_GROUPS.indexOf(a.group) - MENU_GROUPS.indexOf(b.group));
}

function entryRow(key: string, entry: MenuEntry): Extract<Row, { type: "entry" }> {
  const base = entry.name === "" ? "" : `${entry.name}.`;
  return {
    type: "entry",
    id: `${key}:${entry.name}`,
    label: nodeText(key, `${base}label`),
    help: nodeText(key, `${base}help`),
    ...(entry.symbol ? { symbol: entry.symbol } : {}),
    after: entry.on !== undefined,
    ...(entry.preset ? { preset: entry.preset } : {}),
    ...(entry.keys ? { keys: entry.keys } : {}),
    group: entry.group,
    make: () => makeEntry(key, entry.preset),
  };
}

const ON = new Map<string, readonly Kind[] | undefined>();
for (const def of NODES.values()) {
  for (const entry of def.menu ?? []) ON.set(`${def.key}:${entry.name}`, entry.on);
}

/** The kinds an entry row applies after. */
export function kindsOf(row: Extract<Row, { type: "entry" }>): readonly Kind[] {
  return ON.get(row.id) ?? [];
}

const title = (group: GroupId) => t(`editor.group.${group}` as MessageKey);

/** The program's own functions as calls, each with an empty input per parameter. */
function functionRows(program: Program): Row[] {
  const scope = {
    classes: program.classes.map((cls) => cls.name),
    functions: program.functions.map((fn) => fn.name),
  };
  return program.functions.map((fn) => {
    const make = (): Expr => {
      const parsed = parse(`${fn.name}(${fn.params.map(() => "x").join(", ")})`, scope);
      if (isParseError(parsed)) return empty();
      let call = parsed;
      for (const arg of allNames(parsed)) call = replace(call, arg.id, empty());
      return call;
    };
    return {
      type: "entry",
      id: `fn:${fn.name}`,
      label: `${fn.name}(${fn.params.length > 0 ? t("chart.blank") : ""})`,
      help: t("editor.ownFunction", { name: fn.name }),
      after: false,
      group: "functions",
      make,
    };
  });
}

/** The bare names under `expr` (the placeholders of a parsed call). */
function* allNames(expr: Expr): Generator<Expr, void, void> {
  if (variableName(expr) !== undefined) {
    yield expr;
    return;
  }
  for (const value of Object.values(expr)) {
    if (Array.isArray(value)) {
      for (const item of value) if (isExpr(item)) yield* allNames(item);
    } else if (isExpr(value)) yield* allNames(value);
  }
}

/** The groups where a value is expected. */
export function valueGroups(
  program: Program,
  variables: ReadonlyArray<{ name: Id; of?: Kind }>,
): Group[] {
  const entries = entryRows().filter((row) => !row.after);
  const groups: Group[] = [
    {
      id: "variables",
      title: title("variables"),
      rows: variables.map(({ name, of }) => ({
        type: "variable",
        id: `var:${name}`,
        name,
        ...(of ? { of } : {}),
        make: () => {
          const parsed = parse(name);
          return isParseError(parsed) ? empty() : parsed;
        },
      })),
    },
    { id: "values", title: title("values"), rows: entries.filter((r) => r.group === "values") },
    {
      id: "order",
      title: title("order"),
      rows: [{ type: "brackets", id: "brackets", label: t("editor.brackets") }],
    },
    { id: "combine", title: title("combine"), rows: entries.filter((r) => r.group === "combine") },
    {
      id: "functions",
      title: title("functions"),
      rows: [...entries.filter((r) => r.group === "functions"), ...functionRows(program)],
    },
  ];
  return groups.filter((group) => group.rows.length > 0);
}

/** The order of the groups after a value. */
const AFTER_ORDER: readonly MenuGroup[] = [
  "calculate",
  "compare",
  "convert",
  "items",
  "totals",
  "combine",
  "other",
];

/** The groups after a value of `kind`; a value of no known kind lists every such entry. */
export function afterGroups(kind: Kind | undefined): Group[] {
  const entries = entryRows().filter(
    (row) => row.after && (kind === undefined || kindsOf(row).includes(kind)),
  );
  return AFTER_ORDER.map((group) => ({
    id: group,
    title: title(group),
    rows: entries.filter((row) => row.group === group),
  })).filter((group) => group.rows.length > 0);
}

/** `Show all`: every entry in group order. */
export function allGroups(program: Program): Group[] {
  const entries = [...entryRows(), ...functionRows(program)];
  return MENU_GROUPS.map((group) => ({
    id: group,
    title: title(group),
    rows: entries.filter((row) => row.type === "entry" && row.group === group),
  })).filter((group) => group.rows.length > 0);
}

/** The text a row is matched by: its label, its name, and its keys. */
function words(row: Row): string[] {
  if (row.type === "variable") return [row.name];
  if (row.type === "brackets") return [row.label, "("];
  return [row.label, ...(row.keys ? [row.keys] : [])];
}

/** The rows of `groups` whose words contain `query`, ignoring case, exact matches first. */
export function matches(groups: Group[], query: string): Row[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const rows = groups.flatMap((group) => group.rows);
  const hit = rows.filter((row) => words(row).some((word) => word.toLowerCase().includes(q)));
  const exact = (row: Row) => words(row).some((word) => word.toLowerCase() === q);
  return [...hit.filter(exact), ...hit.filter((row) => !exact(row))];
}

/** The edit distance between two words, for `Did you mean`. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const kept = row[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, previous + cost);
      previous = kept;
    }
  }
  return row[b.length] ?? 0;
}

/** The closest word of the rows to `query`, when one is near enough to be meant. */
export function closest(groups: Group[], query: string): string | undefined {
  const q = query.trim().toLowerCase();
  let best: { word: string; d: number } | undefined;
  for (const row of groups.flatMap((group) => group.rows)) {
    const word = row.type === "variable" ? row.name : row.type === "entry" ? row.label : "";
    if (word === "") continue;
    const d = distance(q, word.toLowerCase());
    if (!best || d < best.d) best = { word, d };
  }
  return best && best.d <= Math.max(2, Math.floor(q.length / 3)) ? best.word : undefined;
}
