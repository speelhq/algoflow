// The node editor: a popover anchored to the selected node with the node's name field and
// its Duplicate and Delete icons, the block's sentence with its slots editable in place
// (names as fields, expressions as value lines, lists of values, texts as inputs), the list of
// the focused slot, and the explanation line. Reads slot roles
// and the blocks' menu entries, never a kind.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { getChallenge } from "@/challenges";
import { errorText, t, type MessageKey } from "@/i18n/t";
import {
  duplicateStmt,
  hoistAssign,
  removeItem,
  removeStmt,
  setExpr,
  setSlot,
  setStmtName,
} from "@/lang/edit";
import { variableKinds } from "@/lang/kinds";
import { visibleAt } from "@/lang/scope";
import type { Diagnostic, Expr, Kind, NodeId, Program, Stmt, Target } from "@/lang/types";
import { validate } from "@/lang/validate";
import { allStmts, isEmptyExpr, isExpr, nodesById, ownerStmts } from "@/lang/walk";
import { cn } from "@/lib/utils";
import { getNode, keyOf } from "@/nodes";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import {
  capitaliseParts,
  exprPieces,
  exprText,
  joinParts,
  nodeText,
  sentenceParts,
  templateOf,
} from "@/ui/chart/text";
import { atInput, choose, kindBefore, press, type LineState } from "@/ui/expression/keys";
import {
  empty,
  find,
  firstEmpty,
  inputAt,
  lineOf,
  numberText,
  replace,
  retag,
  type Caret,
} from "@/ui/expression/line";
import {
  afterGroups,
  allGroups,
  closest,
  entryRows,
  kindsOf,
  matches,
  valueGroups,
  type Group,
  type Row,
} from "@/ui/expression/list";
import { ListView, type Item, type Section } from "@/ui/expression/ListView";
import { ValueLine } from "@/ui/expression/ValueLine";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { CopyIcon, Trash2Icon } from "lucide-react";
import { Popover, PopoverTrigger } from "@/ui/primitives/popover";
import { apply } from "./edits";
import { firstSetIn, nameChars, nameList } from "./names";

type Bag = Record<string, unknown>;

/** The diagnostics nodes show, by statement: no empty slot, whose placeholder is its mark. */
export function flaggedStatements(program: Program): Map<NodeId, Diagnostic[]> {
  const owners = ownerStmts(program);
  const flagged = new Map<NodeId, Diagnostic[]>();
  for (const d of validate(program)) {
    if (d.code === "E_EMPTY_SLOT") continue;
    const owner = owners.get(d.nodeId) ?? d.nodeId;
    flagged.set(owner, [...(flagged.get(owner) ?? []), d]);
  }
  return flagged;
}

/** The diagnostics node `id` shows. */
export function nodeDiagnostics(program: Program, id: NodeId): Diagnostic[] {
  return flaggedStatements(program).get(id) ?? [];
}

/** The same diagnostic in another validation of the program: same node, code, and params. */
function sameDiagnostic(a: Diagnostic, b: Diagnostic): boolean {
  return (
    a.nodeId === b.nodeId &&
    a.code === b.code &&
    JSON.stringify(a.params) === JSON.stringify(b.params)
  );
}

/** Applies a diagnostic's fix; only the fixes validation names exist. */
export function applyFix(diagnostic: Diagnostic): void {
  if (diagnostic.fix !== "hoistAssign") return;
  const { frame, name } = diagnostic.params;
  if (typeof frame === "string" && typeof name === "string") {
    apply((program) => hoistAssign(program, frame, name));
  }
}

/** A diagnostic's message, with the button applying its fix when it has one. */
export function DiagnosticMessage({ diagnostic }: { diagnostic: Diagnostic }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-2"
      role="alert"
    >
      <span className="flex-1 text-destructive">{errorText(diagnostic)}</span>
      {diagnostic.fix && (
        <Button size="sm" variant="outline" onClick={() => applyFix(diagnostic)}>
          {t(`editor.fix.${diagnostic.fix}` as "editor.fix.hoistAssign", diagnostic.params)}
        </Button>
      )}
    </div>
  );
}

/** The name in an `id` slot, or in a `target` slot holding a variable. */
function nameOf(stmt: Stmt, slot: string): string | undefined {
  const role = getNode(keyOf(stmt)).slots.find((s) => s.name === slot)?.role;
  if (role !== "id" && role !== "target") return undefined;
  const value = (stmt as unknown as Bag)[slot];
  if (typeof value === "string") return value;
  const target = value as Target | undefined;
  return target?.kind === "var" ? target.name : undefined;
}

function setName(program: Program, stmt: Stmt, slot: string, name: string): Program {
  const role = getNode(keyOf(stmt)).slots.find((s) => s.name === slot)?.role;
  return setSlot(program, stmt.id, slot, role === "target" ? { kind: "var", name } : name);
}

/** The node's name field with `Duplicate` and `Delete` as icon buttons beside it. */
function NameRow({ stmt }: { stmt: Stmt }) {
  const select = useEditor((s) => s.select);
  // The field keeps what is typed; the program keeps it as one trimmed line.
  const [draft, setDraft] = useState(stmt.name ?? "");
  return (
    <div className="flex items-center gap-2">
      <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5">
        <span className="text-xs tracking-wide text-muted-foreground uppercase">
          {t("editor.name")}
        </span>
        <input
          value={draft}
          placeholder={t("editor.nameHint")}
          data-testid="node-name"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setDraft(event.target.value);
            apply((p) => setStmtName(p, stmt.id, event.target.value), `${stmt.id}:name`);
          }}
        />
      </label>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("editor.duplicate")}
        title={t("editor.duplicate")}
        onClick={() => apply((p) => duplicateStmt(p, stmt.id))}
      >
        <CopyIcon />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("editor.delete")}
        title={t("editor.delete")}
        onClick={() => {
          if (apply((p) => removeStmt(p, stmt.id))) select(null);
        }}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}

/** Where the keyboard is: a name slot, or one value line (an item of an `exprs` slot by index). */
type Focus = { slot: string; index?: number };

/** What a value line keeps between keys: everything of its state but the expression itself. */
type Typing = {
  caret: Caret;
  draft: string;
  pending: LineState["pending"];
  message?: MessageKey;
  /** The whole value is selected, as a field entered by Tab is: typing replaces it. */
  select?: boolean;
};

/** The chart a statement is in: a function's id, or `main`. */
function chartOf(program: Program, id: NodeId): NodeId | "main" {
  for (const fn of program.functions) {
    for (const stmt of allStmts(fn.body)) if (stmt.id === id) return fn.id;
  }
  return "main";
}

/** The value line's root at `focus`, if the slot holds an expression there. */
function rootAt(stmt: Stmt, focus: Focus | null): Expr | undefined {
  if (!focus) return undefined;
  const value = (stmt as unknown as Bag)[focus.slot];
  const item =
    focus.index === undefined ? value : Array.isArray(value) ? value[focus.index] : undefined;
  return isExpr(item) ? item : undefined;
}

/** The slots of the sentence that take the keyboard, in the order it shows them. */
function slotOrder(stmt: Stmt, program: Program): Focus[] {
  const def = getNode(keyOf(stmt));
  const out: Focus[] = [];
  for (const found of templateOf(stmt, program).matchAll(/\{(\w+)\}/g)) {
    const slot = def.slots.find((s) => s.name === found[1]);
    if (!slot) continue;
    const value = (stmt as unknown as Bag)[slot.name];
    if (slot.role === "exprs" && Array.isArray(value)) {
      value.forEach((_, index) => out.push({ slot: slot.name, index }));
    } else if (slot.role === "expr" || nameOf(stmt, slot.name) !== undefined) {
      out.push({ slot: slot.name });
    }
  }
  return out;
}

/** Whether the slot at `focus` is still to fill: an empty name, or a value with an empty input. */
function unfilled(stmt: Stmt, focus: Focus): boolean {
  const held = rootAt(stmt, focus);
  return held ? firstEmpty(held) !== undefined : nameOf(stmt, focus.slot) === "";
}

/** Whether `node` is a text value, typed into a field: its one slot is a `text` slot. */
function isTextValue(node: Expr): boolean {
  const slots = getNode(keyOf(node)).slots;
  return numberText(node) === undefined && slots.length === 1 && slots[0]?.role === "text";
}

/** The explanation line: a bold head and its text. */
function Explain({ head, children }: { head?: ReactNode; children: ReactNode }) {
  return (
    <div
      className="-mx-2.5 -mb-2.5 flex items-baseline gap-2.5 rounded-b-lg border-t bg-muted/40 px-2.5 py-2"
      data-testid="explanation"
    >
      {head !== undefined && <span className="font-bold whitespace-nowrap">{head}</span>}
      <span>{children}</span>
    </div>
  );
}

function Body({
  stmt,
  program,
  initial,
}: {
  stmt: Stmt;
  program: Program;
  initial: string | null;
}) {
  const def = getNode(keyOf(stmt));
  const bag = stmt as unknown as Bag;
  const led = useEditor((s) => s.diagnostic);
  const closeEditor = useEditor((s) => s.closeEditor);
  const lines = useRef<Record<string, HTMLDivElement | null>>({});
  const names = useRef<Record<string, HTMLInputElement | null>>({});

  const firstSlot = def.slots.find((slot) => slot.role !== "body" && slot.role !== "text");
  const [focus, setFocus] = useState<Focus | null>(() => {
    // Opened from the node's words, the editor starts at the first slot still to fill.
    const toFill =
      initial === null ? slotOrder(stmt, program).find((f) => unfilled(stmt, f)) : null;
    if (toFill) return toFill;
    const name = initial ?? firstSlot?.name;
    if (!name) return null;
    const value = bag[name];
    return Array.isArray(value) ? { slot: name, index: 0 } : { slot: name };
  });
  // A finished value the editor opens on is selected, so typing replaces it.
  const [typing, setTyping] = useState<Typing | null>(() => {
    const opened = rootAt(stmt, focus);
    return opened && !firstEmpty(opened)
      ? { caret: { at: opened.id, groups: [] }, draft: "", pending: "", select: true }
      : null;
  });
  const [text, setText] = useState<{ at: NodeId; value: string } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [switching, setSwitching] = useState<NodeId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [typedName, setTypedName] = useState<string | undefined>(undefined);

  const chart = chartOf(program, stmt.id);
  const kinds = variableKinds(program, chart);
  const visible = useMemo(() => visibleAt(program, stmt.id) ?? [], [program, stmt.id]);
  const challenge = getChallenge(program.challengeId);
  const asked = Object.keys(challenge?.tests[0]?.expect.variables ?? {});
  const focusKey = focus ? `${focus.slot}:${focus.index ?? ""}` : "";

  // The slot clicked on the node, or a first slot still to fill (a block just inserted), has
  // the keyboard when the editor opens; otherwise it stays with the chart, so Delete and
  // Backspace still remove the node.
  useEffect(() => {
    if (!focus) return;
    if (initial === null && !unfilled(stmt, focus)) return;
    const key = `${focus.slot}:${focus.index ?? ""}`;
    (lines.current[key] ?? names.current[focus.slot])?.focus();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only when the editor opens
  }, []);

  const diagnostics = nodeDiagnostics(program, stmt.id);
  const still = led ? validate(program).find((d) => sameDiagnostic(d, led)) : undefined;
  if (still && (ownerStmts(program).get(still.nodeId) ?? still.nodeId) === stmt.id) {
    if (!diagnostics.includes(still)) diagnostics.unshift(still);
  }

  // ------------------------------------------------------------ the focused value line

  const root = rootAt(stmt, focus);
  const known = root && typing && find(root, typing.caret.at) ? typing : null;
  const selected = known?.select === true;
  const state: LineState | null = root
    ? {
        line: { root, caret: known?.caret ?? lineOf(root).caret },
        draft: known?.draft ?? "",
        pending: known?.pending ?? "",
        ...(known?.message ? { message: known.message } : {}),
      }
    : null;

  const variables = visible.map((name) => {
    const of = kinds.get(name);
    return of ? { name, of } : { name };
  });
  const groups: Group[] = !state
    ? []
    : showAll
      ? allGroups(program, !atInput(state))
      : atInput(state)
        ? valueGroups(program, variables)
        : afterGroups(kindBefore(state, kinds));
  const searched = state && state.draft !== "";
  const searchGroups =
    state && atInput(state) ? valueGroups(program, variables) : afterGroups(undefined);
  // After a value, the entries for its kind come first among equally good matches.
  const kindBeforeCaret = state && !atInput(state) ? kindBefore(state, kinds) : undefined;
  const found = searched
    ? matches(
        searchGroups,
        state.draft,
        (row) =>
          kindBeforeCaret === undefined ||
          (row.type === "entry" && kindsOf(row).includes(kindBeforeCaret)),
      )
    : [];
  const switchRows = switching && root ? switchRowsFor(root, switching) : [];
  const rows: Row[] = switching ? switchRows : searched ? found : groups.flatMap((g) => g.rows);

  /** Puts `next` in the program and keeps its caret and word. */
  const commit = (next: LineState) => {
    if (!focus || !root) return;
    if (next.line.root !== root) {
      const at = focus;
      apply(
        (p) => setExpr(p, stmt.id, at.slot, next.line.root, at.index),
        `${stmt.id}:${at.slot}:${at.index ?? ""}`,
      );
    }
    setTyping({
      caret: next.line.caret,
      draft: next.draft,
      pending: next.pending,
      ...(next.message ? { message: next.message } : {}),
    });
    setHighlight(next.draft !== "" ? null : highlight);
    // A text value opens its field.
    const at = find(next.line.root, next.line.caret.at)?.node;
    if (at && at !== find(root, next.line.caret.at)?.node && isTextValue(at)) {
      const slot = getNode(keyOf(at)).slots[0]?.name ?? "";
      const value = (at as unknown as Bag)[slot];
      setText({ at: at.id, value: typeof value === "string" ? value : "" });
    }
  };

  const chooseRow = (row: Row) => {
    if (!state) return;
    const next =
      switching && row.type === "entry" && row.preset
        ? { ...state, line: retag(state.line, switching, row.preset) }
        : choose(state, row);
    commit(next);
    setSwitching(null);
    setShowAll(false);
    setHighlight(null);
    // A text value chosen keeps the keyboard in its field; anything else returns it to the line.
    const at = find(next.line.root, next.line.caret.at)?.node;
    if (!(at && isTextValue(at))) lines.current[focusKey]?.focus();
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!state || !focus) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key === "Tab" && event.shiftKey ? "ShiftTab" : event.key;
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      const ids = rows.map((row) => row.id);
      const at = highlight ? ids.indexOf(highlight) : -1;
      const next = key === "ArrowDown" ? Math.min(at + 1, ids.length - 1) : Math.max(at - 1, 0);
      setHighlight(ids[next] ?? null);
      return;
    }
    const chosen = highlight ? rows.find((row) => row.id === highlight) : undefined;
    if (key === "Enter" && chosen) {
      event.preventDefault();
      chooseRow(chosen);
      return;
    }
    if (key === "Escape") return;
    setSwitching(null);
    // A selected value is replaced by what is typed, and removed by Backspace.
    let from = state;
    if (selected && /^([0-9.A-Za-z_(-]|Backspace|Delete)$/.test(key)) {
      const hole = empty();
      from = { ...state, line: { root: hole, caret: { at: hole.id, groups: [] } } };
      if (key === "Backspace" || key === "Delete") {
        event.preventDefault();
        commit(from);
        return;
      }
    }
    const ordered = chosen ? [chosen, ...rows.filter((row) => row !== chosen)] : rows;
    const outcome = press(from, key, ordered, kinds, Array.isArray(bag[focus.slot]));
    if ("unhandled" in outcome) return;
    event.preventDefault();
    if ("close" in outcome) closeEditor();
    else if ("nextItem" in outcome) addItem(focus.slot);
    else if (
      (key === "Tab" || key === "ShiftTab") &&
      outcome.state.line.caret.at === from.line.caret.at
    ) {
      // With no field left in the line, Tab goes on to the next slot of the sentence.
      if (!step(key === "Tab" ? 1 : -1)) commit(outcome.state);
    } else commit(outcome.state);
  };

  const order = () => slotOrder(stmt, program);

  /** Gives the keyboard to `next`, selecting the value it holds. */
  const enter = (next: Focus) => {
    setFocus(next);
    setSwitching(null);
    setShowAll(false);
    setHighlight(null);
    const held = rootAt(stmt, next);
    // A value with an input still to fill opens at that input instead (null: the line's start).
    setTyping(
      held && !firstEmpty(held)
        ? { caret: { at: held.id, groups: [] }, draft: "", pending: "", select: true }
        : null,
    );
    const key = `${next.slot}:${next.index ?? ""}`;
    // The slot's field exists already, unless it was just added: then it is focused once drawn.
    const element = lines.current[key] ?? names.current[next.slot];
    if (element) element.focus();
    else requestAnimationFrame(() => (lines.current[key] ?? names.current[next.slot])?.focus());
  };

  /** Moves the keyboard to the next (`1`) or previous (`-1`) slot; false when there is none. */
  const step = (direction: 1 | -1): boolean => {
    const all = order();
    const at = all.findIndex((f) => f.slot === focus?.slot && f.index === focus?.index);
    const next = all[at + direction];
    if (!next) return false;
    enter(next);
    return true;
  };

  // ------------------------------------------------------------ slots

  const addItem = (slot: string) => {
    const items = Array.isArray(bag[slot]) ? (bag[slot] as unknown[]) : [];
    const hole = empty();
    if (apply((p) => setExpr(p, stmt.id, slot, hole, items.length))) {
      setFocus({ slot, index: items.length });
      setTyping(null);
      requestAnimationFrame(() => lines.current[`${slot}:${items.length}`]?.focus());
    }
  };

  const valueLine = (slot: string, expr: Expr, index?: number) => {
    const key = `${slot}:${index ?? ""}`;
    const active = focusKey === key;
    const lineState: LineState =
      active && state ? state : { line: lineOf(expr), draft: "", pending: "" };
    return (
      <ValueLine
        key={key}
        state={lineState}
        active={active}
        text={active ? text : null}
        register={(element) => {
          lines.current[key] = element;
        }}
        testId={`line-${slot}${index === undefined ? "" : `-${index}`}`}
        selected={active && selected}
        onFocus={() => {
          if (!active) enter(index === undefined ? { slot } : { slot, index });
        }}
        onKey={onKey}
        onCaret={(id) => {
          setFocus(index === undefined ? { slot } : { slot, index });
          setTyping({ caret: { at: id, groups: [] }, draft: "", pending: "" });
          setSwitching(null);
          lines.current[key]?.focus();
        }}
        onSwitch={(id) => {
          setFocus(index === undefined ? { slot } : { slot, index });
          setSwitching(id);
          setHighlight(null);
          lines.current[key]?.focus();
        }}
        onText={(value) => {
          if (!text || !root) return;
          setText({ ...text, value });
          const node = find(root, text.at)?.node;
          const field = node ? getNode(keyOf(node)).slots[0]?.name : undefined;
          if (!node || !field) return;
          const next = replace(root, text.at, { ...node, [field]: value } as Expr);
          const at = focus;
          if (at) {
            apply(
              (p) => setExpr(p, stmt.id, at.slot, next, at.index),
              `${stmt.id}:${at.slot}:${at.index ?? ""}:text`,
            );
          }
        }}
        onTextDone={() => {
          setText(null);
          lines.current[key]?.focus();
        }}
      />
    );
  };

  const nameField = (slot: string) => {
    const current = nameOf(stmt, slot);
    if (current === undefined) return null;
    return (
      <Input
        key={slot}
        ref={(element) => {
          names.current[slot] = element;
        }}
        value={current}
        aria-label={slot}
        data-name-slot={slot}
        className={cn(
          "h-8 w-32 font-bold text-variable",
          focus?.slot === slot && "border-selection",
        )}
        onFocus={() => {
          setFocus({ slot });
          setTypedName(undefined);
          setHighlight(null);
        }}
        onChange={(event) => {
          const name = nameChars(event.target.value);
          setTypedName(name);
          setHighlight(null);
          apply((p) => setName(p, stmt, slot, name), `${stmt.id}:${slot}`);
        }}
        onKeyDown={(event) => {
          const ids = nameRows.map((row) => row.id);
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const at = highlight ? ids.indexOf(highlight) : -1;
            const next =
              event.key === "ArrowDown" ? Math.min(at + 1, ids.length - 1) : Math.max(at - 1, 0);
            setHighlight(ids[next] ?? null);
          } else if (event.key === "Enter") {
            event.preventDefault();
            // The highlighted row, else the name typed (new or not); an untouched field keeps
            // its name and the next slot takes the keyboard.
            const typed = typedName ?? "";
            const id =
              highlight ??
              ids.find((row) => row === `new:${typed}` || row === `name:${typed}`) ??
              (typed === "" ? undefined : ids[0]);
            if (id) chooseName(slot, id);
            else if (!step(1)) closeEditor();
          }
        }}
      />
    );
  };

  const widget = (name: string): ReactNode => {
    const slot = def.slots.find((s) => s.name === name);
    if (!slot) return null;
    const value = bag[name];
    switch (slot.role) {
      case "id":
      case "target":
        return nameField(name);
      case "text":
        return (
          <Input
            key={name}
            value={typeof value === "string" ? value : ""}
            aria-label={name}
            className="h-8 w-48"
            onChange={(event) =>
              apply((p) => setSlot(p, stmt.id, name, event.target.value), `${stmt.id}:${name}`)
            }
          />
        );
      case "expr":
        return isExpr(value) ? (
          valueLine(name, value)
        ) : (
          <button
            key={name}
            type="button"
            className="h-7 cursor-pointer rounded-md border border-dashed px-2.5 text-sm text-muted-foreground hover:bg-muted"
            onClick={() => {
              if (apply((p) => setExpr(p, stmt.id, name, empty()))) enter({ slot: name });
            }}
          >
            {t("editor.addValue")}
          </button>
        );
      case "exprs": {
        const items = Array.isArray(value) ? value.filter(isExpr) : [];
        return (
          <span key={name} className="inline-flex flex-wrap items-center gap-1">
            {items.map((item, index) => (
              <span key={item.id} className="inline-flex items-center gap-0.5">
                {index > 0 && <span>,</span>}
                {valueLine(name, item, index)}
                <button
                  type="button"
                  aria-label={t("editor.removeValue")}
                  className="size-5 cursor-pointer rounded-full text-muted-foreground hover:bg-muted"
                  onClick={() => {
                    if (apply((p) => removeItem(p, stmt.id, name, index))) {
                      setFocus(null);
                      setTyping(null);
                    }
                  }}
                >
                  {t("editor.removeGlyph")}
                </button>
              </span>
            ))}
            <button
              type="button"
              className="h-7 cursor-pointer rounded-md border border-dashed px-2.5 text-sm text-muted-foreground hover:bg-muted"
              onClick={() => addItem(name)}
            >
              {t("editor.addValue")}
            </button>
          </span>
        );
      }
      default:
        return null;
    }
  };

  const template = templateOf(stmt, program);
  const sentence: ReactNode[] = [];
  let at = 0;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    const words = template.slice(at, found.index).trim();
    if (words !== "") sentence.push(<span key={`t${at}`}>{words}</span>);
    sentence.push(widget(found[1] ?? ""));
    at = found.index + found[0].length;
  }
  const tail = template.slice(at).trim();
  if (tail !== "") sentence.push(<span key="tail">{tail}</span>);

  // ------------------------------------------------------------ the name list

  const nameSlot = focus && nameOf(stmt, focus.slot) !== undefined ? focus.slot : undefined;
  const nameLists = nameSlot ? nameList(program, asked, typedName, chart, stmt.id) : undefined;
  const nameRows = nameLists
    ? [
        ...nameLists.problem.map((row) => ({ ...row, id: `name:${row.name}` })),
        ...nameLists.variables.map((row) => ({ ...row, id: `name:${row.name}` })),
        ...(nameLists.fresh ? [{ name: nameLists.fresh, id: `new:${nameLists.fresh}` }] : []),
      ]
    : [];

  const chooseName = (slot: string, id: string) => {
    const name = id.slice(id.indexOf(":") + 1);
    apply((p) => setName(p, stmt, slot, name));
    setTypedName(undefined);
    setHighlight(null);
    // The next slot of the sentence takes the keyboard.
    const all = order();
    const next = all[all.findIndex((f) => f.slot === slot) + 1];
    if (next) enter(next);
  };

  const kindNote = (of?: Kind) => (of ? t(`editor.kind.${of}` as MessageKey) : undefined);

  const sections: Section[] = nameLists
    ? [
        {
          id: "problem",
          title: t("editor.group.problem"),
          items: nameLists.problem.map((row) => ({
            id: `name:${row.name}`,
            label: row.name,
            variable: true,
            ...(row.of ? { note: kindNote(row.of) } : {}),
          })),
        },
        {
          id: "variables",
          title: t("editor.group.variables"),
          items: nameLists.variables.map((row) => ({
            id: `name:${row.name}`,
            label: row.name,
            variable: true,
            ...(row.of ? { note: kindNote(row.of) } : {}),
          })),
        },
        ...(nameLists.fresh
          ? [
              {
                id: "new",
                items: [
                  {
                    id: `new:${nameLists.fresh}`,
                    lead: t("editor.newVariable"),
                    label: nameLists.fresh,
                    variable: true,
                  },
                ],
              },
            ]
          : []),
      ].filter((section) => section.items.length > 0)
    : switching
      ? [{ id: "switch", items: switchRows.map(itemOf) }]
      : searched
        ? found.length > 0
          ? [{ id: "found", items: found.map(itemOf) }]
          : []
        : [
            ...groups.map((group) => ({
              id: group.id,
              title: group.title,
              items: group.rows.map(itemOf),
            })),
            ...(showAll || !state
              ? []
              : [
                  {
                    id: "all",
                    items: [{ id: "show-all", label: t("editor.showAll"), link: true }],
                  },
                ]),
          ];

  // ------------------------------------------------------------ the explanation line

  const rowById = (id: string | null) => (id ? rows.find((row) => row.id === id) : undefined);
  const explanation = ((): { head?: ReactNode; text: ReactNode } => {
    if (nameLists) {
      const row = nameRows.find((r) => r.id === highlight);
      if (row?.id.startsWith("new:")) {
        return { text: t("editor.explain.newVariable", { name: row.name }) };
      }
      if (row) return { head: row.name, text: aboutVariable(program, row.name, kinds) };
      return { text: t("editor.explain.name") };
    }
    if (state?.message) return { text: t(state.message) };
    if (state && searched && found.length === 0) {
      const near = closest(searchGroups, state.draft);
      return {
        text: near
          ? t("editor.didYouMean", { name: near })
          : t("editor.nothingLike", { name: state.draft }),
      };
    }
    const row = rowById(highlight) ?? (searched ? found[0] : undefined);
    if (row?.type === "variable") {
      return { head: row.name, text: aboutVariable(program, row.name, kinds) };
    }
    if (row?.type === "entry") return { head: row.label, text: row.help };
    if (row?.type === "brackets") return { head: row.label, text: t("editor.bracketsHelp") };
    const inside = state ? inputAt(state.line) : undefined;
    if (inside && isEmptyExpr(inside.input)) {
      return {
        head: labelOf(inside.operation),
        text: <Underlined operation={inside.operation} input={inside.input} />,
      };
    }
    return { text: nodeText(def.key, "help") };
  })();

  return (
    <div className="flex flex-col gap-2.5" data-testid="node-editor" data-node={stmt.id}>
      {diagnostics.map((d, i) => (
        // oxlint-disable-next-line react/no-array-index-key -- diagnostics have no id of their own
        <DiagnosticMessage key={i} diagnostic={d} />
      ))}
      <NameRow stmt={stmt} />
      <div className="-mx-2.5 border-t" />
      <div
        className="flex flex-wrap items-center gap-1.5 text-[0.95rem]"
        data-testid="editor-sentence"
      >
        {sentence}
      </div>
      {(nameLists || state) && (
        <>
          <div className="-mx-2.5 border-t" />
          <ListView
            sections={sections}
            highlight={highlight}
            onHover={setHighlight}
            onChoose={(id) => {
              if (id === "show-all") {
                setShowAll(true);
                lines.current[focusKey]?.focus();
                return;
              }
              if (nameSlot) {
                chooseName(nameSlot, id);
                return;
              }
              const row = rows.find((r) => r.id === id);
              if (row) chooseRow(row);
            }}
          />
        </>
      )}
      <Explain head={explanation.head}>{explanation.text}</Explain>
    </div>
  );
}

/** A list row as the list view draws it. */
function itemOf(row: Row): Item {
  if (row.type === "variable") {
    const note = row.of ? t(`editor.kind.${row.of}` as MessageKey) : undefined;
    return { id: row.id, label: row.name, variable: true, ...(note ? { note } : {}) };
  }
  if (row.type === "brackets") return { id: row.id, label: row.label, symbol: "( )" };
  return { id: row.id, label: row.label, ...(row.symbol ? { symbol: row.symbol } : {}) };
}

/** The entries an operator can be switched to: those of its block in its own group. */
function switchRowsFor(root: Expr, id: NodeId): Row[] {
  const node = find(root, id)?.node;
  if (!node) return [];
  const key = keyOf(node);
  const bag = node as unknown as Bag;
  const own = entryRows().filter((row) => row.id.startsWith(`${key}:`) && row.preset);
  const current = own.find((row) =>
    Object.entries(row.preset ?? {}).every(([slot, value]) => bag[slot] === value),
  );
  return current ? own.filter((row) => row.group === current.group && row !== current) : [];
}

/** An operation's label: its entry's when its preset matches, else its block's. */
function labelOf(operation: Expr): string {
  const key = keyOf(operation);
  const bag = operation as unknown as Bag;
  const entry = entryRows().find(
    (row) =>
      row.id.startsWith(`${key}:`) &&
      Object.entries(row.preset ?? {}).every(([slot, value]) => bag[slot] === value),
  );
  return entry?.label ?? nodeText(key, "label");
}

/** An operation's text with the input the caret is in underlined. */
function Underlined({ operation, input }: { operation: Expr; input: Expr }) {
  return (
    <span>
      {exprPieces(operation).map((piece, i) =>
        "child" in piece ? (
          piece.child.id === input.id ? (
            // oxlint-disable-next-line react/no-array-index-key -- pieces are positional
            <u key={i}>{t("chart.blank")}</u>
          ) : (
            // oxlint-disable-next-line react/no-array-index-key -- pieces are positional
            <span key={i}>
              {isEmptyExpr(piece.child) ? t("chart.blank") : exprText(piece.child)}
            </span>
          )
        ) : (
          // oxlint-disable-next-line react/no-array-index-key -- pieces are positional
          <span key={i} className={cn(piece.variable && "font-bold")}>
            {piece.text}
          </span>
        ),
      )}
    </span>
  );
}

/** What the explanation line says of a variable: its kind and where it is first set. */
function aboutVariable(program: Program, name: string, kinds: ReadonlyMap<string, Kind>): string {
  const of = kinds.get(name);
  const kind = of ? t(`editor.kind.${of}` as MessageKey) : "";
  if (program.inputs.some((input) => input.name === name)) {
    return t("editor.explain.input", { kind });
  }
  const first = firstSetIn(program, name);
  if (!first) return t("editor.explain.parameter");
  const where = joinParts(capitaliseParts(sentenceParts(first, program)));
  return of
    ? t("editor.explain.variable", { kind, sentence: where })
    : t("editor.explain.variablePlain", { sentence: where });
}

/** The editor of statement `id`, anchored to the element it is rendered in. */
export function NodeEditor({ id }: { id: NodeId }) {
  const program = useProgram((s) => s.program);
  const slot = useEditor((s) => s.slot);
  const select = useEditor((s) => s.select);
  const closeEditor = useEditor((s) => s.closeEditor);
  const [boundary, setBoundary] = useState<Element | null>(null);
  const node = nodesById(program).get(id);
  if (!node || !("kind" in node) || getNode(keyOf(node)).shape !== "stmt") return null;
  return (
    <Popover
      open
      onOpenChange={(open, details) => {
        if (open) return;
        if (details.reason === "escape-key") select(null);
        else closeEditor();
      }}
    >
      <PopoverTrigger
        render={
          <div
            ref={(element) => setBoundary(element?.closest("[data-chart-region]") ?? null)}
            className="pointer-events-none size-full"
            aria-hidden
          />
        }
      />
      {/* Beside the node and inside the chart region, so the panel's statement stays readable. */}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="right"
          align="start"
          sideOffset={8}
          collisionBoundary={boundary ?? "clipping-ancestors"}
          collisionPadding={8}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            className="z-50 flex w-116 flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden"
            aria-label={t("editor.label")}
            // Focus stays on the chart, so the editing keys act on the selected node.
            initialFocus={false}
            finalFocus={false}
          >
            <Body
              key={`${id}:${slot ?? ""}`}
              stmt={node as Stmt}
              program={program}
              initial={slot}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </Popover>
  );
}
