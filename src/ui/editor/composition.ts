// The keys of an input method's composition, which belong to the composition, Esc and Enter
// included (`editor.md`, Value line, Keys).
import type { KeyboardEvent } from "react";

/**
 * Whether a key belongs to an input method's composition. Safari reports the Enter that ends a
 * composition with key code 229 once the composition has ended.
 */
export function composingKey(event: KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}
