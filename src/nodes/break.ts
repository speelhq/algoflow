// 03-nodes `break`
import { newId } from "@/lang/id";
import { defineStmt } from "./types";

export const breakStmt = defineStmt<"break">({
  key: "break",
  category: "control",
  requires: "loop",
  slots: [],
  create: () => ({ id: newId(), kind: "break" }),
  *run() {
    return { kind: "break" };
  },
  python: () => ["break"],
});
