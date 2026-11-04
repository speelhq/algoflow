// The `none` block definition
import { newId } from "@/lang/id";
import { defineExpr } from "./types";

export const none = defineExpr<"none">({
  key: "none",
  category: "basic",
  slots: [],
  create: () => ({ id: newId(), kind: "none" }),
  *run() {
    return { t: "none" };
  },
  python: () => "None",
  notation: () => "None",
  yields: () => "none",
  entries: [{ name: "", group: "values" }],
});
