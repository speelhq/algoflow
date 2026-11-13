// The `none` block definition
import { createNodeId } from "@/lang/id";
import { defineExpr } from "./types";

export const none = defineExpr<"none">({
  key: "none",
  category: "basic",
  slots: [],
  create: () => ({ id: createNodeId(), type: "none" }),
  *run() {
    return { t: "none" };
  },
  python: () => "None",
  notation: () => "None",
  yields: () => "none",
  entries: [{ name: "", group: "values" }],
});
