// The node editor: a popover beside the selected node holding the node's name field
// with `Duplicate` and `Delete`, the block's notation with its slots editable in place (names
// as name fields, values as value lines, lists of values with add and remove), the list of
// the focused slot, and the explanation line. Reads slot roles, never a kind. The editing state
// is a session (`session.ts`) that only its transitions change.
import { Copy, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { getChallenge } from "@/challenges";
import { nodeText, t } from "@/i18n/t";
import { duplicateStmt, insertItem, removeItem, removeStmt, setExpr } from "@/lang/edit";
import { chartOf, variableKinds } from "@/lang/kinds";
import { visibleAt } from "@/lang/scope";
import type { Expr, NodeId, Program, Stmt } from "@/lang/types";
import { isExpr, nodesById } from "@/lang/walk";
import { cn } from "@/lib/utils";
import { emptyExpr, getNode, keyOf } from "@/nodes/registry";
import { parseScope } from "@/python/parse";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { joinParts, placeholderValue, slotParts } from "@/ui/chart/text";
import { Button } from "@/ui/primitives/button";
import { Popover } from "@/ui/primitives/popover";
import { DiagnosticMessage, editorDiagnostics } from "./diagnostics";
import { apply } from "./edits";
import { EditorList } from "./EditorList";
import { explainLine, explainVariable, helpParts, type Explanation } from "./explain";
import {
  editedLines,
  fieldKey,
  fieldLabel,
  fieldPath,
  fieldsOf,
  firstPart,
  formIn,
  formOfKey,
  formsFor,
  nameOf,
  namePart,
  sameField,
  setForm,
  setName,
  setVariable,
  startField,
  targetPieces,
  valueOf,
  wordsAfter,
  type Field,
} from "./fields";
import { callableFunctions, lineTakes, matches, openLine, setText, type LineContext } from "./line";
import { NameOfNode } from "./NameOfNode";
import { nameChars, type FormOf, type NameRow } from "./names";
import { nameList, shownNameRow, valueList } from "./rows";
import {
  chooseRow,
  clickInLine,
  commit,
  focusField,
  follow,
  highlightRow,
  leaveName,
  openSession,
  settleWord,
  shownHighlight,
  showAll,
  stepHighlight,
  textEnded,
  typeName,
  valueKey,
  type Click,
  type Session,
  type Step,
} from "./session";
import { AddValue, NameField, ValueItems } from "./slots";
import { ValueLine } from "./ValueLine";
import { EDITOR_GAP, EDITOR_WIDTH } from "./size";

type Initial = { slot: string | null; hole: NodeId | null };

function Body({ stmt, program, initial }: { stmt: Stmt; program: Program; initial: Initial }) {
  const def = getNode(keyOf(stmt));
  const led = useEditor((s) => s.diagnostic);
  const select = useEditor((s) => s.select);
  const closeEditor = useEditor((s) => s.closeEditor);
  const fields = fieldsOf(stmt);
  const elements = useRef(new Map<string, HTMLElement | null>());
  const [kept, setSession] = useState(() =>
    openSession(stmt, startField(stmt, fields, initial), initial.hole),
  );
  // A value changed elsewhere (an undo) reopens the line on it.
  const session = follow(kept, stmt);
  if (session !== kept) setSession(session);
  const { focus, line } = session;
  const [focused, setFocused] = useState<Field | null>(null);

  // The focused field takes the keyboard once it is drawn.
  useEffect(() => {
    if (focus && !sameField(focus, focused)) elements.current.get(fieldKey(focus))?.focus();
  }, [focus, focused]);

  const chart = chartOf(program, stmt.id);
  const kinds = variableKinds(program, chart);
  const ctx: LineContext = useMemo(
    () => ({
      variables: visibleAt(program, stmt.id) ?? [],
      kinds,
      scope: parseScope(program),
      functions: callableFunctions(program),
    }),
    [program, stmt.id, kinds],
  );
  const diagnostics = editorDiagnostics(program, stmt.id, led);

  // ------------------------------------------------------------ steps

  /** The statement as the program holds it now, after the edits applied so far. */
  const current = () => nodesById(useProgram.getState().program).get(stmt.id) as Stmt | undefined;

  /** Writes a step's values into the program and keeps the session it leaves. */
  const run = (step: Step): Session => {
    for (const { field, root } of step.edits) {
      const at = `${stmt.id}:${fieldKey(field)}`;
      apply((p) => setExpr(p, stmt.id, fieldPath(field), root, field.index), at);
    }
    setSession(step.session);
    return step.session;
  };

  /** Moves the keyboard to `field` from `from`; a word naming a row exactly is chosen first. */
  const enter = (from: Session, field: Field | null, clicked: Click | null): Session => {
    const settled = run(settleWord(from, ctx));
    const now = current();
    const next = now ? focusField(settled, now, field, clicked) : settled;
    setSession(next);
    return next;
  };

  /** Leaves `field` for the next or previous field of the notation, as the statement is now. */
  const go = (from: Session, step: 1 | -1, field: Field | null): void => {
    const now = fieldsOf(current() ?? stmt);
    const at = field ? now.findIndex((each) => sameField(each, field)) : -1;
    const next = now[at + step];
    if (next) enter(from, next, null);
  };

  /** Adds a value to a slot: an optional value, or an item at `at` of a list (the end when null). */
  const addItem = (from: Session, slot: string, at: number | null) => {
    const empty = emptyExpr();
    const itemsOf = (node: Stmt | undefined): unknown =>
      node ? (node as unknown as Record<string, unknown>)[slot] : undefined;
    const list = def.slots.find((s) => s.name === slot)?.role === "exprs";
    const added = (p: Program): Program => {
      if (!list) return setExpr(p, stmt.id, slot, empty);
      const items = itemsOf(nodesById(p).get(stmt.id) as Stmt | undefined);
      const end = Array.isArray(items) ? items.length : 0;
      return insertItem(p, stmt.id, slot, at ?? end, empty);
    };
    if (!apply(added)) return;
    const items = itemsOf(current());
    const index = Array.isArray(items)
      ? items.findIndex((item) => isExpr(item) && item.id === empty.id)
      : -1;
    enter(from, { slot, role: "expr", ...(list ? { index } : {}) }, null);
  };

  // ------------------------------------------------------------ the value line

  const values = focus?.role === "expr" ? valueList(session, ctx) : { rows: [], sections: [] };

  const onValueKey = (event: KeyboardEvent<HTMLDivElement>) => {
    // Keys typed in a text field inside the line are the field's.
    if (event.target instanceof HTMLInputElement || !lineTakes(event)) return;
    const next = focus ? wordsAfter(stmt, focus) : "";
    const result = valueKey(session, event, values.rows, ctx, next);
    if (!result.taken) return;
    event.preventDefault();
    const left = run(result);
    const { after } = result;
    if (after === "close") closeEditor();
    else if (after === "variable") {
      const slot = left.focus?.slot;
      if (slot === undefined) return;
      apply((p) => setVariable(p, stmt, slot));
      enter(left, { slot, role: "target" }, null);
    } else if (after && "go" in after) go(left, after.go, left.focus);
    else if (after && left.focus) addItem(left, left.focus.slot, after.addItem);
  };

  const register = (field: Field) => (element: HTMLElement | null) => {
    elements.current.set(fieldKey(field), element);
  };

  const lineWidget = (field: Field, root: Expr): ReactNode => {
    const on = sameField(focus, field) && line !== null;
    const shown = on ? line : null;
    return (
      <ValueLine
        key={fieldKey(field)}
        ref={register(field)}
        root={root}
        line={shown}
        label={fieldLabel(stmt, field)}
        unmatched={shown !== null && shown.word !== "" && matches(shown, ctx).length === 0}
        onKey={onValueKey}
        onFocus={() => {
          setFocused(field);
          if (!sameField(focus, field)) enter(session, field, null);
        }}
        onClickAt={(id, op) => {
          if (sameField(focus, field)) setSession(clickInLine(session, { id, op }));
          else enter(session, field, { id, op });
        }}
        onText={(id, text) => run(commit(session, setText(line ?? openLine(root), id, text)))}
        onTextEnd={(key) => {
          // The line takes the keyboard back first: the text field's blur ends it once more.
          if (key !== "blur") elements.current.get(fieldKey(field))?.focus();
          const result = textEnded(session, key, ctx);
          const next = run(result);
          const { after } = result;
          if (typeof after === "object" && "go" in after) go(next, after.go, next.focus);
        }}
      />
    );
  };

  // ------------------------------------------------------------ names

  const asked = Object.keys(getChallenge(program.challengeId)?.tests[0]?.expect.variables ?? {});
  // A target can be set to a form of a variable visible here (`editor.md`, Name fields).
  const forms: FormOf[] =
    focus?.role === "target"
      ? ctx.variables.flatMap((name) => formsFor(kinds.get(name)).map((form) => ({ form, name })))
      : [];
  const names = nameList(program, asked, session.typed, kinds, forms);

  const chooseName = (field: Field, row: NameRow) => {
    if (row.kind === "form") {
      apply((p) => setForm(p, stmt, field.slot, row.form, row.name));
      const now = current();
      const part = now ? firstPart(now, field.slot) : undefined;
      if (part) enter(leaveName(session), part, null);
      return;
    }
    // A name the list offers the target's form of keeps that form and its other parts.
    const form = formIn(stmt, field.slot);
    const keeps = forms.some((each) => each.form === form && each.name === row.name);
    apply((p) =>
      form && keeps
        ? setForm(p, stmt, field.slot, form, row.name)
        : setName(p, stmt, field.slot, row.name),
    );
    go(leaveName(session), 1, field);
  };

  const onNameKey = (event: KeyboardEvent<HTMLInputElement>, field: Field, rows: NameRow[]) => {
    const shown = shownNameRow(session, rows);
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        setSession(stepHighlight(session, rows.length, shown, event.key === "ArrowDown" ? 1 : -1));
        return;
      case "Enter": {
        event.preventDefault();
        const row = shown === null ? undefined : rows[shown];
        if (row) return chooseName(field, row);
        if (session.typed !== null) return;
        if (sameField(fields.at(-1) ?? null, field)) return closeEditor();
        return go(session, 1, field);
      }
      case "Tab":
        event.preventDefault();
        go(session, event.shiftKey ? -1 : 1, field);
        return;
      default: {
        // A form's key after a name the list offers that form of sets it (`nums[`).
        const name = session.typed ?? nameOf(stmt, field.slot);
        const offered = forms.filter((each) => each.name === name).map((each) => each.form);
        const form = formOfKey(offered, event.key);
        if (name === undefined || !form) return;
        event.preventDefault();
        chooseName(field, { kind: "form", form, name });
        return;
      }
    }
  };

  // ------------------------------------------------------------ the notation

  const widget = (name: string): ReactNode => {
    const held = placeholderValue(stmt, name);
    switch (held?.role) {
      case "id":
      case "target": {
        const shownName = nameOf(stmt, name);
        const field: Field = { slot: name, role: held.role };
        const on = sameField(focus, field);
        const nameField =
          shownName === undefined ? null : (
            <NameField
              key={name}
              slot={name}
              label={fieldLabel(stmt, field)}
              name={shownName}
              typed={on ? session.typed : null}
              on={on}
              register={register(field)}
              onFocus={() => {
                setFocused(field);
                if (!sameField(focus, field)) enter(session, field, null);
              }}
              onBlur={() => setSession((s) => leaveName(s))}
              onType={(text) => setSession((s) => typeName(s, nameChars(text)))}
              onKey={(event) => onNameKey(event, field, names.rows)}
            />
          );
        if (held.role !== "target" || !held.target || held.target.kind === "var") return nameField;
        // A target holding an item: its list's name, then a value line for each other part; one
        // the editor cannot edit (its list no variable) is drawn as the chart draws it.
        const pieces = targetPieces(held.target);
        if (pieces.length === 0) return <span key={name}>{joinParts(slotParts(stmt, name))}</span>;
        const listPart = namePart(held.target);
        return pieces.map((piece, i) => {
          // oxlint-disable-next-line react/no-array-index-key -- a notation's pieces keep their order
          if ("words" in piece) return <span key={`${name}w${i}`}>{piece.words.trim()}</span>;
          if (piece.name === listPart) return nameField;
          const part: Field = { slot: name, role: "expr", part: piece.name };
          const value = valueOf(stmt, part);
          return value ? lineWidget(part, value) : null;
        });
      }
      case "expr":
        return held.expr ? (
          lineWidget({ slot: name, role: "expr" }, held.expr)
        ) : (
          <AddValue key={name} onAdd={() => addItem(session, name, null)} small={false} />
        );
      case "exprs":
        return (
          <ValueItems
            key={name}
            items={held.items}
            line={(item, index) => lineWidget({ slot: name, role: "expr", index }, item)}
            onRemove={(index) => {
              // A word still typed is chosen in its own item, and the lines are left, before the
              // items after it move.
              enter(session, null, null);
              apply((p) => removeItem(p, stmt.id, name, index));
            }}
            onAdd={() => addItem(session, name, null)}
          />
        );
      default:
        return null;
    }
  };

  // A counted loop shows its init and its check, one line each, as the chart draws them; a slot
  // written again is drawn as its value.
  const notation = editedLines(stmt).map((pieces, l) => (
    // oxlint-disable-next-line react/no-array-index-key -- the lines keep their order
    <div key={l} className="flex flex-wrap items-center gap-1.5">
      {pieces.map(({ piece, again }, i) => {
        if ("words" in piece) {
          const text = piece.words.trim();
          // oxlint-disable-next-line react/no-array-index-key -- a notation's pieces keep their order
          return text === "" ? null : <span key={`t${i}`}>{text}</span>;
        }
        if (!again) return widget(piece.name);
        return slotParts(stmt, piece.name).map((part, j) => (
          <span
            // oxlint-disable-next-line react/no-array-index-key -- parts are positional
            key={`v${i}:${j}`}
            className={cn(part.variable && "font-semibold text-variable")}
          >
            {part.text}
          </span>
        ));
      })}
    </div>
  ));

  // ------------------------------------------------------------ the list and its explanation

  let list: ReactNode = null;
  let explanation: Explanation | undefined;
  if (focus && (focus.role === "id" || focus.role === "target")) {
    const shown = shownNameRow(session, names.rows);
    const row = shown === null ? undefined : names.rows[shown];
    list = (
      <EditorList
        sections={names.sections}
        highlight={shown}
        enter={session.typed !== null}
        onHighlight={(index) => setSession((s) => highlightRow(s, index))}
        onChoose={(index) => {
          const chosen = names.rows[index];
          if (chosen) chooseName(focus, chosen);
        }}
      />
    );
    explanation =
      row?.kind === "form"
        ? { name: nodeText(row.form, "label"), parts: helpParts(nodeText(row.form, "help")) }
        : row
          ? {
              name: row.name,
              variable: true,
              parts: [
                {
                  text:
                    row.kind === "new"
                      ? t("editor.explain.newVariable", { name: row.name })
                      : explainVariable(program, stmt.id, row.name),
                },
              ],
            }
          : { name: "", parts: [{ text: t("editor.explain.name") }] };
  } else if (focus?.role === "expr" && line) {
    const { rows, sections } = values;
    const shown = shownHighlight(session, rows.length);
    list = (
      <EditorList
        sections={sections}
        highlight={shown}
        enter={line.word !== ""}
        onHighlight={(index) => setSession((s) => highlightRow(s, index))}
        onChoose={(index) => {
          const row = rows[index];
          if (row) run(chooseRow(session, row, ctx));
        }}
        {...(line.word === "" && !session.switching && !session.all
          ? { onShowAll: () => setSession((s) => showAll(s)) }
          : {})}
      />
    );
    explanation = explainLine(
      line,
      ctx,
      shown === null ? undefined : rows[shown],
      program,
      stmt.id,
    );
  }
  explanation ??= { name: nodeText(def.key, "label"), parts: helpParts(nodeText(def.key, "help")) };

  return (
    <div className="flex flex-col" data-testid="node-editor" data-node={stmt.id}>
      {diagnostics.length > 0 && (
        <div className="flex flex-col gap-2 p-2.5 pb-0">
          {diagnostics.map((d, i) => (
            // oxlint-disable-next-line react/no-array-index-key -- diagnostics have no id of their own
            <DiagnosticMessage key={i} diagnostic={d} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 border-b p-2.5">
        <NameOfNode stmt={stmt} />
        <Button
          variant="outline"
          size="icon"
          aria-label={t("editor.duplicate")}
          title={t("editor.duplicate")}
          onClick={() => apply((p) => duplicateStmt(p, stmt.id))}
        >
          <Copy />
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
          <Trash2 />
        </Button>
      </div>
      <div
        className="flex flex-col gap-1.5 border-b p-2.5 text-[0.95rem]"
        data-testid="editor-notation"
      >
        {notation}
      </div>
      {list && <div className="border-b">{list}</div>}
      <div
        className="flex items-baseline gap-2 rounded-b-lg bg-muted/40 px-2.5 py-2 text-[0.85rem]"
        data-testid="explanation"
      >
        {explanation.name !== "" && (
          <span className={cn("font-semibold", explanation.variable && "text-variable")}>
            {explanation.name}
          </span>
        )}
        <span>
          {explanation.parts.map((part, i) => (
            <span
              // oxlint-disable-next-line react/no-array-index-key -- parts are positional
              key={i}
              className={cn(
                part.underline && "underline underline-offset-2",
                part.slot === "key" && "rounded bg-muted px-1 font-mono text-[0.8rem]",
              )}
            >
              {part.text}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/** The editor of statement `id`, anchored to the element it is rendered in. */
export function NodeEditor({ id }: { id: NodeId }) {
  const program = useProgram((s) => s.program);
  const slot = useEditor((s) => s.slot);
  const hole = useEditor((s) => s.hole);
  const select = useEditor((s) => s.select);
  const closeEditor = useEditor((s) => s.closeEditor);
  // The node's box, which the editor is placed beside; it is no control of its own.
  const [anchor, setAnchor] = useState<Element | null>(null);
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
      <div ref={setAnchor} className="pointer-events-none size-full" aria-hidden />
      {/* On the node's right, where the chart makes room, and inside the canvas, so the
          panel's statement stays readable; it moves only down or up to fit. */}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          side="right"
          align="start"
          sideOffset={EDITOR_GAP}
          collisionBoundary={anchor?.closest("[data-canvas]") ?? "clipping-ancestors"}
          collisionPadding={EDITOR_GAP}
          collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            style={{ width: EDITOR_WIDTH }}
            className="z-50 flex flex-col rounded-lg bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden"
            aria-label={t("editor.label")}
            // The keyboard stays with the chart unless a slot takes it.
            initialFocus={false}
            finalFocus={false}
          >
            <Body
              key={`${id}:${slot ?? ""}:${hole ?? ""}`}
              stmt={node as Stmt}
              program={program}
              initial={{ slot, hole }}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </Popover>
  );
}
