// The `continue` block definition
import { newId } from "@/lang/id";
import { defineStmt } from "./types";

export const continueStmt = defineStmt<"continue">({
  key: "continue",
  category: "control",
  requires: "loop",
  chart: { jump: "next" },
  slots: [],
  create: () => ({ id: newId(), type: "continue" }),
  *run() {
    return { type: "continue" };
  },
  python: () => ["continue"],
  notation: () => "continue",
});
