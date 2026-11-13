// Where Tab and Shift+Tab move the keyboard in an open block editor (`editor.md`, Block editor):
// through the editor's controls in their order, and to the editor itself past the last and before
// the first, so the keyboard never leaves an open editor by Tab.

/**
 * The controls an editor holds that Tab stops at, in their order: none that a negative `tabindex`
 * takes out, such as the value list's rows.
 */
const CONTROLS = [
  "input:not([disabled])",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "a[href]",
  "[tabindex]",
]
  .map((selector) => `${selector}:not([tabindex^="-"])`)
  .join(", ");

/**
 * The element that Tab (`step` 1) or Shift+Tab (`step` -1) moves the keyboard to from `from`: the
 * next or previous control of `editor`, or the editor itself past the last and before the first.
 * From anything else, such as the editor itself, it counts from the editor itself.
 */
export function tabTarget(editor: HTMLElement, from: Element | null, step: 1 | -1): HTMLElement {
  const order = [editor, ...editor.querySelectorAll<HTMLElement>(CONTROLS)];
  const at = Math.max(
    0,
    order.findIndex((element) => element === from),
  );
  return order[(at + step + order.length) % order.length] ?? editor;
}
