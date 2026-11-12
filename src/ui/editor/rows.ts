// The list under the editor's focused field: the value list of its value line, or, while an
// operator is switched, the other operators of its group.
import { t } from "@/i18n/t";
import type { Kinds } from "@/lang/kinds";
import type { Name } from "@/lang/types";
import type { ListItem, ListSection } from "./EditorList";
import { allEntries, findEntry } from "./entries";
import { functionLabel } from "./explain";
import { find } from "./line";
import { listRows, type LineContext, type ListGroup, type Row } from "./choices";
import { listSections } from "./list";
import type { Session } from "./session";

/** A variable's kind as the lists name it. */
function kindName(kinds: Kinds, name: Name): string | undefined {
  const kind = kinds.get(name);
  return kind ? t(`editor.kind.${kind}`) : undefined;
}

function rowItem(row: Row, index: number, kinds: Kinds): ListItem {
  switch (row.type) {
    case "variable":
      return {
        key: `v:${row.name}:${index}`,
        label: [{ text: row.name, variable: true }],
        code: true,
        note: kindName(kinds, row.name),
      };
    case "new":
      return {
        key: `new:${row.name}`,
        label: [{ text: row.name, variable: true }],
        code: true,
        lead: t("editor.newVariable"),
      };
    case "entry":
      return {
        key: `e:${row.entry.id}`,
        label: [{ text: row.entry.label }],
        ...(row.entry.declared.symbol ? { symbol: row.entry.declared.symbol } : {}),
      };
    case "function":
      return { key: `f:${row.fn.name}`, label: functionLabel(row.fn), code: true };
    case "parentheses":
      return {
        key: "parentheses",
        label: [{ text: t("editor.parentheses.label") }],
        symbol: t("editor.parentheses.symbol"),
      };
  }
}

/** The other operators of the switched operator's block and group. */
function switchRows(session: Session, kinds: Kinds): { rows: Row[]; sections: ListSection[] } {
  const { line, switching } = session;
  const held = line && switching ? find(line.root, switching) : undefined;
  const current = held ? findEntry(held, kinds) : undefined;
  if (!current) return { rows: [], sections: [] };
  const rows = allEntries()
    .filter(
      (entry) =>
        entry !== current &&
        entry.def === current.def &&
        entry.declared.group === current.declared.group,
    )
    .map((entry): Row => ({ type: "entry", entry }));
  const title = t(`editor.lists.${current.declared.group}`);
  const items = rows.map((row, index) => rowItem(row, index, kinds));
  return { rows, sections: rows.length > 0 ? [{ title, items }] : [] };
}

/** The rows of the focused value line's list, and its sections as drawn. */
export function valueList(
  session: Session,
  ctx: LineContext,
): { rows: Row[]; sections: ListSection[] } {
  const { line } = session;
  if (!line) return { rows: [], sections: [] };
  if (session.switching) return switchRows(session, ctx.kinds);
  const listed = listSections(line, ctx, session.all);
  let index = 0;
  const sections = listed.map((section) => ({
    title: listTitle(section.group),
    items: section.rows.map((row) => rowItem(row, (index += 1), ctx.kinds)),
  }));
  return { rows: listRows(listed), sections };
}

/** The titles of the name list's groups (`editor.md`, Name list). */
const SECTION_TITLES: Record<"problem" | "variables" | "new", () => string> = {
  problem: () => t("editor.thisProblem"),
  variables: () => t("editor.lists.variables"),
  new: () => "",
};

/** A value list's section title: a name's group as the name list titles it. */
function listTitle(group: ListGroup): string {
  return group === "problem" || group === "variables" || group === "new"
    ? SECTION_TITLES[group]()
    : t(`editor.lists.${group}`);
}
