// U-71: catalog keys are the dotted paths of en.json's string leaves.
// Dependency-free so both t.ts and scripts/lib/i18n-check.ts share it.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function flatten(
  value: unknown,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  if (typeof value === "string") {
    out[prefix] = value;
    return out;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  throw new Error(`i18n: non-string leaf at "${prefix}"`);
}
