// 03-nodes.md: `NodeDef.category`; U-40: block menu groups appear in this order.
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
