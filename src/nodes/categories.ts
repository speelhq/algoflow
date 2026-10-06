// `NodeDef.category`: the block menu's groups, in this order.
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
