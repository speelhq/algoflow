// A case is shown by its inputs, `n ← 15` or `a ← 3, b ← 9, c ← 5`, with
// values written as the blocks write them.
import type { Data, Name } from "@/lang/types";
import { assignmentText, dataText, SEPARATOR } from "@/ui/chart/text";

export function caseText(inputs: Record<Name, Data>): string {
  return Object.entries(inputs)
    .map(([name, value]) => assignmentText(name, dataText(value)))
    .join(SEPARATOR);
}
