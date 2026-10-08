// A value line (U-50): one expression written as the chart writes it, variables as bold
// words in the variable colour, a word operation on a light underlay, an input to fill as an
// empty field, and the caret. Keys go to the editor; a click on a value puts the caret after
// it, and a click on an operator asks to switch it (U-54). Reads pieces, never a kind.
import type { KeyboardEvent, ReactNode } from "react";
import { t } from "@/i18n/t";
import type { Expr, NodeId } from "@/lang/types";
import { isEmptyExpr } from "@/lang/walk";
import { cn } from "@/lib/utils";
import { getNode, keyOf } from "@/nodes";
import { exprPieces, isWordOperation } from "@/ui/chart/text";
import type { LineState } from "./keys";
import { nodeAt } from "./line";

type Props = {
  state: LineState;
  /** The line has the keyboard: its caret is drawn. */
  active: boolean;
  /** The whole value is selected: typing replaces it. */
  selected?: boolean;
  /** The text being typed into a text value, when one is open (U-50). */
  text: { at: NodeId; value: string } | null;
  onText: (value: string) => void;
  onTextDone: () => void;
  onCaret: (id: NodeId) => void;
  onSwitch: (id: NodeId) => void;
  onKey: (event: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  register?: (element: HTMLDivElement | null) => void;
  testId?: string;
};

/** Whether `slot` of `expr` is what one of its block's entries presets: an operator to switch. */
function switchable(expr: Expr, slot: string | undefined): boolean {
  if (slot === undefined) return false;
  return (getNode(keyOf(expr)).menu ?? []).some((entry) => Object.hasOwn(entry.preset ?? {}, slot));
}

export function ValueLine({
  state,
  active,
  selected = false,
  text,
  onText,
  onTextDone,
  onCaret,
  onSwitch,
  onKey,
  onFocus,
  register,
  testId,
}: Props) {
  const { root, caret } = state.line;
  const open = new Set(
    caret.groups.flatMap((group) => {
      const held = nodeAt(root, group);
      return held ? [held.id] : [];
    }),
  );

  const caretMark = (
    <span className="caret inline-block h-5 w-px animate-pulse bg-selection" aria-hidden />
  );
  const draft =
    state.draft !== "" ? (
      <span className="border-b border-dotted border-muted-foreground text-muted-foreground">
        {state.draft}
      </span>
    ) : null;

  const render = (expr: Expr, isRoot: boolean): ReactNode => {
    const here = active && caret.at === expr.id;
    if (isEmptyExpr(expr)) {
      return (
        <button
          key={expr.id}
          type="button"
          data-field={expr.id}
          className={cn(
            "inline-flex h-6 min-w-8 cursor-text items-center gap-0.5 rounded border px-1 align-middle",
            here ? "border-selection" : "border-muted-foreground/40",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onCaret(expr.id);
          }}
        >
          {here && draft}
          {here && caretMark}
          {!here && isRoot && <span className="text-muted-foreground">{t("editor.typeHint")}</span>}
        </button>
      );
    }
    if (text?.at === expr.id) {
      return (
        <span key={expr.id} className="inline-flex items-center">
          {"“"}
          <input
            // The text field takes the keyboard as it opens, and keeps it while it is open.
            ref={(element) => {
              if (element && document.activeElement !== element) element.focus();
            }}
            value={text.value}
            size={Math.max(4, text.value.length + 1)}
            aria-label={t("node.str.label")}
            data-testid="text-field"
            className="rounded border border-selection px-1"
            onChange={(event) => onText(event.target.value)}
            onKeyDown={(event) => {
              // The line's keys are not the field's: a text is typed as it is.
              event.stopPropagation();
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                onTextDone();
              }
            }}
            onBlur={onTextDone}
          />
          {"”"}
        </span>
      );
    }
    const pieces = exprPieces(expr).map((piece, i) => {
      if ("child" in piece) {
        return (
          // oxlint-disable-next-line react/no-array-index-key -- pieces are positional
          <span key={i} className="inline-flex items-center whitespace-pre">
            {piece.bracketed && "("}
            {render(piece.child, false)}
            {piece.bracketed && ")"}
          </span>
        );
      }
      if (switchable(expr, piece.slot)) {
        return (
          <button
            // oxlint-disable-next-line react/no-array-index-key -- pieces are positional
            key={i}
            type="button"
            data-operator={expr.id}
            className="cursor-pointer rounded px-0.5 whitespace-pre hover:bg-muted"
            onClick={(event) => {
              event.stopPropagation();
              onSwitch(expr.id);
            }}
          >
            {piece.text}
          </button>
        );
      }
      return (
        <span
          // oxlint-disable-next-line react/no-array-index-key -- pieces are positional
          key={i}
          className={cn("whitespace-pre", piece.variable && "font-bold text-variable")}
        >
          {piece.text}
        </span>
      );
    });
    return (
      <span key={expr.id} className="inline-flex items-center">
        {open.has(expr.id) && <span className="text-muted-foreground">(</span>}
        <span
          data-value={expr.id}
          className={cn(
            "inline-flex cursor-text items-center rounded",
            isWordOperation(expr) && "bg-muted px-0.5",
            isRoot && selected && "bg-selection/20",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onCaret(expr.id);
          }}
          role="presentation"
        >
          {pieces}
        </span>
        {open.has(expr.id) && <span className="text-muted-foreground">)</span>}
        {here && draft}
        {here && !selected && caretMark}
      </span>
    );
  };

  return (
    <div
      ref={register}
      role="textbox"
      tabIndex={0}
      aria-label={t("editor.label")}
      data-testid={testId}
      data-active={active || undefined}
      className={cn(
        "inline-flex min-h-8 flex-wrap items-center rounded-md border-2 px-2 py-0.5 outline-none",
        active ? "border-selection" : "border-transparent hover:border-muted-foreground/30",
      )}
      onKeyDown={onKey}
      onFocus={onFocus}
    >
      {render(root, true)}
    </div>
  );
}
