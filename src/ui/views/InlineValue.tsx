// V-01 inline text: `repr()` of a value (M-02 renders every kind inline; M-04/M-05 add the rest).
import type { Heap, Value } from "@/lang/types";
import { repr } from "@/runtime/values";

export function InlineValue({ value, heap }: { value: Value; heap: Heap }) {
  return (
    <span data-view="inline" className="font-mono">
      {repr(value, heap)}
    </span>
  );
}
