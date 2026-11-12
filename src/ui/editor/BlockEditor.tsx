// The block editor: a popover beside the selected block's chart node holding its caption field
// with `Duplicate` and `Delete`, the block's notation with its slots editable in place (values
// and targets as value lines, lists of values with add and remove), the value list of the
// focused slot, and the explanation line. Reads slot roles, never a type. The editing state
// is a session (`session.ts`) that only its transitions change.
import { Copy, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { findChallenge } from "@/challenges";
import { blockText, t } from "@/i18n/t";
import { duplicateStmt, insertItem, removeItem, removeStmt, setExpr } from "@/lang/edit";
import { variableKinds } from "@/lang/kinds";
import { visibleAt } from "@/lang/scope";
import type { Expr, NodeId, Program, Stmt } from "@/lang/types";
import { isExpr, blocksById, routineOf } from "@/lang/walk";
import { cn } from "@/lib/utils";
import { emptyDraft, getBlockDef, keyOf } from "@/blocks/registry";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { placeholderValue, slotSpans } from "@/ui/chart/text";
import { Button } from "@/ui/primitives/button";
import { Popover } from "@/ui/primitives/popover";
import { DiagnosticMessage, editorDiagnostics, ledDraft } from "./diagnostics";
import { apply } from "./edits";
import { EditorList } from "./EditorList";
import { explainDraft, explainLine, helpSpans, type Explanation } from "./explain";
import {
  editedLines,
  fieldHint,
  fieldKey,
  fieldLabel,
  fieldText,
  fieldsOf,
  sameField,
  startField,
  targetSlot,
  type Field,
} from "./fields";
import { caretMatches, caretOffersAll, readCaret, wordAt } from "./caret";
import { callableFunctions, type LineContext } from "./choices";
import { CaptionField } from "./CaptionField";
import { routineNames } from "./names";
import { valueList } from "./rows";
import {
  changeText,
  enterField,
  followStatement,
  highlightRow,
  openSession,
  pickRow,
  selectText,
  sessionWord,
  shownHighlight,
  showAll,
  valueKey,
  type After,
  type Session,
  type Transition,
} from "./session";
import { AddValue, ValueItems } from "./slots";
import { Spans } from "./Spans";
import { ValueLine } from "./ValueLine";
import { EDITOR_GAP, EDITOR_HEIGHT, EDITOR_WIDTH } from "./size";

type Initial = { slot: string | null; emptyId: NodeId | null; insertedCaret: number | null };

/**
 * The field with the keyboard once item `index` of slot `slot` is removed: the same, or one place
 * earlier when it came after the item removed; none when it was that item.
 */
function itemAfterRemoval(focus: Field | null, slot: string, index: number): Field | null {
  if (!focus || focus.slot !== slot || focus.index === undefined) return focus;
  if (focus.index === index) return null;
  return focus.index > index ? { ...focus, index: focus.index - 1 } : focus;
}

function Body({ stmt, program, initial }: { stmt: Stmt; program: Program; initial: Initial }) {
  const def = getBlockDef(keyOf(stmt));
  const led = useEditor((s) => s.diagnostic);
  const typing = useEditor((s) => s.typing);
  const setTyping = useEditor((s) => s.setTyping);
  const select = useEditor((s) => s.select);
  const closeEditor = useEditor((s) => s.closeEditor);
  const fields = fieldsOf(stmt);
  const elements = useRef(new Map<string, HTMLElement | null>());
  const [kept, setSession] = useState(() => {
    // A block the block menu has just inserted opens on its first field (`editor.md`, Block
    // editor).
    const start =
      initial.insertedCaret === null ? startField(stmt, fields, initial) : (fields[0] ?? null);
    return openSession(stmt, start, initial.insertedCaret);
  });
  // A value changed elsewhere (an undo) reopens the line on it.
  const session = followStatement(kept, stmt);
  if (session !== kept) setSession(session);
  const { focus, line } = session;
  const [focused, setFocused] = useState<Field | null>(null);

  // The focused field takes the keyboard once it is drawn.
  useEffect(() => {
    if (focus && !sameField(focus, focused)) elements.current.get(fieldKey(focus))?.focus();
  }, [focus, focused]);

  const routine = routineOf(program, stmt.id);
  const kinds = variableKinds(program, routine);
  // The names the problem expects, which a binding target's list offers first (`editor.md`, Name
  // list).
  const asked = useMemo(
    () => Object.keys(findChallenge(program.challengeId)?.tests[0]?.expect.variables ?? {}),
    [program.challengeId],
  );
  const named = useMemo(
    () => routineNames(program, routine, asked, stmt.id),
    [program, routine, asked, stmt.id],
  );
  // The focused target slot's line keeps a target and offers names (`editor.md`, Targets).
  const target = focus ? targetSlot(stmt, focus) : undefined;
  const binds = target ? target.binds === true : undefined;
  const ctx: LineContext = useMemo(() => {
    const variables = visibleAt(program, stmt.id) ?? [];
    return {
      variables,
      kinds,
      functions: callableFunctions(program),
      target:
        binds === undefined
          ? null
          : binds
            ? { ...named, binds }
            : { asked: [], names: variables, binds },
    };
  }, [program, stmt.id, kinds, binds, named]);
  const diagnostics = editorDiagnostics(program, stmt.id, led, typing);
  const draftError = ledDraft(program, stmt, led);
  // A field of this editor no longer has the keyboard once the editor closes.
  useEffect(() => () => setTyping(null), [setTyping]);

  // ------------------------------------------------------------ transitions

  /** The statement as the program holds it now, after the edits applied so far. */
  const current = () => blocksById(useProgram.getState().program).get(stmt.id) as Stmt | undefined;

  /** Writes a transition's values into the program and keeps the session it leaves. */
  const run = (transition: Transition): Session => {
    for (const { field, root } of transition.edits) {
      const at = `${stmt.id}:${fieldKey(field)}`;
      apply((p) => setExpr(p, stmt.id, field.slot, root, field.index), at);
    }
    setSession(transition.session);
    return transition.session;
  };

  /** Moves the keyboard to `field`: by Tab, or by a click with the selection it made. */
  const enter = (field: Field | null, how: "tab" | { start: number; end: number }): void => {
    setSession(enterField(current() ?? stmt, field, how));
  };

  /** Leaves `field` for the next or previous field of the notation, as the statement is now. */
  const go = (step: 1 | -1, field: Field | null): void => {
    const now = fieldsOf(current() ?? stmt);
    const at = field ? now.findIndex((each) => sameField(each, field)) : -1;
    const next = now[at + step];
    if (next) enter(next, "tab");
  };

  /** Adds a value to a slot: an optional value, or an item at `at` of a list (the end when null). */
  const addItem = (slot: string, at: number | null) => {
    const empty = emptyDraft();
    const itemsOf = (block: Stmt | undefined): unknown =>
      block ? (block as unknown as Record<string, unknown>)[slot] : undefined;
    const list = def.slots.find((s) => s.name === slot)?.role === "exprs";
    const added = (p: Program): Program => {
      if (!list) return setExpr(p, stmt.id, slot, empty);
      const items = itemsOf(blocksById(p).get(stmt.id) as Stmt | undefined);
      const end = Array.isArray(items) ? items.length : 0;
      return insertItem(p, stmt.id, slot, at ?? end, empty);
    };
    if (!apply(added)) return;
    const items = itemsOf(current());
    const index = Array.isArray(items)
      ? items.findIndex((item) => isExpr(item) && item.id === empty.id)
      : -1;
    enter({ slot, ...(list ? { index } : {}) }, "tab");
  };

  // ------------------------------------------------------------ the value line

  const values = focus ? valueList(session, ctx) : { rows: [], sections: [] };
  const word = line ? wordAt(line) : undefined;
  const unmatched =
    line && word && word.text !== "" && caretMatches(line, ctx).length === 0
      ? { start: word.start, end: line.start }
      : null;

  /** Runs what a key or a choice leaves to the editor, once the session it left is kept. */
  const runAfter = (left: Session, then: After | undefined) => {
    if (then === "close") closeEditor();
    else if (then && "go" in then) go(then.go, left.focus);
    else if (then && left.focus) addItem(left.focus.slot, then.addItem);
  };

  /** Whether the notation has a field `step` on from the focused one, which Tab moves to. */
  const canMove = (step: 1 | -1) => {
    const at = fields.findIndex((each) => sameField(each, focus));
    return at >= 0 && fields[at + step] !== undefined;
  };

  const onValueKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const result = valueKey(session, event, values.rows, ctx, canMove);
    if (!result.taken) return;
    event.preventDefault();
    runAfter(run(result), result.after);
  };

  const register = (field: Field) => (element: HTMLElement | null) => {
    elements.current.set(fieldKey(field), element);
  };

  const lineWidget = (field: Field, root: Expr): ReactNode => {
    const shown = sameField(focus, field) ? line : null;
    const text = shown ? shown.text : fieldText(root);
    return (
      <ValueLine
        key={fieldKey(field)}
        ref={register(field)}
        text={text}
        selection={shown}
        hint={fieldHint(stmt, field)}
        label={fieldLabel(stmt, field)}
        unmatched={shown ? unmatched : null}
        error={draftError?.draft === root.id ? { start: draftError.from, end: text.length } : null}
        onKey={onValueKey}
        onChange={(typed, composing) => run(changeText(session, ctx, typed, composing))}
        onSelect={(start, end) => setSession((s) => selectText(s, start, end))}
        onFocus={(clicked) => {
          setFocused(field);
          if (!sameField(focus, field)) enter(field, clicked ?? "tab");
        }}
      />
    );
  };

  // ------------------------------------------------------------ the notation

  const widget = (name: string): ReactNode => {
    const held = placeholderValue(stmt, name);
    switch (held?.role) {
      case "expr":
        return held.expr ? (
          lineWidget({ slot: name }, held.expr)
        ) : (
          <AddValue key={name} onAdd={() => addItem(name, null)} small={false} />
        );
      case "exprs":
        return (
          <ValueItems
            key={name}
            items={held.items}
            line={(item, index) => lineWidget({ slot: name, index }, item)}
            onRemove={(index) => {
              // The field with the keyboard follows its item, and leaves the keyboard with it.
              const staying = itemAfterRemoval(focus, name, index);
              if (!apply((p) => removeItem(p, stmt.id, name, index))) return;
              if (staying === null) {
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                enter(null, "tab");
              } else setSession((s) => ({ ...s, focus: staying }));
            }}
            onAdd={() => addItem(name, null)}
          />
        );
      default:
        return null;
    }
  };

  // A counted loop shows its init and its check, one line each, as the chart draws them; a slot
  // written again is drawn as its value.
  const notation = editedLines(stmt).map((tokens, l) => (
    // oxlint-disable-next-line react/no-array-index-key -- the lines keep their order
    <div key={l} className="flex flex-wrap items-center gap-1.5">
      {tokens.map(({ token, again }, i) => {
        if ("text" in token) {
          const text = token.text.trim();
          // oxlint-disable-next-line react/no-array-index-key -- a notation's tokens keep their order
          return text === "" ? null : <span key={`t${i}`}>{text}</span>;
        }
        if (!again) return widget(token.placeholder);
        // oxlint-disable-next-line react/no-array-index-key -- a notation's tokens keep their order
        return <Spans key={`v${i}`} spans={slotSpans(stmt, token.placeholder, program)} />;
      })}
    </div>
  ));

  // ------------------------------------------------------------ the list and its explanation

  let list: ReactNode = null;
  // A draft's message comes first, because the learner was sent to the draft to fix it.
  let explanation: Explanation | undefined = draftError && explainDraft(draftError.diagnostic);
  if (focus && line) {
    const { rows, sections } = values;
    const shown = shownHighlight(session, rows.length);
    const typed = sessionWord(session) !== "";
    list = (
      <EditorList
        sections={sections}
        highlight={shown}
        enter={typed}
        empty={
          readCaret(line, ctx.kinds).place === "text" ? t("editor.inText") : t("editor.noItems")
        }
        onHighlight={(index) => setSession((s) => highlightRow(s, index))}
        onChoose={(index) => {
          const row = rows[index];
          if (!row) return;
          const picked = pickRow(session, row, ctx);
          runAfter(run(picked), picked.after);
        }}
        {...(!session.all && caretOffersAll(line, ctx)
          ? { onShowAll: () => setSession((s) => showAll(s)) }
          : {})}
      />
    );
    explanation ??= explainLine(
      line,
      ctx,
      shown === null ? undefined : rows[shown],
      program,
      stmt.id,
    );
  }
  explanation ??= {
    name: [{ text: blockText(def.key, "label") }],
    spans: helpSpans(blockText(def.key, "help")),
  };

  return (
    <div
      // While a list is shown the editor keeps one height, so neither the list nor the explanation
      // line moves it; the positioner gives the canvas's height as `--available-height`. In a
      // canvas lower than its fixed parts and a few rows, the editor scrolls within that height.
      className={cn("flex flex-col", list && "overflow-y-auto")}
      style={list ? { height: `min(${EDITOR_HEIGHT}px, var(--available-height))` } : undefined}
      data-testid="block-editor"
      data-block={stmt.id}
    >
      {diagnostics.length > 0 && (
        <div className="flex flex-col gap-2 p-2.5 pb-0">
          {diagnostics.map((d, i) => (
            // oxlint-disable-next-line react/no-array-index-key -- diagnostics have no id of their own
            <DiagnosticMessage key={i} diagnostic={d} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 border-b p-2.5">
        <CaptionField stmt={stmt} />
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
        className="flex flex-col gap-1.5 border-b p-2.5 font-mono text-[0.95rem]"
        data-testid="editor-notation"
        // While a field has the keyboard, the learner hasn't finished the block (`chart.md`,
        // Editing on the chart, Diagnostics).
        onFocus={() => setTyping(stmt.id)}
        onBlur={(event) => {
          // A window left behind keeps its field's keyboard.
          const leaving = !event.currentTarget.contains(event.relatedTarget) && document.hasFocus();
          if (leaving) setTyping(null);
        }}
      >
        {notation}
      </div>
      {list && <div className="flex h-0 min-h-24 flex-1 flex-col border-b">{list}</div>}
      <div
        className={cn(
          "flex items-baseline gap-2 rounded-b-lg bg-muted/40 px-2.5 py-2 text-[0.85rem]",
          // Four lines, the longest help's, so the highlight does not change the list's height.
          list && "min-h-[calc(4lh+1rem)]",
        )}
        data-testid="explanation"
      >
        {explanation.name.length > 0 && (
          <span className="font-semibold">
            <Spans spans={explanation.name} />
          </span>
        )}
        <span>
          {explanation.spans.map((span, i) =>
            "key" in span ? (
              // oxlint-disable-next-line react/no-array-index-key -- spans are positional
              <span key={i} className="rounded bg-muted px-1 font-mono text-[0.8rem]">
                {span.text}
              </span>
            ) : (
              // oxlint-disable-next-line react/no-array-index-key -- spans are positional
              <Spans key={i} spans={[span]} />
            ),
          )}
        </span>
      </div>
    </div>
  );
}

/** The editor of statement `id`, anchored to the element it is rendered in. */
export function BlockEditor({ id }: { id: NodeId }) {
  const program = useProgram((s) => s.program);
  const slot = useEditor((s) => s.slot);
  const emptyId = useEditor((s) => s.emptyId);
  const insertedCaret = useEditor((s) => s.insertedCaret);
  const select = useEditor((s) => s.select);
  const closeEditor = useEditor((s) => s.closeEditor);
  // The chart node's box, which the editor is placed beside; it is no control of its own.
  const [anchor, setAnchor] = useState<Element | null>(null);
  // The selection holds a statement of the open program (`useEditor`).
  const stmt = blocksById(program).get(id) as Stmt;
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
      {/* On the chart node's right, where the chart makes room, and inside the canvas, so the
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
              key={`${id}:${slot ?? ""}:${emptyId ?? ""}:${insertedCaret ?? ""}`}
              stmt={stmt}
              program={program}
              initial={{ slot, emptyId, insertedCaret }}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </Popover>
  );
}
