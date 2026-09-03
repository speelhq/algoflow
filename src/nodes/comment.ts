// 03-nodes `comment`: `# <text>`; runs as a no-op (one `enter`, R-03).
import { newId } from "@/lang/id";
import { defineStmt } from "./types";

export const comment = defineStmt<"comment">({
  key: "comment",
  category: "basic",
  slots: [{ name: "text", role: "text" }],
  create: () => ({ id: newId(), kind: "comment", text: "" }),
  *run() {
    return undefined;
  },
  python: (node) => [`# ${node.text}`],
});
