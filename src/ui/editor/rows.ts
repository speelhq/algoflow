// The lists under the editor's fields: the value list of the focused value line (or, while an
// operator is switched, the other operators of its group), and the name list of a name field.
import { t } from "@/i18n/t";
import type { Kinds } from "@/lang/kinds";
import type { Id } from "@/lang/types";
import type { ListItem, ListSection } from "./EditorList";
import { allEntries, entryOf } from "./entries";
import { functionLabel } from "./explain";
import { find, type LineContext, type Row } from "./line";
import { listRows, listSections, type ListGroup } from "./list";
import { nameSections, type ChartNames, type NameRow, type NameSection } from "./names";
import type { Session } from "./session";

/** A variable's kind as the lists name it. */
function kindName(kinds: Kinds, name: Id): string | undefined {
  const kind = kinds.get(name);
  return kind ? t(`editor.kind.${kind}`) : undefined;
}

function rowItem(row: Row, index: number, kinds: Kinds): ListItem {
  switch (row.kind) {
    case "variable":
      return {
        key: `v:${row.name}:${index}`,
        label: row.name,
        variable: true,
        note: kindName(kinds, row.name),
      };
    case "new":
      return {
        key: `new:${row.name}`,
        label: row.name,
        variable: true,
        lead: t("editor.newVariable"),
      };
    case "entry":
      return {
        key: `e:${row.entry.id}`,
        label: row.entry.label,
        ...(row.entry.menu.symbol ? { symbol: row.entry.menu.symbol } : {}),
      };
    case "function":
      return { key: `f:${row.fn.name}`, label: functionLabel(row.fn) };
    case "parentheses":
      return {
        key: "parentheses",
        label: t("editor.parentheses"),
        symbol: t("editor.parenthesesGlyph"),
      };
  }
}

/** The other operators of the switched operator's block and group. */
function switchRows(session: Session, kinds: Kinds): { rows: Row[]; sections: ListSection[] } {
  const { line, switching } = session;
  const held = line && switching ? find(line.root, switching) : undefined;
  const current = held ? entryOf(held, kinds) : undefined;
  if (!current) return { rows: [], sections: [] };
  const rows = allEntries()
    .filter(
      (entry) =>
        entry !== current && entry.def === current.def && entry.menu.group === current.menu.group,
    )
    .map((entry): Row => ({ kind: "entry", entry }));
  const title = t(`editor.lists.${current.menu.group}`);
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

const SECTION_TITLES: Record<NameSection["group"], () => string> = {
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

function nameItem(row: NameRow, kinds: Kinds): ListItem {
  const key = `${row.kind}:${row.name}`;
  switch (row.kind) {
    case "name":
      return { key, label: row.name, variable: true, note: kindName(kinds, row.name) };
    case "new":
      return { key, label: row.name, variable: true, lead: t("editor.newVariable") };
  }
}

/** The rows of a name field's list for the name typed, and its sections as drawn. */
export function nameList(
  names: ChartNames,
  typed: string | null,
  kinds: Kinds,
): { rows: NameRow[]; sections: ListSection[] } {
  const listed = nameSections(names, typed ?? "");
  const sections = listed.map((section) => ({
    title: SECTION_TITLES[section.group](),
    items: section.rows.map((row) => nameItem(row, kinds)),
  }));
  return { rows: listed.flatMap((section) => section.rows), sections };
}

/** The name row highlighted: the one moved to, else while a name is typed the whole name or the first. */
export function shownNameRow(session: Session, rows: readonly NameRow[]): number | null {
  const { highlight, typed } = session;
  if (highlight !== null && highlight < rows.length) return highlight;
  if (!typed) return null;
  const whole = rows.findIndex((row) => row.kind === "name" && row.name === typed);
  return whole >= 0 ? whole : rows.length > 0 ? 0 : null;
}
