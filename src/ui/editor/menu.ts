// The block menu's entries for one connector: the registered statement blocks
// grouped by category in menu order, each in registration order, those whose `requires`
// the place does not meet disabled with the reason, then the program's functions a call can
// name, as calls. Reads `shape`, `hidden`, `category`, `requires`, and the notation and slot
// hints of a block's `create()`, never a type.
import { blockText, t } from "@/i18n/t";
import { placeContext } from "@/lang/scope";
import type { Place, Program, Stmt } from "@/lang/types";
import { getBlockDef, menuBlockDefs } from "@/blocks/registry";
import { CATEGORIES, type Category } from "@/blocks/categories";
import { joinSpans, notationWithHints, type NotationSpan } from "@/ui/chart/text";
import { functionLabel } from "./explain";
import { callableFunctions } from "./line";
import { slotChoice, type Written } from "./caret";
import { callExpr, type LineFunction } from "./choices";
import { textValue } from "./fields";

export type BlockMenuEntry = {
  /** The registry key, or `call:<name>` for a function of the program. */
  id: string;
  /** The block's label, or a program function's call as the value list labels it (`double(x)`). */
  label: NotationSpan[];
  /** The block's notation with every slot written as its hint; absent for a call, whose label it is. */
  notation?: string;
  help: string;
  /** Why the block cannot go here; absent when it can. */
  disabled?: string;
  create: () => Stmt;
  /**
   * Where the caret goes in the first field of the block inserted: where a choice of the operation
   * it holds puts it (`editor.md`, Block menu), and at the start of a block's field with no text.
   */
  caret: number;
};
export type BlockMenuGroup = { id: Category | "program"; title: string; entries: BlockMenuEntry[] };

/** The groups of the block menu at `place`; empty groups are left out. */
export function menuGroups(program: Program, place: Place): BlockMenuGroup[] {
  const here = placeContext(program, place);
  const groups: BlockMenuGroup[] = [];
  for (const category of CATEGORIES) {
    const entries = menuBlockDefs(category)
      .filter((def) => def.shape === "stmt")
      .map((def): BlockMenuEntry => {
        const missing =
          (def.requires === "loop" && !here.loop) || (def.requires === "function" && !here.fn);
        const entry: BlockMenuEntry = {
          id: def.key,
          label: [{ text: blockText(def.key, "label") }],
          notation: notationWithHints(def.create() as Stmt),
          help: blockText(def.key, "help"),
          create: () => def.create() as Stmt,
          caret: 0,
        };
        if (missing && def.requires) entry.disabled = t(`menu.requires.${def.requires}`);
        return entry;
      });
    if (entries.length > 0) {
      groups.push({ id: category, title: t(`menu.category.${category}`), entries });
    }
  }
  const calls = callableFunctions(program).map((fn): BlockMenuEntry => {
    return {
      id: `call:${fn.name}`,
      label: functionLabel(fn),
      help: blockText("call", "help"),
      create: () => callStatement(fn),
      caret: callText(fn).caret,
    };
  });
  if (calls.length > 0) groups.push({ id: "program", title: t("menu.program"), entries: calls });
  return groups;
}

/** The text that a choice of a call of `fn` writes, and its caret: `greet()`. */
function callText(fn: LineFunction): Written {
  const call = callExpr(fn);
  if (!call) throw new Error(`"${fn.name}" is no function of the program`);
  return slotChoice(call);
}

/** A statement calling `fn` of `program`, its slot holding the text a choice of the call writes. */
function callStatement(fn: LineFunction): Stmt {
  const statement = getBlockDef("expr").create() as Extract<Stmt, { type: "expr" }>;
  return { ...statement, expr: textValue(callText(fn).text, false) };
}

/** The groups with only the entries whose label or help contains `query`. */
export function searchMenu(groups: BlockMenuGroup[], query: string): BlockMenuGroup[] {
  const q = query.trim().toLowerCase();
  if (q === "") return groups;
  return groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) =>
        [joinSpans(entry.label), entry.help].some((text) => text.toLowerCase().includes(q)),
      ),
    }))
    .filter((group) => group.entries.length > 0);
}
