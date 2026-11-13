// The `break` block definition
import { createNodeId } from "@/lang/id";
import { defineStmt } from "./types";

export const breakStmt = defineStmt<"break">({
  key: "break",
  category: "control",
  requires: "loop",
  chart: { jump: "exit" },
  slots: [],
  create: () => ({ id: createNodeId(), type: "break" }),
  *run() {
    return { type: "break" };
  },
  python: () => ["break"],
  notation: () => "break",
});
