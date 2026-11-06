// The `break` block definition
import { newId } from "@/lang/id";
import { defineStmt } from "./types";

export const breakStmt = defineStmt<"break">({
  key: "break",
  category: "control",
  requires: "loop",
  chart: { jump: "exit" },
  slots: [],
  create: () => ({ id: newId(), type: "break" }),
  *run() {
    return { type: "break" };
  },
  python: () => ["break"],
  notation: () => "break",
});
