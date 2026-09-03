// 03-nodes `continue`
import { newId } from "@/lang/id";
import { defineStmt } from "./types";

export const continueStmt = defineStmt<"continue">({
  key: "continue",
  category: "control",
  requires: "loop",
  slots: [],
  create: () => ({ id: newId(), kind: "continue" }),
  *run() {
    return { kind: "continue" };
  },
  python: () => ["continue"],
});
