// The block editor: a popover beside the selected block's chart node holding its caption field
// with `Duplicate` and `Delete`, the block's notation with its slots editable in place (values,
// targets, and lists of values as value lines, an optional slot with no value as `+ value`), the
// value list of the focused slot, and the explanation line. Reads slot roles, never a type. The
// editing state is a session (`session.ts`) that only its transitions change.
import { Copy, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { findChallenge } from "@/challenges";
import { blockText, t } from "@/i18n/t";
import { duplicateStmt, removeStmt, setExpr } from "@/lang/edit";
import { variableKinds } from "@/lang/kinds";
import { visibleAt } from "@/lang/scope";
import type { NodeId, Program, Stmt } from "@/lang/types";
import { blocksById, getHoldingRoutine } from "@/lang/walk";
import { cn } from "@/lib/utils";
import { createEmptyDraft, getBlockDef, registryKey } from "@/blocks/registry";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { placeholderValue, slotSpans } from "@/ui/chart/text";
import { Button } from "@/ui/primitives/button";
import { Popover } from "@/ui/primitives/popover";
import { DiagnosticMessage, editorDiagnostics, ledDraft } from "./diagnostics";
import { apply, applyTyped } from "./edits";
import { EditorList } from "./EditorList";
import { explainDraft, explainEditor, explainLine, helpSpans, type Explanation } from "./explain";
import {
  editedLines,
  fieldBeside,
  fieldDraft,
  fieldHint,
  fieldLabel,
  fieldText,
  stmtFields,
  isSameField,
  startField,
  targetSlot,
  findFieldValue,
  type Field,
  type FieldValue,
} from "./fields";
import { caretMatches, caretOffersAll, readCaret, wordAt } from "./caret";
import { callableFunctions, type LineContext } from "./choices";
import { CaptionField } from "./CaptionField";
import { isCompositionKey } from "./composition";
import { tabTarget } from "./focus";
import { routineNames } from "./names";
import { valueList } from "./valueList";
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
  NO_FIELD,
  type After,
  type Entry,
  type Session,
  type Transition,
} from "./session";
import { AddValue } from "./slots";
import { Spans } from "./Spans";
import { ValueLine } from "./ValueLine";
import { EDITOR_GAP, EDITOR_HEIGHT, EDITOR_WIDTH } from "./size";

type Initial = { slot: string | null; insertedCaret: number | null };

/** Whether a key is pressed with Ctrl, Cmd, Alt, or Shift. */
const hasModifier = (event: KeyboardEvent) =>
  event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;

function Body(props: {
  stmt: Stmt;
  program: Program;
  initial: Initial;
  /** The editor itself: the popup, outside every field and control (`editor.md`, Block editor). */
  editor: HTMLElement | null;
}) {
  const { stmt, program, initial, editor } = props;
  const def = getBlockDef(registryKey(stmt));
  const ledDiagnostic = useEditor((s) => s.ledDiagnostic);
  const typing = useEditor((s) => s.typing);
  const setTyping = useEditor((s) => s.setTyping);
  const select = useEditor((s) => s.select);
  const closeEditor = useEditor((s) => s.closeEditor);
  const fields = stmtFields(stmt);
  const elements = useRef(new Map<string, HTMLElement | null>());
  const [kept, setSession] = useState(() => {
    // A block the block menu has just inserted opens on its first field (`editor.md`, Block
    // editor).
    const start =
      initial.insertedCaret === null ? startField(stmt, fields, initial.slot) : (fields[0] ?? null);
    return openSession(stmt, start, initial.insertedCaret);
  });
  // A value changed elsewhere (an undo) reopens the line on it.
  const session = followStatement(kept, stmt);
  if (session !== kept) setSession(session);
  const { focus, line } = session;
  const [focused, setFocused] = useState<Field | null>(null);

  // The focused field takes the keyboard once it is drawn.
  useEffect(() => {
    if (focus && !isSameField(focus, focused)) elements.current.get(focus.slot)?.focus();
  }, [focus, focused]);

  // Where the keyboard goes in the editor. Anywhere but a field, no field has it, so the value list
  // closes, and Tab back into a field opens it as Tab does (`editor.md`, Value line, Selected
  // text). On the editor itself, the explanation line names the ways out. The listener comes before
  // the effect below, which can give the editor itself the keyboard as the editor opens; a body
  // drawn again while the editor itself has it starts there.
  const [onEditor, setOnEditor] = useState(
    () => editor !== null && document.activeElement === editor,
  );
  useEffect(() => {
    if (!editor) return;
    const taken = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      setOnEditor(target === editor);
      if (!target?.closest("[data-value-line]")) setSession(NO_FIELD);
    };
    const left = (event: FocusEvent) => {
      if (event.target === editor) setOnEditor(false);
    };
    editor.addEventListener("focusin", taken);
    editor.addEventListener("focusout", left);
    return () => {
      editor.removeEventListener("focusin", taken);
      editor.removeEventListener("focusout", left);
    };
  }, [editor]);

  // While no field has it, the keyboard stays in the editor: the editor itself takes it when the
  // editor opens on no field, and when the field that had it goes (`editor.md`, Block editor).
  useEffect(() => {
    if (editor && focus === null && !editor.contains(document.activeElement)) editor.focus();
  }, [editor, focus]);

  const routine = getHoldingRoutine(program, stmt.id);
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
  const diagnostics = editorDiagnostics(program, stmt.id, ledDiagnostic, typing);
  const draftError = ledDraft(program, stmt, ledDiagnostic);
  // A field of this editor no longer has the keyboard once the editor closes.
  useEffect(() => () => setTyping(null), [setTyping]);

  // ------------------------------------------------------------ transitions

  /** The statement as the program holds it now, after the edits applied so far. */
  const current = () => blocksById(useProgram.getState().program).get(stmt.id) as Stmt | undefined;

  /** Writes a transition's values into the program and keeps the session it leaves. */
  const applyTransition = (transition: Transition): Session => {
    for (const { field, value } of transition.edits) {
      applyTyped((p) => setExpr(p, stmt.id, field.slot, value), `${stmt.id}:${field.slot}`);
    }
    setSession(transition.session);
    return transition.session;
  };

  /** Moves the keyboard to `field`, its line opened as `how` says (`Entry`). */
  const enter = (field: Field | null, how: Entry): void => {
    setSession(enterField(current() ?? stmt, field, how));
  };

  /**
   * Leaves `field` for the next or previous field of the notation, entered as `entry` says; past the
   * last field, for the editor itself (`editor.md`, Targets). A transition writes a value into its
   * own field, which keeps the notation's fields as they are.
   */
  const go = (step: 1 | -1, field: Field | null, entry: Entry): void => {
    const next = field && fieldBeside(fields, field, step);
    if (next) enter(next, entry);
    else editor?.focus();
  };

  /** `+ value` gives an optional slot an empty slot, whose field takes the keyboard. */
  const addValue = (slot: string) => {
    if (!apply((p) => setExpr(p, stmt.id, slot, createEmptyDraft()))) return;
    const now = current() ?? stmt;
    enter(stmtFields(now).find((field) => field.slot === slot) ?? null, "tab");
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
    else if (then) go(then.go, left.focus, then.entry);
  };

  /** Whether the notation has a field `step` on from the focused one, which ← and → move to. */
  const canMove = (step: 1 | -1) =>
    focus !== null && fieldBeside(fields, focus, step) !== undefined;

  const onValueKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const result = valueKey(session, event, values.rows, ctx, canMove);
    if (!result.taken) return;
    event.preventDefault();
    runAfter(applyTransition(result), result.after);
  };

  const register = (field: Field) => (element: HTMLElement | null) => {
    elements.current.set(field.slot, element);
  };

  const lineWidget = (field: Field, value: FieldValue): ReactNode => {
    const shown = isSameField(focus, field) ? line : null;
    const text = shown ? shown.text : fieldText(value);
    const led = draftError !== undefined && fieldDraft(value)?.id === draftError.draft;
    return (
      <ValueLine
        key={field.slot}
        ref={register(field)}
        text={text}
        selection={shown}
        hint={fieldHint(stmt, field)}
        label={fieldLabel(stmt, field)}
        unmatched={shown ? unmatched : null}
        error={led ? { start: draftError.from, end: text.length } : null}
        onKey={onValueKey}
        onChange={(typed, composing) => applyTransition(changeText(session, typed, composing))}
        onSelect={(start, end) => setSession((s) => selectText(s, start, end))}
        onFocus={(clicked) => {
          setFocused(field);
          if (!isSameField(focus, field)) enter(field, clicked ?? "tab");
        }}
      />
    );
  };

  // ------------------------------------------------------------ the notation

  const widget = (name: string): ReactNode => {
    const field = fields.find((each) => each.slot === name);
    const value = field && findFieldValue(stmt, field);
    if (field && value) return lineWidget(field, value);
    // An optional slot that holds no value is no field (`stmtFields`).
    return placeholderValue(stmt, name)?.role === "expr" ? (
      <AddValue key={name} onAdd={() => addValue(name)} />
    ) : null;
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
          runAfter(applyTransition(picked), picked.after);
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
  if (onEditor) explanation ??= explainEditor();
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
      {/* The popup's description, which a screen reader reads when the editor itself takes the
          keyboard (`editor.md`, Block editor). */}
      <PopoverPrimitive.Description
        render={<div />}
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
      </PopoverPrimitive.Description>
    </div>
  );
}

/** The editor of statement `id`, anchored to the element it is rendered in. */
export function BlockEditor({ id }: { id: NodeId }) {
  const program = useProgram((s) => s.program);
  const slot = useEditor((s) => s.slot);
  const insertedCaret = useEditor((s) => s.insertedCaret);
  const select = useEditor((s) => s.select);
  const closeEditor = useEditor((s) => s.closeEditor);
  const [popup, setPopup] = useState<HTMLDivElement | null>(null);

  /**
   * A key that no field or control took (`editor.md`, Block editor): Tab and Shift+Tab, which never
   * move the keyboard out of an open editor, and on the editor itself Enter, which closes it.
   * Ctrl/Cmd+Enter stays the page's play button, and a key of a composition is the composition's.
   */
  const editorKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || isCompositionKey(event) || !popup) return;
    if (event.key === "Tab") {
      event.preventDefault();
      tabTarget(popup, document.activeElement, event.shiftKey ? -1 : 1).focus();
    } else if (event.key === "Enter" && event.target === popup && !hasModifier(event)) {
      event.preventDefault();
      closeEditor();
    }
  };
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
            ref={setPopup}
            className="z-50 flex flex-col rounded-lg bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden"
            aria-label={t("editor.label")}
            // A field, or else the editor itself, takes the keyboard once the editor is drawn.
            initialFocus={false}
            finalFocus={false}
            onKeyDown={editorKey}
          >
            <Body
              key={`${id}:${slot ?? ""}:${insertedCaret ?? ""}`}
              stmt={stmt}
              program={program}
              initial={{ slot, insertedCaret }}
              editor={popup}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </Popover>
  );
}
