// A value line: the application's input holding its slot's text (`editor.md`, Value line). The
// field's own text is transparent over a copy of it drawn in spans, so each variable takes its
// weight and color from `spanStyle()`, as on the chart, and a word that matches nothing, or a
// draft's text from its error, is underlined. With no text, the field shows its slot's hint.
import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { variableSpans, type Span } from "@/python/parse";
import { cn } from "@/lib/utils";
import { spanStyle } from "@/ui/chart/style";
import type { TextLine } from "./caret";
import { isCompositionKey } from "./composition";
import { FieldInput } from "./FieldInput";
import { oneLine } from "./fields";

type Props = {
  /** The text the field holds, and its selection while it has the keyboard. */
  text: string;
  selection: { start: number; end: number } | null;
  hint: string;
  label: string;
  /** The word typed that matches nothing, underlined. */
  unmatched: Span | null;
  /** A draft's text from its error, underlined once Run or Submit led to it. */
  error: Span | null;
  /** The field holds the draft Run or Submit led to, which draws its red border. */
  invalid: boolean;
  /** The text changes; `composing` while an input method composes it. */
  onChange: (line: TextLine, composing: boolean) => void;
  onSelect: (start: number, end: number) => void;
  onKey: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** The field takes the keyboard: by a click, with the selection it made, else by a key. */
  onFocus: (clicked: { start: number; end: number } | null) => void;
};

/**
 * The field shows the session's selection, which a choice or Tab sets; one the learner made is the
 * field's already. Setting it fires the field's `select`, which reads its scroll again.
 */
function showSelection(
  field: HTMLInputElement,
  selection: { start: number; end: number } | null,
): void {
  if (!selection) return;
  if (field.selectionStart !== selection.start || field.selectionEnd !== selection.end) {
    field.setSelectionRange(selection.start, selection.end);
  }
}

/** The text cut into pieces at each span's edges, each piece marked by the spans it lies in. */
function pieces(text: string, marks: { span: Span; kind: "variable" | "unmatched" | "error" }[]) {
  const cuts = new Set([0, text.length]);
  for (const { span } of marks) cuts.add(span.start).add(span.end);
  const edges = [...cuts].filter((at) => at <= text.length).toSorted((a, b) => a - b);
  return edges.slice(0, -1).map((start, i) => {
    const end = edges[i + 1] ?? text.length;
    const kinds = new Set(
      marks.filter(({ span }) => span.start <= start && end <= span.end).map(({ kind }) => kind),
    );
    return { start, text: text.slice(start, end), kinds };
  });
}

export const ValueLine = forwardRef<HTMLInputElement, Props>(function ValueLine(props, ref) {
  const { text, selection, hint } = props;
  const input = useRef<HTMLInputElement | null>(null);
  const composing = useRef(false);
  const clicked = useRef(false);
  const [scroll, setScroll] = useState(0);

  // A selection the session sets shows while the field has the keyboard, and once it takes it by
  // a key (`onFocus`).
  useLayoutEffect(() => {
    if (input.current && document.activeElement === input.current)
      showSelection(input.current, selection);
  }, [selection]);

  const report = (field: HTMLInputElement) => {
    setScroll(field.scrollLeft);
    props.onSelect(field.selectionStart ?? 0, field.selectionEnd ?? 0);
  };

  const change = (field: HTMLInputElement) => {
    setScroll(field.scrollLeft);
    props.onChange(
      { text: field.value, start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0 },
      composing.current,
    );
  };

  // A line break pasted becomes a space, as in a caption, where a field would drop it.
  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text/plain");
    const flat = oneLine(pasted);
    if (flat === pasted) return;
    event.preventDefault();
    const field = event.currentTarget;
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? 0;
    const next = text.slice(0, start) + flat + text.slice(end);
    const at = start + flat.length;
    props.onChange({ text: next, start: at, end: at }, false);
  };

  const marks = [
    ...variableSpans(text).map((span) => ({ span, kind: "variable" as const })),
    ...(props.unmatched ? [{ span: props.unmatched, kind: "unmatched" as const }] : []),
    ...(props.error ? [{ span: props.error, kind: "error" as const }] : []),
  ];
  // The field is at least as wide as its text or its hint, in its monospaced characters, and it
  // shares the room its line leaves with the line's other fields.
  const width = `calc(${Math.max(text.length, hint.length, 1) + 1}ch + 1.25rem + 2px)`;

  return (
    <span className="relative inline-flex max-w-full min-w-0 flex-1" style={{ flexBasis: width }}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-px flex items-center overflow-hidden px-2.5 font-mono text-base whitespace-pre md:text-sm"
      >
        <span className="inline-block" style={{ transform: `translateX(${-scroll}px)` }}>
          {pieces(text, marks).map((piece) => {
            const style = spanStyle({ variable: piece.kinds.has("variable") });
            return (
              <span
                key={piece.start}
                className={cn(
                  style.colorClass,
                  (piece.kinds.has("unmatched") || piece.kinds.has("error")) &&
                    "underline decoration-destructive decoration-wavy",
                )}
                style={{ fontWeight: style.fontWeight }}
              >
                {piece.text}
              </span>
            );
          })}
        </span>
      </span>
      {/* Transparent in every theme, so the spans below draw its text. */}
      <FieldInput
        ref={(element) => {
          input.current = element;
          if (typeof ref === "function") ref(element);
          else if (ref) ref.current = element;
        }}
        type="text"
        value={text}
        placeholder={hint}
        aria-label={props.label}
        aria-invalid={props.invalid || undefined}
        spellCheck={false}
        autoComplete="off"
        data-value-line
        className="relative font-mono text-transparent caret-foreground selection:bg-selection/30 placeholder:font-normal dark:bg-transparent"
        onChange={(event) => change(event.currentTarget)}
        onSelect={(event) => report(event.currentTarget)}
        onScroll={(event) => setScroll(event.currentTarget.scrollLeft)}
        onKeyDown={(event) => {
          // A key of an input method's composition is the composition's, so neither the editor
          // nor the page acts on it.
          if (isCompositionKey(event)) {
            event.stopPropagation();
            return;
          }
          props.onKey(event);
        }}
        onPaste={paste}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          change(event.currentTarget);
        }}
        onMouseDown={(event) => {
          // Only a press that gives the field the keyboard is a click that enters it.
          clicked.current = document.activeElement !== event.currentTarget;
        }}
        onFocus={(event) => {
          const field = event.currentTarget;
          const by = clicked.current
            ? { start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0 }
            : null;
          clicked.current = false;
          if (!by) showSelection(field, selection);
          props.onFocus(by);
        }}
      />
    </span>
  );
});
