// 03-nodes.md: `NodeDef.category`; U-10: palette sections appear in this order.
export const CATEGORIES = [
  "basic",
  "list",
  "control",
  "function",
  "dict",
  "class",
  "math",
] as const;

export type Category = (typeof CATEGORIES)[number];
